# Murdoku

🌐 **Play online:** [osdgdt.github.io/murdoku](https://osdgdt.github.io/murdoku/) — nothing to install, it runs in the browser (phone or desktop) and can be installed as an app.

Murdoku is a hybrid of Sudoku and detective deduction. People are placed on a grid, **one per row and column at most**, following clues tied to a map of rooms and objects. The victim is placed too, and one rule always holds: **the victim is in a room with exactly one other person — the murderer.**

The app is available in **Italian and English** (IT/EN button, top right; it follows your browser language by default). Puzzle text written by an author (title, briefing, names, room names) stays as authored.

## How to play

1. Pick a case from the player (or import a `.murdoku.json` file) and start from the toolbar.
2. Pick a character from the toolbar. **Tap a cell** to jot a note (a candidate); **press and hold** a cell to place the character there; **press, hold and drag** to mark several cells at once. Placing someone crosses out the rest of their row and column.
3. **Click a character** in the toolbar to light up, in gold, every cell their clues point at (a whole room, every plant…); hovering shows only the cells that fit all their clues together.
4. Stuck? **💡 Hint** explains a certain deduction from the clues (never from a stored answer) and highlights the cell; use ‹ › to move through the chain.
5. **✓ Check solution** only says whether the case is solved — it never reveals how many placements are right.
6. After solving you can **📤 share your result** (title, time, hints — no spoilers).

The **tutorial** (`tutorial.html`, “How to play”, linked from the home page and under the board while playing) teaches the rules by solving a small original case step by step, then covers the objects, three strategy tricks and the app's gestures. The case and its deduction are computed with the solver's own rules (`src/tutorial/tutorialCase.js`), and a test keeps the page's story true.

## Create and share cases

- **Clue glossary:** `glossary.html` (linked from the home page and under the board while playing) explains every clue type in plain words, with the sentence as the game words it and a mini board: for clues about a character the green cells are where the clue holds; general clues show the same scene once true and once false. The examples are real little cases judged by the solver's own rules, so they can't drift from the game.
- **Editor:** build the map (rooms with ~25 floors, furniture, doors and windows set on one side of a cell, blocked cells), add characters (~55 professions to pick from), and give each character clues from 40+ clue types (any clue can be negated, combined with "either/or", or be a general fact about the scene; "is in front of a window" covers the two cells a window separates; "is next to a room" means touching one of its walls from outside; you can sit on chairs and stools, not on rugs). One menu sets the **verb tense** of every clue in the case at once (present "is next to…", past "was next to…", future "will be next to…"), and the wording is always "next to", never "near". The old obsolete clue types are gone: old cases are converted automatically on load. **✓ Validate** and **? Check uniqueness** make sure the case has exactly one solution; **✂ Redundant clues** finds clues you can drop without losing uniqueness; **🧮 Compute solution** derives the answer from your clues.
- **Share:** **🔗 Share** copies a link containing the whole case (compressed, in the URL fragment — it never reaches a server). Or **⬇ Export** a `.murdoku.json` file, or **🖨 Print** it.
- **Campaigns** (sign in with Google): ordered sequences of cases with progress synced across devices. Only the site owner can create them.

Campaign admins: the original owner's uid stays hard-coded in `firestore.rules` (so a misconfiguration can never lock the owner out); to add another admin, create a document `admins/<uid>` by hand in the Firebase console (clients cannot write it), then publish `firestore.rules`.

Everything except campaigns works without an account, and your cases/progress live in your browser's local storage.

## Development

A static site with ES modules and **no build step**; `package.json` only holds dev tooling.

```bash
python3 -m http.server 8000   # then open http://localhost:8000 (on Windows, double-click `Avvia Murdoku.bat`: same server on port 8123, opens the browser)
npm install
npm test        # unit tests under Node (+ checks that sw.js is up to date)
npm run lint
npm run format  # Prettier check (use `npx prettier --write` to fix)
npm run i18n    # strings still missing an English translation
npm run e2e     # Playwright: plays a fixture case (`test/fixtures`) in IT and EN
npm run e2e:all # + accessibility (axe), editor and gameplay gestures
npm run check:size  # no tracked file over 1 MB
```

Layout: `src/model` (data, clue types, migrations) · `src/solver` (predicates, propagation, hints, validator — runs in a Web Worker) · `src/editor`, `src/player`, `src/campaign` (UI) · `src/storage` (localStorage, import/export, share links) · `src/i18n` (translations) · `examples/` (bundled cases) · `sw.js` + `manifest.webmanifest` (PWA).

Imported cases (file, `?import=<url>`, share link) are untrusted input: they are size-capped, migrated to the current schema and validated (safe ids and colors only) before anything is rendered.
