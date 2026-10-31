# Murdoku

🌐 **Play online:** [osdgdt.github.io/murdoku](https://osdgdt.github.io/murdoku/) — nothing to install, it runs in the browser (phone or desktop) and can be installed as an app.

Murdoku is a hybrid of Sudoku and detective deduction. People are placed on a grid, **one per row and column at most**, following clues tied to a map of rooms and objects. The victim is placed too, and one rule always holds: **the victim is in a room with exactly one other person — the murderer.**

The app is available in **Italian and English** (IT/EN button, top right; it follows your browser language by default). Puzzle text written by an author (title, briefing, names, room names) stays as authored.

## How to play

1. Open **Tutorial** on the home page for a tiny guided case.
2. Pick a character from the toolbar. **Tap a cell** to jot a note (a candidate); **press and hold** a cell to place the character there; **press, hold and drag** to mark several cells at once. Placing someone crosses out the rest of their row and column.
3. Stuck? **💡 Hint** explains a certain deduction from the clues (never from a stored answer) and highlights the cell; use ‹ › to move through the chain.
4. **✓ Check solution** only says whether the case is solved — it never reveals how many placements are right.
5. After solving you can **📤 share your result** (title, time, hints — no spoilers).

## Create and share cases

- **Editor:** build the map (rooms, textures, furniture, blocked cells), add characters, and give each character clues from 40+ clue types (any clue can be negated, combined with "either/or", or be a general fact about the scene). **✓ Validate** and **? Check uniqueness** make sure the case has exactly one solution; **✂ Redundant clues** finds clues you can drop without losing uniqueness; **🧮 Compute solution** derives the answer from your clues.
- **Share:** **🔗 Share** copies a link containing the whole case (compressed, in the URL fragment — it never reaches a server). Or **⬇ Export** a `.murdoku.json` file, or **🖨 Print** it.
- **Campaigns** (sign in with Google): ordered sequences of cases with progress synced across devices. Only the site owner can create them.

Everything except campaigns works without an account, and your cases/progress live in your browser's local storage.

## Development

A static site with ES modules and **no build step**; `package.json` only holds dev tooling.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm install
npm test        # unit tests under Node (+ checks that sw.js is up to date)
npm run lint
npm run i18n    # strings still missing an English translation
npm run e2e     # Playwright: plays the tutorial in IT and EN
```

Layout: `src/model` (data, clue types, migrations) · `src/solver` (predicates, propagation, hints, validator — runs in a Web Worker) · `src/editor`, `src/player`, `src/campaign` (UI) · `src/storage` (localStorage, import/export, share links) · `src/i18n` (translations) · `examples/` (bundled cases) · `sw.js` + `manifest.webmanifest` (PWA).

Imported cases (file, `?import=<url>`, share link) are untrusted input: they are size-capped, migrated to the current schema and validated (safe ids and colors only) before anything is rendered.
