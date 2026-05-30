# Regex Tester

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Phase](https://img.shields.io/badge/Phase-8%2F10-blue.svg)](CLAUDE.md)
[![No Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)](#)

A pure front-end, zero-build, single-page regex testing tool. Just open `index.html` to use it.

## Features

- **10 testing modes**: Single / Multiline / Filenames / Replace / Split / Capture Groups / Compare / Unit Test (TDD) / grep / Explainer
- **Dual engine**: native JavaScript `RegExp` + XRegExp (PCRE-style), switchable
- **Match highlighting**: matches are color-highlighted; capture groups get distinct colors
- **Helpers**: preset regex library, cheatsheet, local history, performance info, multi-language code export, CSV/JSON export, match detail panel
- **Light / dark theme** toggle
- **Bilingual UI**: English by default, switch to 中文 with one click (remembered locally)
- **Performance guard**: built-in timeout circuit breaker so catastrophic backtracking can't hang the browser

## Running

Just open `index.html` in your browser. No build step, no dependency install, no local server.

> The project uses traditional `<script>` tags (no ES modules) so it works under the `file://` protocol.

## Project structure

```
regex-tester/
├── index.html              # entry page
├── assets/
│   ├── css/style.css       # theme variables + layout styles
│   └── js/
│       ├── app.js          # application entry
│       ├── i18n.js         # internationalization (English + 中文)
│       ├── engine.js       # regex engine wrapper (native + XRegExp)
│       ├── highlight.js    # highlight rendering
│       ├── storage.js      # localStorage wrapper
│       ├── export.js       # export / code generation
│       └── modes/          # one file per mode (10 total)
│           ├── single.js
│           ├── multiline.js
│           ├── files.js
│           ├── replace.js
│           ├── split.js
│           ├── capture.js
│           ├── compare.js
│           ├── unittest.js
│           ├── grep.js
│           └── explainer.js
└── data/
    ├── presets.js          # preset regex library
    ├── cheatsheet.js       # cheatsheet data
    └── samples.js          # sample filename sets
```

## Phased development plan

- [x] **Phase 1** — repo skeleton + theme styles + mode tab placeholders
- [x] **Phase 2** — core engine (compile + timeout circuit breaker) + Mode 1 (Single)
- [x] **Phase 3** — Mode 2 (Multiline with line numbers) + Mode 3 (Filenames, 5 sources + hit/miss columns)
- [x] **Phase 4** — Mode 4 (Replace) + Mode 5 (Split) + i18n (English default, 中文 toggle)
- [x] **Phase 5** — Mode 6 (Capture Groups) + Mode 7 (Compare)
- [x] **Phase 6** — Mode 8 (TDD) + Mode 9 (grep) + Mode 10 (Explainer)
- [x] **Phase 7** — XRegExp dual-engine switching
- [x] **Phase 8** — sidebar (cheatsheet / presets / history)
- [ ] **Phase 9** — export / code generation / match detail panel
- [ ] **Phase 10** — theme polish and overall finishing

## Modes

| Mode | Purpose |
|---|---|
| **Single** | Test what a regex captures from a single line of text |
| **Multiline** | Match across large text/logs, with line numbers |
| **Filenames** | Feed a set of filenames and see which the regex matches |
| **Replace** | Regex replacement with `$1 $2` backreferences, live preview |
| **Split** | Split text by a regex and visualize each segment |
| **Capture Groups** | Highlight each capture group (incl. named) in a distinct color |
| **Compare** | Run several regexes side by side on the same text |
| **Unit Test** | "Should match" / "should not match" samples, red/green feedback |
| **grep** | Like grep / grep -v: keep or exclude matching lines |
| **Explainer** | Break a regex down into plain-language descriptions |

## Language

The UI defaults to English. Click the **中文 / EN** button in the top-right to switch languages; your choice is saved to `localStorage`.

## Continuing development

This project is delivered phase by phase. The detailed architecture conventions, coding standards, and acceptance criteria for each phase live in [`CLAUDE.md`](CLAUDE.md).

If you are **Claude Code** (or another AI assistant) picking this up:
1. **Read `CLAUDE.md` in full first** — it holds all the context, decisions, and conventions.
2. Skim the existing code (`index.html` / `app.js` / `style.css` / any `modes/*.js`) for the style.
3. Implement the next unfinished phase per the acceptance checklist in `CLAUDE.md` §7.
4. Stop after each phase for user testing.

## License

[MIT](LICENSE) © itasYang
