const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
function popup(overrides = {}) {
  const dom = new JSDOM(fs.readFileSync('popup.html','utf8'), {runScripts:'outside-only',url:'https://extension.test'});
  const w = dom.window;
  const calls = { copies:[], downloads:[], requests:[], injections:[] };
  w.chrome = {
    tabs:{query:async()=>[{id:1,url:'https://chatgpt.com/c/test'}],sendMessage:async(id, message)=>{
      calls.requests.push(message);
      return {ok:true, content:message.options.format === 'latex' ? '\\documentclass{article}\nExample' : '# Example\n', title:'Example',messageCount:4};
    }},
    scripting:{executeScript:async options=>{calls.injections.push(options);}},
    downloads:{download:async data=>{calls.downloads.push(data);}},
  };
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{calls.copies.push(text);}}});
  w.URL.createObjectURL = ()=>'blob:test';
  w.URL.revokeObjectURL = ()=>{};
  w.setTimeout = callback=>{callback();return 0;};
  Object.assign(w.chrome.tabs, overrides);
  vm.runInContext(fs.readFileSync('popup.js','utf8'),dom.getInternalVMContext());
  return {w,calls};
}
for (const format of ['markdown','latex']) {
  test(`copy ${format} uses matching source and options without downloading`, async()=>{
    const {w,calls}=popup();
    w.document.getElementById('format').value=format;
    w.document.getElementById('format').dispatchEvent(new w.Event('change'));
    assert.equal(w.document.getElementById('copyButton').textContent, format==='latex'?'Copy LaTeX':'Copy Markdown');
    w.document.getElementById('autoScroll').checked=false;
    w.document.getElementById('includeMetadata').checked=false;
    await w.exportConversation('clipboard');
    assert.equal(calls.copies.length,1);
    assert.equal(calls.copies[0],format==='latex'?'\\documentclass{article}\nExample':'# Example\n');
    assert.equal(calls.downloads.length,0);
    assert.equal(calls.requests[0].options.format,format);
    assert.equal(calls.requests[0].options.autoScroll,false);
    assert.equal(calls.requests[0].options.includeMetadata,false);
    assert.match(w.document.getElementById('status').textContent,/Copied 4 messages/);
    w.close();
  });
  test(`download ${format} still uses the correct filename and does not copy`,async()=>{
    const {w,calls}=popup();
    w.document.getElementById('format').value=format;
    await w.exportConversation('download');
    assert.equal(calls.downloads.length,1);
    assert.ok(calls.downloads[0].filename.endsWith(format==='latex'?'.tex':'.md'));
    assert.equal(calls.copies.length,0);
    w.close();
  });
}
test('clipboard failure restores controls and offers download',async()=>{
  const {w}=popup();
  w.navigator.clipboard.writeText=async()=>{throw new Error('Denied');};
  await w.exportConversation('clipboard');
  assert.match(w.document.getElementById('status').textContent,/Could not copy.*download/);
  for (const id of ['copyButton','exportButton','format','autoScroll','includeMetadata']) assert.equal(w.document.getElementById(id).disabled,false);
  w.close();
});
test('controls stay disabled while the conversation is collected',async()=>{
  let resolve;
  const {w}=popup({sendMessage:()=>new Promise(r=>{resolve=r;})});
  const pending=w.exportConversation('clipboard');
  await new Promise(r=>setImmediate(r));
  for (const id of ['copyButton','exportButton','format']) assert.equal(w.document.getElementById(id).disabled,true);
  resolve({ok:true,content:'# Done',messageCount:1});
  await pending;
  assert.equal(w.document.getElementById('copyButton').disabled,false);
  w.close();
});
test('missing content script is injected once and retried',async()=>{
  let attempts=0;
  const {w,calls}=popup({sendMessage:async()=>{
    if (++attempts===1) throw new Error('No receiving end');
    return {ok:true,content:'# Retry',messageCount:1};
  }});
  await w.exportConversation('clipboard');
  assert.equal(attempts,2);
  assert.equal(calls.injections.length,1);
  assert.equal(calls.copies[0],'# Retry');
  w.close();
});
for (const response of [{ok:false,error:'No conversation messages were found on this page.'},{ok:true,content:''}]) {
  test(`failed or empty export is not copied (${response.ok})`,async()=>{
    const {w,calls}=popup({sendMessage:async()=>response});
    await w.exportConversation('clipboard');
    assert.equal(calls.copies.length,0);
    assert.equal(calls.downloads.length,0);
    assert.equal(w.document.getElementById('copyButton').disabled,false);
    w.close();
  });
}
test('unrelated tabs are rejected',async()=>{
  const {w,calls}=popup({query:async()=>[{id:1,url:'https://example.com'}]});
  await w.exportConversation('clipboard');
  assert.equal(calls.requests.length,0);
  assert.match(w.document.getElementById('status').textContent,/Open a ChatGPT/);
  w.close();
});
