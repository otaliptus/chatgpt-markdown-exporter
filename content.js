"use strict";

const EXPORT_MESSAGE = "EXPORT_CHATGPT_MARKDOWN";
const ROLE_LABELS = {
  user: "User",
  assistant: "ChatGPT",
  system: "System",
  tool: "Tool"
};
const LATEX_SECTION_COMMANDS = ["subsection", "subsubsection", "paragraph", "subparagraph"];

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

function escapeLatexText(value) {
  return String(value || "").replace(/[\\{}$&%#_^~\u00d7\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u2248]/g, (character) => {
    const replacements = {
      "\\": "\\textbackslash{}",
      "{": "\\{",
      "}": "\\}",
      "$": "\\$",
      "&": "\\&",
      "%": "\\%",
      "#": "\\#",
      "_": "\\_",
      "^": "\\textasciicircum{}",
      "~": "\\textasciitilde{}",
      "\u00d7": "\\ensuremath{\\times}",
      "\u2013": "--",
      "\u2014": "---",
      "\u2018": "'",
      "\u2019": "'",
      "\u201c": "``",
      "\u201d": "''",
      "\u2026": "\\ldots{}",
      "\u2248": "\\ensuremath{\\approx}"
    };
    return replacements[character];
  });
}

function escapeLatexUrl(value) {
  return String(value || "").replace(/[\\{}%#]/g, (character) => {
    const replacements = {
      "\\": "\\textbackslash{}",
      "{": "\\{",
      "}": "\\}",
      "%": "\\%",
      "#": "\\#"
    };
    return replacements[character];
  });
}

function latexCommand(name, content) {
  return content ? `\\${name}{${content}}` : "";
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

function inlineLatex(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeLatexText(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tag = element.tagName.toLowerCase();

  if (element.matches(".katex-display")) {
    const latex = latexFromKatex(element);
    return latex ? `\\[\n${latex}\n\\]\n\n` : "";
  }

  if (element.matches(".katex")) {
    const latex = latexFromKatex(element);
    return latex ? `\\(${latex}\\)` : "";
  }

  if (element.matches(".katex-html, .katex-mathml")) {
    return "";
  }

  const children = Array.from(element.childNodes).map(inlineLatex).join("");

  if (tag === "br") return "\n";
  if (tag === "img") {
    const alt = normalizeWhitespace(element.getAttribute("alt") || element.getAttribute("aria-label") || "image");
    const src = element.getAttribute("src");
    return src ? latexCommand("href", `${escapeLatexUrl(absoluteUrl(src))}{${escapeLatexText(alt || src)}}`) : escapeLatexText(alt);
  }
  if (tag === "input" && element.getAttribute("type") === "checkbox") {
    return element.checked ? "$\\boxtimes$" : "$\\square$";
  }
  if (tag === "code") return latexCommand("texttt", escapeLatexText(element.textContent || ""));
  if (tag === "strong" || tag === "b") return latexCommand("textbf", children);
  if (tag === "em" || tag === "i") return latexCommand("emph", children);
  if (tag === "s" || tag === "del") return latexCommand("sout", children);
  if (tag === "a") {
    const text = normalizeWhitespace(children || escapeLatexText(element.textContent || element.href || ""));
    const href = element.getAttribute("href");
    return href ? `\\href{${escapeLatexUrl(absoluteUrl(href))}}{${text || escapeLatexText(href)}}` : text;
  }

  return children;
}

function blockLatex(node, listDepth = 0) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeLatexText(node.textContent || "");
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
    return latex ? `\\[\n${latex}\n\\]\n\n` : "";
  }

  if (element.matches(".katex")) {
    const latex = latexFromKatex(element);
    return latex ? `\\(${latex}\\)` : "";
  }

  if (tag === "pre") {
    const code = escapeLatexText(codeTextFromPre(element)).replace(/\n/g, "\\\\\n");
    return `\n\n\\begin{quote}\\ttfamily\\small\n${code}\n\\end{quote}\n\n`;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(Number(tag.slice(1)) - 1, LATEX_SECTION_COMMANDS.length - 1);
    const command = LATEX_SECTION_COMMANDS[Math.max(level, 0)];
    return `\n\n\\${command}*{${normalizeWhitespace(inlineLatex(element))}}\n\n`;
  }

  if (tag === "p") {
    return `\n\n${normalizeWhitespace(inlineLatex(element))}\n`;
  }

  if (tag === "blockquote") {
    return `\n\n\\begin{quote}\n${normalizeWhitespace(childrenLatex(element, listDepth))}\n\\end{quote}\n\n`;
  }

  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const env = ordered ? "enumerate" : "itemize";
    const start = Number.parseInt(element.getAttribute("start") || "1", 10);
    const options = ordered && Number.isFinite(start) && start > 1 ? `[start=${start}]` : "";
    const items = Array.from(element.children).filter((child) => child.tagName?.toLowerCase() === "li");
    const lines = items.map((item) => `\\item ${normalizeWhitespace(childrenLatex(item, listDepth + 1))}`);
    return `\n\n\\begin{${env}}${options}\n${lines.join("\n")}\n\\end{${env}}\n\n`;
  }

  if (tag === "table") {
    return `\n\n${tableToLatex(element)}\n\n`;
  }

  if (tag === "hr") {
    return "\n\n\\bigskip\\hrule\\bigskip\n\n";
  }

  if (tag === "details") {
    const summary = element.querySelector(":scope > summary");
    const summaryText = summary ? normalizeWhitespace(inlineLatex(summary)) : "Details";
    const clone = element.cloneNode(true);
    clone.querySelector(":scope > summary")?.remove();
    return `\n\n\\paragraph*{${summaryText}}\n${normalizeWhitespace(childrenLatex(clone, listDepth))}\n\n`;
  }

  if (["div", "section", "article", "main", "span"].includes(tag)) {
    return childrenLatex(element, listDepth);
  }

  return inlineLatex(element);
}

function childrenLatex(element, listDepth = 0) {
  return Array.from(element.childNodes)
    .filter((child) => child.nodeType !== Node.TEXT_NODE || /\S/.test(child.textContent || ""))
    .map((child) => blockLatex(child, listDepth))
    .join("");
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

function tableToLatex(table) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => normalizeWhitespace(inlineLatex(cell)))
  );

  if (!rows.length) return escapeLatexText(textFromNode(table));

  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
  const columns = Array.from({ length: width }, () => ">{\\raggedright\\arraybackslash}X").join(" | ");
  const body = normalizedRows
    .map((row, index) => {
      const line = `${row.join(" & ")} \\\\`;
      return index === 0 ? `${line}\n\\hline` : line;
    })
    .join("\n");

  return `\\begin{center}\n\\small\n\\begin{tabularx}{\\linewidth}{${columns}}\n${body}\n\\end{tabularx}\n\\end{center}`;
}

function elementToMarkdown(element) {
  const markdown = normalizeWhitespace(childrenMarkdown(element))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return markdown || textFromNode(element);
}

function elementToLatex(element) {
  const latex = normalizeWhitespace(childrenLatex(element))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return latex || escapeLatexText(textFromNode(element));
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

function formatLeadingUploadedFileLabels(body) {
  const files = [];
  let rest = body.trim();

  for (let index = 0; index < 5; index += 1) {
    const match = rest.match(/^(.+?\.[A-Za-z0-9]{1,12})File(?=\s*\S)/);
    if (!match) break;
    files.push(match[1].trim());
    rest = rest.slice(match[0].length).trimStart();
  }

  return files.length ? `${files.map((file) => `(${file})`).join("\n")}\n\n${rest}`.trim() : body;
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

function readMessagesFromDom(format = "markdown") {
  return getMessageElements()
    .map((element, index) => {
      const role = getRole(element);
      const body = getMessageBody(element, format);
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

async function collectMessagesWhileScrolling(format = "markdown") {
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

  rememberMessages(collected, readMessagesFromDom(format));

  let lastTop = -1;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const step = Math.max(Math.floor(scroller.clientHeight * 0.75), 600);
    const nextTop = Math.min(scroller.scrollTop + step, scroller.scrollHeight);
    scroller.scrollTo({ top: nextTop, behavior: "auto" });
    await sleep(180);
    rememberMessages(collected, readMessagesFromDom(format));

    const nearBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 12;
    if (nearBottom && scroller.scrollTop === lastTop) break;
    if (nearBottom) {
      await sleep(300);
      rememberMessages(collected, readMessagesFromDom(format));
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

function getMessageBody(element, format = "markdown") {
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
    if (format === "latex") {
      return markdownParts.map(elementToLatex).filter(Boolean).join("\n\n");
    }

    return demoteMessageHeadings(markdownParts.map(elementToMarkdown).filter(Boolean).join("\n\n"));
  }

  const clone = element.cloneNode(true);
  clone.querySelectorAll("button, svg, style, script, [aria-hidden='true']").forEach((node) => node.remove());
  removeChatGptTurnLabels(clone);
  if (format === "latex") {
    return formatLeadingUploadedFileLabels(elementToLatex(clone));
  }

  return demoteMessageHeadings(formatLeadingUploadedFileLabels(cleanMessageBody(elementToMarkdown(clone))));
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
    content: `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`
  };
}

function buildLatex(messages, options) {
  const title = conversationTitle();
  const lines = [
    "\\documentclass[12pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage{graphicx,amsmath,amsfonts,amssymb,amsthm,latexsym,geometry,color,hyperref}",
    "\\usepackage{array,tabularx}",
    "\\geometry{a4paper,total={450pt,700pt}}",
    "\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue,citecolor=blue}",
    "\\DeclareGraphicsExtensions{.pdf,.png,.jpg}",
    "\\setcounter{secnumdepth}{0}",
    "\\linespread{1.2}",
    "\\setlength{\\parindent}{0pt}",
    "\\providecommand{\\sout}[1]{#1}",
    "\\newcommand{\\chatrole}[1]{\\par\\bigskip\\noindent{\\Large\\textbf{#1}}\\par\\medskip}",
    "",
    `\\title{${escapeLatexText(title)}}`,
    "\\date{}",
    "",
    "\\begin{document}",
    "\\maketitle"
  ];

  if (options.includeMetadata) {
    lines.push(
      "",
      "\\begin{itemize}",
      `\\item Source: \\url{${escapeLatexUrl(absoluteUrl(location.href))}}`,
      `\\item Exported: ${escapeLatexText(new Date().toISOString())}`,
      `\\item Messages: ${messages.length}`,
      "\\end{itemize}"
    );
  }

  for (const message of messages) {
    lines.push("", `\\chatrole{${escapeLatexText(message.role)}}`, "", message.body);
  }

  lines.push("", "\\end{document}");

  return {
    title,
    content: `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`
  };
}

async function exportMarkdown(options = {}) {
  const messages = options.autoScroll ? await collectMessagesWhileScrolling("markdown") : readMessagesFromDom("markdown");

  if (!messages.length) {
    throw new Error("No conversation messages were found on this page.");
  }

  return { ...buildMarkdown(messages, options), messageCount: messages.length };
}

async function exportLatex(options = {}) {
  const messages = options.autoScroll ? await collectMessagesWhileScrolling("latex") : readMessagesFromDom("latex");

  if (!messages.length) {
    throw new Error("No conversation messages were found on this page.");
  }

  return { ...buildLatex(messages, options), messageCount: messages.length };
}

async function exportConversation(options = {}) {
  return options.format === "latex" ? exportLatex(options) : exportMarkdown(options);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== EXPORT_MESSAGE) return false;

  exportConversation(message.options)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Export failed." }));

  return true;
});
