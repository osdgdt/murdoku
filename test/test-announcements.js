import { createPuzzle, addCharacter } from "../src/model/puzzle.js";
import { resizeGrid, placeObject, addZone, paintCellZone } from "../src/model/grid.js";
import { createBoardState } from "../src/player/board.js";
import { cellAriaLabel, describeBoardChange, snapshotBoard, describeSelection, describeCellContent } from "../src/player/announcements.js";
import { createEffectiveSolution } from "../src/player/effectiveSolution.js";
import { assert, assertEqual } from "./assert.js";

function scene() {
  const puzzle = createPuzzle("Annunci");
  puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
  const zone = addZone(puzzle.grid, "Cucina", "#fdd");
  paintCellZone(puzzle.grid, 0, 0, zone.id);
  placeObject(puzzle.grid, "chair", 1, 1);
  const anna = addCharacter(puzzle, "Anna");
  const bruno = addCharacter(puzzle, "Bruno", undefined, true);
  return { puzzle, anna, bruno, state: createBoardState() };
}

export const tests = [
  {
    name: "annunci: una cella vuota si legge «vuota», con oggetto dice quale",
    fn: () => {
      const { puzzle, state } = scene();
      assertEqual(cellAriaLabel("Riga 3, colonna 3", puzzle, state, 2, 2), "Riga 3, colonna 3: vuota");
      assert(/sedia/i.test(cellAriaLabel("Riga 2, colonna 2", puzzle, state, 1, 1)), "l'oggetto deve essere nominato");
    },
  },
  {
    name: "annunci: una cella dice chi c'è (e se è la vittima), la X e i nomi delle note",
    fn: () => {
      const { puzzle, anna, bruno, state } = scene();
      state.placements.set(anna.id, { row: 0, col: 0 });
      state.placements.set(bruno.id, { row: 2, col: 2 });
      assert(describeCellContent(puzzle, state, 0, 0)[0].startsWith("Anna"), "Anna è nella cella");
      assert(/vittima/.test(describeCellContent(puzzle, state, 2, 2)[0]), "la vittima è segnalata");
      state.xMarks.add("0,1");
      assertEqual(describeCellContent(puzzle, state, 0, 1)[0], "segnata con una X");
      state.candidates.set("0,2", new Set([anna.id, bruno.id]));
      assertEqual(describeCellContent(puzzle, state, 0, 2)[0], "note: Anna, Bruno");
    },
  },
  {
    name: "annunci: piazzare, spostare e togliere un personaggio sono tre frasi diverse con riga e colonna",
    fn: () => {
      const { puzzle, anna, state } = scene();
      const empty = snapshotBoard(state);
      state.placements.set(anna.id, { row: 0, col: 1 });
      const placed = snapshotBoard(state);
      assertEqual(describeBoardChange(puzzle, empty, placed), "Anna piazzato in riga 1, colonna 2");
      state.placements.set(anna.id, { row: 2, col: 0 });
      assertEqual(describeBoardChange(puzzle, placed, snapshotBoard(state)), "Anna spostato in riga 3, colonna 1");
      state.placements.delete(anna.id);
      assertEqual(
        describeBoardChange(
          puzzle,
          snapshotBoard({ ...state, placements: new Map([[anna.id, { row: 2, col: 0 }]]) }),
          snapshotBoard(state)
        ),
        "Anna tolto dalla griglia"
      );
    },
  },
  {
    name: "annunci: una X o una nota aggiunta/tolta dice quale e dove; più modifiche diventano un conteggio; nessun cambio è silenzio",
    fn: () => {
      const { puzzle, anna, state } = scene();
      const before = snapshotBoard(state);
      assertEqual(describeBoardChange(puzzle, before, snapshotBoard(state)), "", "nulla è cambiato");
      state.xMarks.add("1,2");
      assertEqual(describeBoardChange(puzzle, before, snapshotBoard(state)), "X segnata in riga 2, colonna 3");
      const withX = snapshotBoard(state);
      state.xMarks.delete("1,2");
      assertEqual(describeBoardChange(puzzle, withX, snapshotBoard(state)), "X tolta da riga 2, colonna 3");
      state.candidates.set("0,0", new Set([anna.id]));
      assertEqual(describeBoardChange(puzzle, before, snapshotBoard(state)), "Nota Anna aggiunta in riga 1, colonna 1");
      const withNote = snapshotBoard(state);
      state.candidates.delete("0,0");
      assertEqual(describeBoardChange(puzzle, withNote, snapshotBoard(state)), "Nota Anna tolta da riga 1, colonna 1");
      state.xMarks.add("0,1");
      state.xMarks.add("0,2");
      state.xMarks.add("1,0");
      assertEqual(describeBoardChange(puzzle, before, snapshotBoard(state)), "3 caselle modificate");
    },
  },
  {
    name: "annunci: selezionare un personaggio legge i suoi indizi",
    fn: () => {
      const { puzzle, anna } = scene();
      assertEqual(describeSelection(puzzle, anna, []), "Anna selezionato. Nessun indizio.");
      assertEqual(
        describeSelection(puzzle, anna, ["È in cucina.", "È accanto a una sedia."]),
        "Anna selezionato. Indizi: È in cucina. È accanto a una sedia."
      );
    },
  },
  {
    name: "soluzione di riferimento: annullare l'unica attesa ferma il calcolo e il tentativo dopo riparte da capo",
    fn: async () => {
      const { puzzle } = scene();
      let started = 0;
      let aborted = 0;
      const deps = {
        validateSolution: () => ({ valid: false }),
        checkUniquenessAsync: () => Promise.resolve({ solutionCount: 2, exhausted: true, truncated: true }),
        deriveSolutionAsync: (p, options, { signal }) => {
          started++;
          return new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => {
              aborted++;
              reject(Object.assign(new Error("annullato"), { name: "AbortError" }));
            });
            if (started > 1) resolve({ status: "unique", placements: [] });
          });
        },
      };
      const effective = createEffectiveSolution(puzzle, deps);
      const controller = new AbortController();
      const first = effective.get({ signal: controller.signal });
      controller.abort();
      let error = null;
      try {
        await first;
      } catch (err) {
        error = err;
      }
      assert(error && error.name === "AbortError", "l'attesa annullata rifiuta con AbortError");
      assertEqual(aborted, 1, "il calcolo vero è stato fermato");
      assertEqual((await effective.get()).status, "unique", "il tentativo dopo riparte");
      assertEqual(started, 2);
    },
  },
  {
    name: "soluzione di riferimento: se un altro sta ancora aspettando, annullare la propria attesa non ferma il calcolo",
    fn: async () => {
      const { puzzle } = scene();
      let aborted = 0;
      let release;
      const deps = {
        validateSolution: () => ({ valid: false }),
        checkUniquenessAsync: () => Promise.resolve({}),
        deriveSolutionAsync: (p, options, { signal }) =>
          new Promise((resolve) => {
            signal.addEventListener("abort", () => aborted++);
            release = () => resolve({ status: "unique", placements: [] });
          }),
      };
      const effective = createEffectiveSolution(puzzle, deps);
      const controller = new AbortController();
      const cancelled = effective.get({ signal: controller.signal }).catch((e) => e.name);
      const other = effective.get();
      controller.abort();
      assertEqual(await cancelled, "AbortError");
      release();
      assertEqual((await other).status, "unique");
      assertEqual(aborted, 0, "il calcolo non andava fermato");
    },
  },
];
