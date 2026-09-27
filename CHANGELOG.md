# Changelog

## 1.2.0 - 2026-09-27

- Fixed “No conversation messages were found” on ChatGPT's updated conversation layout.
- Preserved full message text with the new Markdown renderer, including inline code, code blocks, and math.
- Fixed full-conversation loading in nested, reverse-scrolling thread containers.
- Added Copy Markdown and Copy LaTeX using the selected export options.
- Added clipboard-write permission; the extension never reads clipboard content.
- Added regression tests for current and legacy layouts, virtualized scrolling, and popup copy/download flows.

## 1.1.2 - 2026-05-06

- Fixed exports for ChatGPT messages containing uploaded images.
- Preserved image thumbnails that ChatGPT wraps in buttons or file preview controls.
- Improved Markdown and LaTeX spacing around exported image links and prompts.
- Fixed LaTeX image links to use valid `\href{url}{label}` syntax.

## 1.1.1 - 2026-05-02

- Fixed LaTeX table exports so wide tables wrap within the page width.
- Improved LaTeX portability by removing unused packages and escaping common Unicode punctuation.
- Changed LaTeX code block export to avoid raw verbatim content that can break compilation.

## 1.1.0 - 2026-05-02

- Added LaTeX export support.
- Added export format selector for Markdown and LaTeX.
- Improved Markdown math extraction from KaTeX-rendered formulas.
- Removed ChatGPT UI turn labels from exported user messages.
- Preserved code block line breaks.
- Cleaned tracking parameters from exported links.

## 1.0.0 - 2026-05-01

- Initial release.
- Exports ChatGPT and ChatGPT shared conversations to Markdown.
- Preserves rendered headings, paragraphs, links, emphasis, lists, blockquotes, tables, images, and code blocks.
- Scrolls through long virtualized conversations and merges captured turns to avoid missing rendered content.
