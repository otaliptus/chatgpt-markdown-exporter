# ChatGPT Markdown Exporter

A dependency-free Chrome/Edge extension that downloads the current ChatGPT conversation as a Markdown file.

## Install

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:

   `/Users/talip/Documents/Codex/2026-05-01/code-a-web-extension-that-allows`

## Use

1. Open a conversation on `https://chatgpt.com/`.
2. Click the extension icon.
3. Leave **Load entire conversation before export** enabled for long chats.
4. Click **Download Markdown**.

## Notes

- The exporter reads the conversation from the rendered ChatGPT page. Keep the conversation tab open and avoid switching chats while it is exporting.
- It preserves headings, paragraphs, links, emphasis, lists, blockquotes, tables, and code blocks.
- Very long conversations may take a little longer because the extension scrolls through the page first to prompt ChatGPT to render all turns.
