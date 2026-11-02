# UI prototype

`index.html` is a single-file, clickable mockup of the five MVP screens
(rubric scoring, annotate & voice, peer review, teacher dashboard, student
portal). It's a design reference for [ROADMAP.md](../ROADMAP.md) — pure
HTML/CSS/JS, no build step, nothing wired to `apps/server`.

## Run it

Open it directly — no server needed:

```bash
open prototype/index.html
```

Or in VS Code: right-click `index.html` → **Open with Live Server** (if you
have the Live Server extension) for auto-reload while you edit, or just
**Reveal in Finder → double-click** to open in your default browser.

Requires internet on first load (Google Fonts). Everything else is local
state in the page — refreshing resets it.
