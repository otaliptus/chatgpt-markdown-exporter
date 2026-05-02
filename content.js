"use strict";

const EXPORT_MESSAGE = "EXPORT_CHATGPT_MARKDOWN";
const ROLE_LABELS = {
  user: "User",
  assistant: "ChatGPT",
  system: "System",
  tool: "Tool"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(value) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

function fenceFor(code) {
  const matches = code.match(/`{3,}/g) || [];
  const maxLength = matches.reduce((max, item) => Math.max(max, item.length), 2);
  return "`".repeat(maxLength + 1);
}

function codeTextFromPre(pre) {
  const codeNode = pre.querySelector("code") || pre;
  const lineNodes = Array.from(codeNode.querySelectorAll(":scope > span, :scope > div, [data-line]"))
    .filter((node) => !node.querySelector(":scope > span, :scope > div, [data-line]"));

  if (lineNodes.length > 1) {
    return lineNodes.map((line) => line.innerText || line.textContent || "").join("\n").replace(/\n+$/g, "");
  }

  return (codeNode.innerText || codeNode.textContent || "").replace(/\n+$/g, "");
}

function textFromNode(node) {
  return normalizeWhitespace(node.innerText || node.textContent || "");
}

function absoluteUrl(href) {
  try {
    const url = new URL(href, location.href);
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    });
    return url.toString();
  } catch {
    return href;
  }
}

function latexFromKatex(element) {
  const annotation = element.querySelector(".katex-mathml annotation[encoding='application/x-tex']");
  return normalizeWhitespace(annotation?.textContent || "");
}

function inlineMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tag = element.tagName.toLowerCase();

  if (element.matches(".katex-display")) {
    const latex = latexFromKatex(element);
    return latex ? `\n\n$$\n${latex}\n$$\n\n` : "";
  }

  if (element.matches(".katex")) {
    const latex = latexFromKatex(element);
    return latex ? `$${latex}$` : "";
  }

  if (element.matches(".katex-html, .katex-mathml")) {
    return "";
  }

  const children = Array.from(element.childNodes).map(inlineMarkdown).join("");

  if (tag === "br") return "\n";
  if (tag === "img") {
    const alt = normalizeWhitespace(element.getAttribute("alt") || element.getAttribute("aria-label") || "image");
    const src = element.getAttribute("src");
    return src ? `![${alt}](${absoluteUrl(src)})` : alt;
  }
  if (tag === "input" && element.getAttribute("type") === "checkbox") {
    return element.checked ? "[x]" : "[ ]";
  }
  if (tag === "code") return `\`${(element.textContent || "").replace(/`/g, "\\`")}\``;
  if (tag === "strong" || tag === "b") return children ? `**${children}**` : "";
  if (tag === "em" || tag === "i") return children ? `*${children}*` : "";
  if (tag === "s" || tag === "del") return children ? `~~${children}~~` : "";
  if (tag === "a") {
    const text = normalizeWhitespace(children || element.textContent || element.href || "");
    const href = element.getAttribute("href");
    return href ? `[${text || href}](${absoluteUrl(href)})` : text;
  }

  return children;
}

function blockMarkdown(node, listDepth = 0) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tag = element.tagName.toLowerCase();

  if (element.matches("[data-testid='copy-turn-action-button'], button, svg, style, script, .katex-html, .katex-mathml")) {
    return "";
  }

  if (element.matches(".katex-display")) {
    const latex = latexFromKatex(element);
    return latex ? `\n\n$$\n${latex}\n$$\n\n` : "";
  }

  if (element.matches(".katex")) {
    const latex = latexFromKatex(element);
    return latex ? `$${latex}$` : "";
  }

  if (tag === "pre") {
    const codeNode = element.querySelector("code") || element;
    const code = codeTextFromPre(element);
    const languageClass = Array.from(codeNode.classList || []).find((className) => className.startsWith("language-"));
    const language = languageClass ? languageClass.replace(/^language-/, "") : "";
    const fence = fenceFor(code);
    return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `\n\n${"#".repeat(level)} ${normalizeWhitespace(inlineMarkdown(element))}\n\n`;
  }

  if (tag === "p") {
    return `\n\n${normalizeWhitespace(inlineMarkdown(element))}\n\n`;
  }

  if (tag === "blockquote") {
    const quote = normalizeWhitespace(childrenMarkdown(element, listDepth));
    return `\n\n${quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  }

  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const start = Number.parseInt(element.getAttribute("start") || "1", 10);
    const items = Array.from(element.children).filter((child) => child.tagName?.toLowerCase() === "li");
    const lines = items.map((item, index) => {
      const value = Number.parseInt(item.getAttribute("value") || "", 10);
      const number = Number.isFinite(value) ? value : (Number.isFinite(start) ? start : 1) + index;
      const marker = ordered ? `${number}.` : "-";
      const indent = "  ".repeat(listDepth);
      const itemText = normalizeWhitespace(childrenMarkdown(item, listDepth + 1));
      return `${indent}${marker} ${itemText.replace(/\n/g, `\n${indent}  `)}`;
    });
    return `\n${lines.join("\n")}\n`;
  }

  if (tag === "table") {
    return `\n\n${tableToMarkdown(element)}\n\n`;
  }

  if (tag === "hr") {
    return "\n\n---\n\n";
  }

  if (tag === "details") {
    const summary = element.querySelector(":scope > summary");
    const summaryText = summary ? normalizeWhitespace(inlineMarkdown(summary)) : "Details";
    const clone = element.cloneNode(true);
    clone.querySelector(":scope > summary")?.remove();
    return `\n\n<details>\n<summary>${summaryText}</summary>\n\n${normalizeWhitespace(childrenMarkdown(clone, listDepth))}\n\n</details>\n\n`;
  }

  if (["div", "section", "article", "main", "span"].includes(tag)) {
    return childrenMarkdown(element, listDepth);
  }

  return inlineMarkdown(element);
}

function childrenMarkdown(element, listDepth = 0) {
  return Array.from(element.childNodes).map((child) => blockMarkdown(child, listDepth)).join("");
}

function tableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => normalizeWhitespace(inlineMarkdown(cell)).replace(/\|/g, "\\|"))
  );

  if (!rows.length) return textFromNode(table);

  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
  const header = normalizedRows[0];
  const separator = header.map(() => "---");
  const body = normalizedRows.slice(1);
  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function elementToMarkdown(element) {
  const markdown = normalizeWhitespace(childrenMarkdown(element))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return markdown || textFromNode(element);
}

function removeChatGptTurnLabels(element) {
  Array.from(element.querySelectorAll("h1, h2, h3, h4, h5, h6")).forEach((heading) => {
    const text = normalizeWhitespace(heading.textContent || "").toLowerCase();
    if (text === "you said:" || text === "chatgpt said:") {
      heading.remove();
    }
  });
}

function cleanMessageBody(markdown) {
  return markdown
    .replace(/^#{1,6}\s+(?:You|ChatGPT) said:\s*\n+/i, "")
    .trim();
}

function demoteMessageHeadings(markdown) {
  let inFence = false;

  return markdown.split("\n").map((line) => {
    if (/^\s*`{3,}/.test(line)) {
      inFence = !inFence;
      return line;
    }

    if (inFence) return line;

    return line.replace(/^(#{1,6})(\s+)/, (_match, hashes, spacing) => {
      const level = Math.min(hashes.length + 1, 6);
      return `${"#".repeat(level)}${spacing}`;
    });
  }).join("\n");
}

function findConversationScrollContainer() {
  const candidates = [
    document.querySelector("main"),
    document.querySelector("[role='main']"),
    document.scrollingElement,
    document.documentElement
  ].filter(Boolean);

  return candidates.find((node) => node.scrollHeight > node.clientHeight + 100) || document.scrollingElement || document.documentElement;
}

function readMessagesFromDom() {
  return getMessageElements()
    .map((element, index) => {
      const role = getRole(element);
      const body = getMessageBody(element);
      const testId = element.getAttribute("data-testid");
      return {
        key: testId || `${index}:${role}:${body.slice(0, 160)}`,
        order: turnOrder(testId, index),
        role,
        body
      };
    })
    .filter((message) => message.body);
}

function turnOrder(testId, fallback) {
  const match = String(testId || "").match(/conversation-turn-(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function rememberMessages(collected, messages) {
  for (const message of messages) {
    const existing = collected.get(message.key);
    if (!existing || message.body.length > existing.body.length) {
      collected.set(message.key, message);
    }
  }
}

async function collectMessagesWhileScrolling() {
  const scroller = findConversationScrollContainer();
  const originalTop = scroller.scrollTop;
  const collected = new Map();
  let previousHeight = -1;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    scroller.scrollTo({ top: 0, behavior: "auto" });
    await sleep(250);
    if (scroller.scrollHeight === previousHeight) break;
    previousHeight = scroller.scrollHeight;
  }

  rememberMessages(collected, readMessagesFromDom());

  let lastTop = -1;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const step = Math.max(Math.floor(scroller.clientHeight * 0.75), 600);
    const nextTop = Math.min(scroller.scrollTop + step, scroller.scrollHeight);
    scroller.scrollTo({ top: nextTop, behavior: "auto" });
    await sleep(180);
    rememberMessages(collected, readMessagesFromDom());

    const nearBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 12;
    if (nearBottom && scroller.scrollTop === lastTop) break;
    if (nearBottom) {
      await sleep(300);
      rememberMessages(collected, readMessagesFromDom());
      break;
    }
    if (scroller.scrollTop === lastTop) break;
    lastTop = scroller.scrollTop;
  }

  scroller.scrollTo({ top: originalTop, behavior: "auto" });
  await sleep(100);
  return Array.from(collected.values()).sort((a, b) => a.order - b.order);
}

function getMessageElements() {
  const selectors = [
    "[data-testid^='conversation-turn-']",
    "[data-message-author-role]",
    "article"
  ];

  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector)).filter((element) => textFromNode(element));
    if (elements.length > 1) return dedupeNestedMessages(elements);
  }

  return [];
}

function dedupeNestedMessages(elements) {
  return elements.filter((element, index) => {
    return !elements.some((other, otherIndex) => otherIndex !== index && other.contains(element));
  });
}

function getRole(element) {
  const explicitRole = element.getAttribute("data-message-author-role");
  if (explicitRole) return ROLE_LABELS[explicitRole] || explicitRole;

  const childRoles = Array.from(element.querySelectorAll("[data-message-author-role]"))
    .map((node) => node.getAttribute("data-message-author-role"))
    .filter(Boolean);
  const uniqueRoles = Array.from(new Set(childRoles));
  if (uniqueRoles.length === 1) return ROLE_LABELS[uniqueRoles[0]] || uniqueRoles[0];
  if (childRoles[0]) return ROLE_LABELS[childRoles[0]] || childRoles[0];

  const text = textFromNode(element).toLowerCase();
  if (text.startsWith("you said:") || text.startsWith("you:")) return "User";
  if (element.querySelector("[data-message-author-role='assistant']")) return "ChatGPT";
  if (element.querySelector("[data-message-author-role='user']")) return "User";
  return "Message";
}

function getMessageBody(element) {
  const roleParts = element.matches("[data-message-author-role]")
    ? [element]
    : Array.from(element.querySelectorAll("[data-message-author-role]"))
        .filter((part) => !Array.from(element.querySelectorAll("[data-message-author-role]")).some((other) => other !== part && other.contains(part)));

  const parts = roleParts.length ? roleParts : [element];
  const markdownParts = parts.flatMap((part) => {
    const containers = part.matches(".markdown, [class*='markdown']")
      ? [part]
      : Array.from(part.querySelectorAll(".markdown, [class*='markdown']"));

    return containers.filter((container, index) => {
      if (!textFromNode(container)) return false;
      return !containers.some((other, otherIndex) => otherIndex !== index && other.contains(container));
    });
  });

  if (markdownParts.length) {
    return demoteMessageHeadings(markdownParts.map(elementToMarkdown).filter(Boolean).join("\n\n"));
  }

  const clone = element.cloneNode(true);
  clone.querySelectorAll("button, svg, style, script, [aria-hidden='true']").forEach((node) => node.remove());
  removeChatGptTurnLabels(clone);
  return demoteMessageHeadings(cleanMessageBody(elementToMarkdown(clone)));
}

function conversationTitle() {
  const title = document.title.replace(/\s*\|\s*ChatGPT\s*$/i, "").replace(/^ChatGPT\s*-\s*/i, "").trim();
  const heading = document.querySelector("main h1, [role='main'] h1");
  return title || textFromNode(heading || document.body).split("\n")[0].slice(0, 80) || "ChatGPT Conversation";
}

function buildMarkdown(messages, options) {
  const title = conversationTitle();
  const lines = [`# ${title}`];

  if (options.includeMetadata) {
    lines.push("", `- Source: ${absoluteUrl(location.href)}`, `- Exported: ${new Date().toISOString()}`, `- Messages: ${messages.length}`);
  }

  for (const message of messages) {
    lines.push("", `## ${message.role}`, "", message.body);
  }

  return {
    title,
    markdown: `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`
  };
}

async function exportMarkdown(options = {}) {
  const messages = options.autoScroll ? await collectMessagesWhileScrolling() : readMessagesFromDom();

  if (!messages.length) {
    throw new Error("No conversation messages were found on this page.");
  }

  return { ...buildMarkdown(messages, options), messageCount: messages.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== EXPORT_MESSAGE) return false;

  exportMarkdown(message.options)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Export failed." }));

  return true;
});
