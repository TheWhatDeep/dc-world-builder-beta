# CODEX — The Worldwright's Archive

A worldbuilding tool. Entities, relationships, timelines, maps, languages, and lore — all in one place. The browser app runs against a small self-hostable CODEX server that owns your data (accounts, multiple worlds, autosave, image storage).

> *Built for worldbuilders, GMs, novelists, and anyone keeping a fictional cosmos in their head.*

![Codex screenshot — replace with your own once Pages is live](docs/screenshot.png)

---

## Features

- **Nine entity types** — characters, locations, factions, artifacts, events, creatures, cultures, languages, concepts
- **Typed relationships** — 20 link types with automatic reciprocals (mark A "parent of" B, B becomes "child of" A)
- **Free-text capture + progressive structure** — write loosely, tag and link as you go; never forced to fill in schemas
- **Custom calendar & eras** — your own months, epoch suffix, and named ages on a flowing timeline
- **Cartography** — upload a map image (or use the blank canvas) and pin entities by clicking
- **Relations Web** — force-directed graph of every link, with type filters
- **Loremaster (consistency checker)** — soft warnings for anachronisms, impossible lifespans, dangling links, orphans, era overlaps, one-sided relations
- **Living Systems** — economy/scarcity tracking, auto-built genealogy trees, conlang lexicons, name/place/hook generators
- **Canon vs. draft vs. speculative** — every entity has a status, filterable everywhere
- **Branches** — snapshot whole worlds to explore alternate histories
- **Export** — PDF, HTML (standalone parchment-themed wiki with working cross-references and a table of contents), or TXT, scoped to *everything*, *canon only*, or *player-facing* (hides speculative/secret material)
- **Light & dark themes** — toggle in the topbar, saved with your world file
- **Smart notifications** — every action confirms or explains why it can't proceed

Worlds live on your CODEX server and **autosave** as you work. You can still download a
`.codex.json` backup any time (Export → raw data) and re-import it as a new world. Self-host
the server and your worlds are entirely yours.

---

## Run it locally

The app is served *by* the CODEX server (so the frontend and API share one origin). Start the
server and open it in a browser:

```bash
cd server
npm install
npm run migrate     # create the SQLite schema
npm start           # serves the app + API on http://localhost:8787
```

The first account you register becomes the administrator. See [`server/README.md`](server/README.md)
for configuration, Docker, and backups. (Opening the static files directly over
`python3 -m http.server` no longer works on its own — the app needs the API to sign in and load worlds.)

Any static server works (`npx serve`, `php -S`, VS Code Live Server, etc.).

---

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo (e.g. `codex`).
2. In the repo, go to **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to *Deploy from a branch*.
4. Pick the branch (usually `main`) and `/ (root)` as the folder.
5. Save. After a minute or two, your site is live at `https://<your-username>.github.io/codex/`.

That's it. No build step. No framework. Just files.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New entity |
| `/` | Focus search (jumps to the Codex view) |
| `T` | Toggle light / dark theme |
| `1`–`7` | Jump between views (Overview, Graph, Chronicle, Map, Systems, Loremaster, Notes) |
| `Esc` | Close the inspector or modal |

---

## File structure

```
index.html              entry point — links the CSS and JS
css/styles.css          all styling, with light & dark theme variables
js/core.js              icons, type registry, state model, helpers
js/notify.js            typed notifications + theme manager
js/shell.js             topbar, sidebar, view routing
js/views-codex.js       dashboard + codex grid + sorting
js/inspector.js         entity editor (relationships, fields, tags, lexicon)
js/graph.js             create-entity modal + force-directed graph
js/timeline.js          chronicle + calendar editor + consistency checker
js/systems.js           cartography + living systems + free codex notes
js/wiring.js            generators + view event delegation
js/persistence.js       save/load + branches
js/export.js            TXT / HTML / PDF exporters
js/seed.js              demo world ("Aetheria")
js/app.js               boot, keyboard shortcuts, init
```

Load order in `index.html` matters: `core.js` first (defines shared globals), `notify.js` second, feature files in any order after, `app.js` last.

---

## A note on saving

Your data lives in the browser tab. **Use the Save button** (top-right) regularly — it downloads a `.codex.json` file. Open it later with the Open button. The same file works on any device, in any browser, forever.

There's no auto-save by design: this is a tool you can host as a static site without storage costs and without anyone needing accounts. Your friends can use the same Pages URL and each keep their own world files locally.

---

## Tech

Vanilla HTML / CSS / JavaScript. No build step. No bundler. No dependencies except Google Fonts (Cormorant Garamond, Spectral, JetBrains Mono).

Compatible with any modern browser. Should work fine offline once loaded (fonts will fall back to local serifs).
