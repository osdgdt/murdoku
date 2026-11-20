// The board of the human solver step by step (src/solver/techniques/replay.js): notes, X's and placements, the way a player
// who pencils in everything the solver deduces would have them.
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { compactSteps, navigationSteps, navigationPositionOf, createReplayer } from "../src/solver/techniques/replay.js";
import { uniqueCase } from "./helpers/unique-case.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const k = (row, col) => `${row},${col}`;

export const tests = [
  {
    name: "replay: all'inizio ogni personaggio è una nota su ogni casella; un piazzamento mette il token, toglie le sue note e segna le X su riga e colonna",
    fn: () => {
      const puzzle = createPuzzle("tiny");
      puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const room = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, room.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: room.id });
      const nav = navigationSteps(compactSteps(humanSolve(puzzle).steps));
      const replay = createReplayer(puzzle, nav);
      const start = replay.goTo(0).state;
      assertEqual(start.candidates.size, 9);
      assertEqual(start.candidates.get(k(0, 0)).size, 2, "A e B in ogni casella");
      assertEqual(start.placements.size, 0);
      // the end: A in the middle, X on its row and column, and nobody's notes there any more
      const end = replay.goTo(nav.length).state;
      assertEqual(end.placements.get(a.id).row, 1);
      assert(
        end.xMarks.has(k(1, 0)) && end.xMarks.has(k(0, 1)) && end.xMarks.has(k(1, 2)) && end.xMarks.has(k(2, 1)),
        "X su riga e colonna di A"
      );
      assert(!end.candidates.has(k(1, 1)), "nessuna nota dove sta il token");
      for (const set of end.candidates.values()) assert(!set.has(a.id), "A non è più una nota da nessuna parte");
      assert(
        end.candidates.get(k(0, 0)).has(b.id) && !end.xMarks.has(k(0, 0)),
        "B resta con le sue note nelle caselle libere (il caso lascia aperta la sua casella)"
      );
    },
  },
  {
    name: "replay: i passi «riga e colonna occupate» non sono passi di navigazione, e navigationPositionOf li riporta al passo giusto",
    fn: async () => {
      const puzzle = JSON.parse(await readRepoFile("test/fixtures/monastero.en.murdoku.json"));
      const steps = compactSteps(humanSolve(puzzle).steps);
      const nav = navigationSteps(steps);
      assert(
        steps.some((s) => s.t === "rowColTaken"),
        "il caso usa «riga e colonna occupate»"
      );
      assert(
        nav.every((s) => s.t !== "rowColTaken"),
        "nessun passo di navigazione è di riga/colonna"
      );
      assert(nav.length < steps.length);
      assertEqual(nav.map((s) => s.index).join() === [...nav.map((s) => s.index)].sort((x, y) => x - y).join(), true, "in ordine");
      // from the position of a reasoning's first step on the list, the navigation lands on a step of that reasoning or later
      const first = steps.findIndex((s) => s.t === "roomCount") + 1;
      const position = navigationPositionOf(nav, first);
      assert(position >= 1 && nav[position - 1].index >= first, "il primo passo non assorbito a partire da lì");
      assertEqual(navigationPositionOf(nav, steps.length + 1), 0, "oltre l'ultimo non c'è nulla");
    },
  },
  {
    name: "replay: avanti e indietro danno lo stesso stato (punti di ripristino ogni 25 passi) e dicono le caselle del passo",
    fn: async () => {
      const puzzle = JSON.parse(await readRepoFile("test/bench/cases/tragedia-piastra-pendolina.murdoku.json"));
      const nav = navigationSteps(compactSteps(humanSolve(puzzle).steps));
      assert(nav.length >= 27, `servono più passi dei punti di ripristino (${nav.length})`);
      const fingerprint = (state) =>
        JSON.stringify([
          [...state.placements].map(([id, c]) => [id, c.row, c.col]).sort(),
          [...state.xMarks].sort(),
          [...state.candidates].map(([cell, set]) => [cell, [...set].sort()]).sort(),
        ]);
      const forward = createReplayer(puzzle, nav);
      const seen = [];
      for (let i = 0; i <= nav.length; i++) seen.push(fingerprint(forward.goTo(i).state));
      const jumpy = createReplayer(puzzle, nav);
      for (const i of [nav.length, 7, 26, 25, 24, 0, 50, 49, 3, nav.length - 1]) {
        if (i > nav.length) continue;
        assertEqual(fingerprint(jumpy.goTo(i).state), seen[i], `passo ${i}`);
      }
      const one = createReplayer(puzzle, nav);
      one.goTo(26);
      const back = one.goTo(25);
      assert(
        back.changed.length > 0 || nav[24].e === undefined,
        "tornando a un passo dopo un punto di ripristino si conoscono ancora le caselle toccate"
      );
      assertEqual(one.goTo(0).step, null);
    },
  },
  {
    name: "replay differenziale: su casi casuali a soluzione unica la cella giusta di ognuno ha sempre la sua nota e mai una X, e alla fine i piazzamenti sono la soluzione",
    fn: () => {
      let checked = 0;
      for (let seed = 2; seed <= 160; seed += 2) {
        const puzzle = uniqueCase(seed);
        if (!puzzle) continue;
        const result = humanSolve(puzzle, { maxWork: 3e6 });
        if (result.status !== "solved") continue;
        const solution = new Map(puzzle.solution.placements.map((p) => [p.characterId, { row: p.row, col: p.col }]));
        const nav = navigationSteps(compactSteps(result.steps));
        const replay = createReplayer(puzzle, nav);
        for (let i = 0; i <= nav.length; i++) {
          const { state } = replay.goTo(i);
          for (const [id, cell] of solution) {
            const here = k(cell.row, cell.col);
            assert(!state.xMarks.has(here) || state.placements.get(id), `caso ${seed} passo ${i}: X sulla cella giusta di ${id}`);
            const placed = state.placements.get(id);
            if (placed) assert(placed.row === cell.row && placed.col === cell.col, `caso ${seed} passo ${i}: ${id} piazzato male`);
            else assert(state.candidates.get(here)?.has(id), `caso ${seed} passo ${i}: la nota giusta di ${id} è sparita`);
          }
        }
        const end = replay.goTo(nav.length).state;
        assertEqual(end.placements.size, puzzle.characters.length, `caso ${seed}: tutti piazzati alla fine`);
        checked++;
      }
      assert(checked >= 20, `servono abbastanza casi (${checked})`);
    },
  },
];
