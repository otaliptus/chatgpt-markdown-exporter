const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('content.js', 'utf8');
const fixture = fs.readFileSync('tests/fixtures/current-layout.html', 'utf8');
function page(html = fixture) {
  const dom = new JSDOM(html, { url: 'https://chatgpt.com/c/test', runScripts: 'outside-only' });
  dom.window.chrome = { runtime: { onMessage: { addListener() {} } } };
  require('node:vm').runInContext(source, dom.getInternalVMContext());
  return dom.window;
}
for (const format of ['markdown', 'latex']) {
  test(`new ChatGPT layout exports complete ${format}`, async () => {
    const w = page();
    const result = await w.exportConversation({ format, includeMetadata: true });
    assert.equal(result.messageCount, 4);
    assert.match(result.content, /Complete explanation before/);
    assert.match(result.content, /and after/);
    assert.match(result.content, /Final sentence/);
    assert.match(result.content, /Second answer/);
    assert.match(result.content, /x\^2 \+ y\^2/);
    assert.match(result.content, /first line/);
    assert.match(result.content, /second line/);
    assert.doesNotMatch(result.content, /UI only|Plain text|duplicate math|ChatGPT said:|Copy message/);
    assert.deepEqual(Array.from(w.readMessagesFromDom(), m => m.role), ['User','ChatGPT','User','ChatGPT']);
    if (format === 'markdown') {
      assert.match(result.content, /`x_value`/);
      assert.match(result.content, /```\nfirst line\nsecond line\n```/);
      assert.match(result.content, /\| Example \| 42 \|/);
    } else {
      assert.match(result.content, /\\texttt\{x\\_value\}/);
      assert.match(result.content, /\\begin\{tabularx\}/);
    }
    w.close();
  });
}
test('single messages and legacy nested turn containers remain supported', () => {
  const w = page('<main><article data-testid="conversation-turn-0"><h4>You said:</h4><div data-message-author-role="user">Only message</div></article></main>');
  assert.equal(w.readMessagesFromDom().length, 1);
  assert.equal(w.readMessagesFromDom()[0].body, 'Only message');
  assert.equal(w.readMessagesFromDom()[0].role, 'User');
  w.close();
});
test('legacy shared article layout remains supported', () => {
  const w = page('<main><article>You said:<p>Hello</p></article><article><div data-message-author-role="assistant"><div class="markdown"><p>Answer</p></div></div></article></main>');
  assert.deepEqual(Array.from(w.readMessagesFromDom(), m => m.body), ['You said:\n\nHello', 'Answer']);
  w.close();
});
test('image-only message is retained', () => {
  const w = page('<main><div data-chatgpt-search-unit-key="fallback-turn-0:0:user"><button><img src="https://example.com/test.png" alt="Diagram"></button></div></main>');
  assert.match(w.readMessagesFromDom()[0].body, /!\[Diagram\]/);
  w.close();
});
test('an empty conversation reports an actionable error', async () => {
  const w = page('<main><textarea></textarea></main>');
  await assert.rejects(w.exportConversation(), /No conversation messages/);
  w.close();
});
for (const reverse of [false, true]) {
  test(`virtualized ${reverse ? 'reverse' : 'normal'} scroller captures ordered turns and restores position`, async () => {
    const w = page();
    const scroller = w.document.getElementById('thread');
    scroller.style.flexDirection = reverse ? 'column-reverse' : 'column';
    const all = [...scroller.children].map(e => e.outerHTML);
    Object.defineProperties(scroller, { scrollHeight: {value:3000}, clientHeight:{value:1000} });
    let top = reverse ? 0 : 2000;
    Object.defineProperty(scroller, 'scrollTop', {get:()=>top});
    const positions = [];
    scroller.scrollTo = ({top: next}) => {
      top = next; positions.push(next);
      const logicalTop = reverse ? top + 2000 : top;
      scroller.innerHTML = logicalTop < 1000 ? all.slice(0,2).join('') : all.slice(2).join('');
    };
    scroller.scrollTo({top});
    w.setTimeout = callback => { callback(); return 0; };
    const messages = await w.collectMessagesWhileScrolling();
    assert.equal(messages.length, 4);
    assert.deepEqual(Array.from(messages, m=>m.role), ['User','ChatGPT','User','ChatGPT']);
    assert.match(messages[0].body, /Explain/);
    assert.match(messages[3].body, /Second answer/);
    assert.ok(positions.includes(reverse ? -2000 : 0));
    assert.equal(top, reverse ? 0 : 2000);
    w.close();
  });
}
test('message identity survives changing viewport indices and expanded content', () => {
  const w = page();
  const collected = new Map();
  w.rememberMessages(collected, w.readMessagesFromDom());
  w.document.querySelector('[data-chatgpt-search-unit-key]').remove();
  w.rememberMessages(collected, w.readMessagesFromDom());
  assert.equal(collected.size, 4);
  w.close();
});
