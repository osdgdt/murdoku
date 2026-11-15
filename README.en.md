# Murdoku

🌐 **Play online:** [osdgdt.github.io/murdoku](https://osdgdt.github.io/murdoku/) — nothing to install, it runs in the browser (phone or desktop) and can be installed as an app.

Murdoku is a hybrid of Sudoku and detective deduction. People are placed on a grid, **one per row and column at most**, following clues tied to a map of rooms and objects. The victim is placed too, and one rule always holds: **the victim is in a room with exactly one other person — the murderer.**

A **medieval / dark-fantasy pack** adds 17 floors (dark flagstones, runed stone, packed earth, mud, straw, ossuary, bridge planks, red damask, decorated tiles…) and 25 props in a "Medieval and fantasy" group of the editor palette: beds, benches, thrones, bearskin rugs and straw pallets can be occupied (benches and thrones are seats); barrels, chests, fireplaces, anvils, altars, statues, armor, weapon racks, cauldrons, wells, carts, sarcophagi, lecterns, banners, candelabra, cages, gravestones and crystal balls block the cell; portcullises and arrow slits sit on the edge like doors and windows. There are also 10 **medieval characters** (blacksmith, executioner, herald, thief, alchemist, archer, princess, prince, jester, bard) next to the king, queen, knight, monk, wizard and countess.

After a site update, a "A new version of the site is available" banner offers a reload: the service worker (`sw.js`) installs the new files bypassing the browser's HTTP cache (GitHub Pages keeps it for 10 minutes), and `npm run e2e:update` simulates a deploy to check it.

A room's **colour** can be changed too: pick the room and use the "Colour" row below its name: 16 named colours (terracotta, dusty blue, sage, mustard… plus red, lime, pink, cyan, blue, sand, brown, slate) and a "Custom" picker. The chip shows the colour the map will really show; the legend, the room list and the map follow by themselves, one undo step per change. Custom colours are softened by the paper skin to match the rest (same hue, the palette's saturation and lightness).

Rooms can be **renamed** in the editor: pick a room (click its coloured circle) and change its name in the "Rename room" field (Enter or click away to confirm; up to 40 characters; a blank name is refused). The new name shows at once on the map, legend, clues and print view; the id, colour, floor and cells are unchanged, so clues are untouched; one undo step per change.

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
- **Editor:** build the map (rooms with ~25 floors, furniture, doors and windows as pieces of wall shared by the two cells they lie between, blocked cells; grids from 3×3 up to **16×16**, with one character per row and column), add characters (~55 professions to pick from), and give each character clues from 40+ clue types (any clue can be negated, combined with "either/or", or be a general fact about the scene; "is in front of a window" covers the two cells a window separates; "is next to a room" means touching one of its walls from outside; you can sit on chairs and stools, not on rugs). One menu sets the **verb tense** of every clue in the case at once (present "is next to…", past "was next to…", future "will be next to…"), and the wording is always "next to", never "near". The old obsolete clue types are gone: old cases are converted automatically on load. **Writing a clue is a guided two-step flow** (a side drawer on a PC, a bottom sheet on a phone): first *what do you want to say* (plain-language families, with search), then *complete the sentence* with one control per part; targets come from grouped lists or by **tapping the board**; the board previews what the clue points at and a ✓/✗ says whether it is true in the solution you declared. Clues sit in a compact list under the board (edit, change type, duplicate, move, remove; incomplete ones are flagged), and **💡 Suggest** lists the clues that are true in your solution, one tap to add. Characters can be **renamed**, placed characters can be taken out of the solution, and the eraser removes the object first and the room only when there is nothing left to remove. **✓ Validate** and **? Check uniqueness** make sure the case has exactly one solution; every check has a node *and* a time limit that grow with the grid (as before up to 9×9, about 3× at 16×16), can be stopped with **Cancel**, and when a limit fires the message says “limit reached” — never “no solution” or “unique” unless the search really finished. The search starts from unary domains (the cells a clue excludes for that character alone) and always places the character with the fewest free cells next; a differential test (`test/test-solver-differential.js`) compares it with a deliberately plain reference search on 80 random cases. Players' hints run in a worker of their own, so they never wait for the answer key to be computed; **✂ Redundant clues** finds clues you can drop without losing uniqueness; **🧮 Compute solution** derives the answer from your clues.
- **Share:** **🔗 Share** copies a link containing the whole case (compressed, in the URL fragment — it never reaches a server). Or **⬇ Export** a `.murdoku.json` file, or **🖨 Print** it.
- **Big grids (up to 16×16):** cells shrink to 40px (56px up to 9 columns) and the board scrolls inside its area; on a phone the **✋ Move** button (shown only when the board is wider than the screen) drags the board with a finger instead of marking cells. With 10-16 characters the notes are a 4×4 box per cell, and where the cell is small (under ~50px) they become plain coloured dots in the character's fixed slot. Keys: 1-9 and 0 pick the first ten characters, **[** and **]** (or **,** and **.**) step to the previous/next one; there are 16 character colours (the first 10 unchanged). Printing shrinks cells to 34px beyond 12 columns to fit A4. A well-clued 16×16 case needs about 3-4 clues per character.
- **Campaigns** (sign in with Google): ordered sequences of cases with progress synced across devices. Only the site owner can create them. For story campaigns, any clue of a case can be **hidden until an earlier case is solved** (a padlock stands in for it; the solution is still checked against the complete case) — so each case can hand a piece of evidence to the finale. Each case can also carry an **introduction** (read before the case, with a “Start the case” button, and readable again afterwards), an **epilogue** (shown when the case is solved) and the campaign can end with a **finale**: a question and two endings the player chooses from after the last case. The texts are the author's own, one language per campaign, always shown as plain text; a blank line separates paragraphs. A complete example (plot, case sheets, ready-to-paste texts) is in `docs/campaign-story.en.md`.

**Statistics:** the game keeps on the device the **effective playing time** (counted only while the page is visible, and carried over reloads), hints, wrong checks and cases begun or left unfinished (see “Your history”). For campaign cases, a signed-in player adds to the global totals once per case (`caseStats/{campaign__case}` in Firestore: players, solves, time, hints, wrong checks) and the case list shows “average time · hints · % finish it · N players” from the third player on. The numbers are self-reported, so indicative; **republish `firestore.rules`** for the global statistics to work — without it the game carries on and the statistics simply do not appear. The rules let `caseStats/{key}` be read by key only (never listed) and written only together with the player's own marker `users/{uid}/caseStats/{key}`, with bounded increments; try them in the Rules Playground or the Firebase emulator.

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
npm run check:size  # no tracked file over 1 MB, plus a cap per kind (src JS 64 KB, CSS 48 KB, HTML 40 KB, images 150 KB, visual references 500 KB in all); prints the 10 biggest files
npm run e2e:visual  # pixel comparison of key screens (16×16 board light/dark, the clue wizard on desktop and phone, the clue list) with the references in `test/visual/`; `UPDATE_VISUAL=1` regenerates them (look at them before committing: they depend on the Chromium of whoever makes them)
npm run e2e:touch   # the phone with real touch events (CDP): the 16×16 board (Move, dragging, a note, a long press) and the clue wizard (open, pick a type, pick a target by tapping the board, scroll the sheet, targets ≥ 44 px)
npm run e2e:i18n    # in English each page loads only the dictionary areas it needs and shows English
npm run i18n        # strings missing in English + a page-by-page check that no string a page uses sits in an area the page does not load
```

The English dictionary is split by area (`src/i18n/en/*.js`) and **each page loads only its own** (`src/i18n/areas.js`: e.g. the glossary strings only on the glossary and the editor, the tutorial's only on the tutorial): an English visitor downloads about half the dictionary on the common pages, and Italian visitors load none. `npm run i18n` and a test check, page by page, that no string a page uses ends up in an area it does not load (shared strings live in `ui.js`).

Layout: `src/model` (data, clue types, migrations) · `src/solver` (predicates, propagation, hints, validator — runs in a Web Worker) · `src/editor`, `src/player`, `src/campaign` (UI) · `src/storage` (localStorage, import/export, share links) · `src/i18n` (translations) · `examples/` (bundled cases) · `sw.js` + `manifest.webmanifest` (PWA).

Imported cases (file, `?import=<url>`, share link) are untrusted input: they are size-capped, migrated to the current schema and validated (safe ids and colors only) before anything is rendered.
