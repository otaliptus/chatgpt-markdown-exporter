# ChatGPT Exporter

Chrome extension for exporting ChatGPT conversations as local Markdown or LaTeX files, or copying their source directly to the clipboard.

It runs in the browser, reads the active ChatGPT conversation only when you click export, converts the rendered conversation to Markdown or LaTeX, and saves the result to your device or clipboard.

## Features

- Downloads ChatGPT conversations as `.md` or `.tex`, or copies either format directly to the clipboard.
- Works on `chatgpt.com` and `chat.openai.com`.
- Supports public shared ChatGPT conversation pages.
- Preserves common Markdown structure: headings, paragraphs, links, emphasis, lists, blockquotes, tables, images, and code blocks.
- Exports LaTeX as a compilable article with math, links, lists, code blocks, and basic tables.
- Reads rendered KaTeX source so inline and display math export cleanly.
- Handles long virtualized conversations by scrolling through the page and merging captured turns.
- No remote services, analytics, or account connection.

## Install Locally

1. Download or clone this repository.
2. Open `chrome://extensions`, `brave://extensions`, or `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder.

## Use

1. Open a ChatGPT conversation or shared conversation page.
2. Click the extension icon.
3. Choose **Markdown (.md)** or **LaTeX (.tex)**.
4. Keep **Load entire conversation before export** enabled for long conversations.
5. Click **Download Markdown** / **Download LaTeX**, or **Copy Markdown** / **Copy LaTeX**.

Downloads use the browser download flow. Copy places the same Markdown or LaTeX source on your clipboard, ready to paste into an editor. Keep the popup open until it reports success; both actions use the selected conversation-loading and metadata options.

## Permissions

The extension requests a small set of permissions:

- `activeTab`: reads the current ChatGPT tab only after the user clicks the extension.
- `downloads`: saves the generated Markdown or LaTeX file.
- `clipboardWrite`: copies the generated source after you click Copy, including after a long conversation finishes loading. It does not read your clipboard.
- `scripting`: injects the local content script into an already-open ChatGPT tab if needed.
- `https://chatgpt.com/*` and `https://chat.openai.com/*`: limits the extension to ChatGPT pages.

## Privacy

Conversation content is processed locally in the browser. The extension does not collect, transmit, sell, or share user data.

See [PRIVACY.md](PRIVACY.md).

## Development checks

Run `npm ci` and `npm test` for DOM extraction and popup regression tests. The sanitized current-layout fixture mirrors the message markers, Markdown root, and code blocks observed in ChatGPT; it contains no real conversation content. Test dependencies are not included in the extension package.

After updating an unpacked installation, reload the extension and refresh existing ChatGPT tabs.

## Build Release Zip

The Chrome Web Store upload package can be generated with:

```bash
./scripts/package.sh
```

The zip is written to `dist/`.

## Limitations

- The export is based on the rendered ChatGPT page, so the conversation tab must remain open during export.
- Extremely long conversations can take longer because the extension scrolls through the page to capture virtualized content.
- LaTeX output may require user-defined macros if the conversation contains custom TeX commands.
- Complex rendered tables or layouts may need manual cleanup in the exported file.
- Files uploaded inside a ChatGPT conversation cannot be embedded unless ChatGPT exposes a visible link or rendered representation on the page.
