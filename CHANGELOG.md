# Changelog

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
