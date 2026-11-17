import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { computeHintChain } from "../src/solver/hints.js";
import { computeHintChainAsync, checkUniquenessAsync, deriveSolutionAsync } from "../src/solver/solverClient.js";
import { assertEqual } from "./assert.js";

export const tests = [
  {
    name: "solverClient: computeHintChainAsync (Worker reale) produce lo stesso risultato di computeHintChain in-thread",
    fn: async () => {
      const puzzle = createPuzzle("Test solver worker");
      puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });

      const currentPlacements = new Map();
      const candidates = new Map();
      const expected = computeHintChain(puzzle, currentPlacements, candidates);
      const actual = await computeHintChainAsync(puzzle, currentPlacements, candidates);
      // JSON.stringify equality is exact and sufficient here: computeHintChain's
      // output is already proven plain-JSON-safe (no Maps/Sets/functions in any
      // step), and both results come from the literal same function called with
      // identical input, so a mismatch could only mean the postMessage/
      // structured-clone round trip (Maps in, plain objects out) altered the
      // data — exactly what this test exists to catch. Not re-testing the
      // solver's own logic, already covered by the other ~200 tests.
      assertEqual(
        JSON.stringify(actual),
        JSON.stringify(expected),
        "il risultato calcolato nel Worker deve corrispondere esattamente a quello calcolato in-thread per lo stesso input"
      );
    },
  },
  {
    name: "solverClient: due richieste concorrenti (Promise.all) restituiscono ciascuna il risultato del proprio puzzle, senza scambi",
    fn: async () => {
      // Puzzle A: 2x2, 2 personaggi, nessun indizio -> 4 soluzioni reali
      // (stesso fixture già provato in test-solver.js/test-derive-solution.js).
      const puzzleA = createPuzzle("Concorrenza A");
      puzzleA.grid = resizeGrid(puzzleA.grid, 2, 2);
      addCharacter(puzzleA, "A1", "person1");
      addCharacter(puzzleA, "A2", "person2");

      // Puzzle B: 3x3, 2 personaggi, ciascuno confinato a un'unica cella via
      // una zona propria -> esattamente 1 soluzione.
      const puzzleB = createPuzzle("Concorrenza B");
      puzzleB.grid = resizeGrid(puzzleB.grid, 3, 3);
      const b1 = addCharacter(puzzleB, "B1", "person1");
      const b2 = addCharacter(puzzleB, "B2", "person2");
      const zoneB1 = addZone(puzzleB.grid, "Zona B1", "#eee");
      paintCellZone(puzzleB.grid, 0, 0, zoneB1.id);
      const zoneB2 = addZone(puzzleB.grid, "Zona B2", "#ddd");
      paintCellZone(puzzleB.grid, 1, 1, zoneB2.id);
      addClue(puzzleB, b1.id, "inRoom", { zoneId: zoneB1.id });
      addClue(puzzleB, b2.id, "inRoom", { zoneId: zoneB2.id });

      // Fired together on purpose: nothing about the pending-requests Map in
      // solverClient.js is order-dependent today, but a future "simplify to
      // a single in-flight slot" regression would silently swap these two.
      const [reportA, reportB] = await Promise.all([
        checkUniquenessAsync(puzzleA, { maxSolutions: 10 }),
        checkUniquenessAsync(puzzleB, { maxSolutions: 10 }),
      ]);
      assertEqual(reportA.solutionCount, 4, "il report di A deve riflettere il puzzle A (4 soluzioni), non essersi scambiato con B");
      assertEqual(reportB.solutionCount, 1, "il report di B deve riflettere il puzzle B (1 soluzione), non essersi scambiato con A");
    },
  },
  {
    name: "solverClient: un verdetto conclusivo (unica / nessuna soluzione) si ricorda e non si rifà; un limite non si ricorda; modificare un indizio svuota la memoria",
    fn: async () => {
      const posted = [];
      const original = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (data) {
        posted.push(data.type);
        return original.call(this, data);
      };
      try {
        const puzzle = createPuzzle("memoria dei risultati");
        puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
        const a = addCharacter(puzzle, "A", "person1");
        const b = addCharacter(puzzle, "B", "person2");
        const z1 = addZone(puzzle.grid, "Uno", "#fff");
        const z2 = addZone(puzzle.grid, "Due", "#eee");
        paintCellZone(puzzle.grid, 1, 1, z1.id);
        paintCellZone(puzzle.grid, 0, 0, z2.id);
        addClue(puzzle, a.id, "inRoom", { zoneId: z1.id });
        addClue(puzzle, b.id, "inRoom", { zoneId: z2.id });

        const first = await checkUniquenessAsync(puzzle, { maxSolutions: 2 });
        assertEqual(first.solutionCount, 1);
        assertEqual(posted.length, 1, "la prima richiesta va al Worker");
        const again = await checkUniquenessAsync(puzzle, { maxSolutions: 24, forwardCheck: true });
        assertEqual(JSON.stringify(again.solutions), JSON.stringify(first.solutions), "stesso verdetto e stessa soluzione");
        assertEqual(again.unique, true);
        assertEqual(again.exhausted, true);
        const derived = await deriveSolutionAsync(puzzle, {});
        assertEqual(derived.status, "unique");
        assertEqual(
          JSON.stringify(derived.placements),
          JSON.stringify(first.solutions[0]),
          "«Calcola soluzione» si serve della verifica già fatta"
        );
        assertEqual(posted.length, 1, "nessuna nuova ricerca per lo stesso caso");

        puzzle.title = "un altro titolo";
        puzzle.solution.placements = [];
        await checkUniquenessAsync(puzzle, { maxSolutions: 2 });
        assertEqual(posted.length, 1, "titolo e soluzione dichiarata non entrano nella chiave: il solutore non li legge");

        // a steered search (placements fixed by the caller) is a different question: never answered from memory
        await checkUniquenessAsync(puzzle, { maxSolutions: 2, fixedPlacements: new Map([[a.id, { row: 1, col: 1 }]]) });
        assertEqual(posted.length, 2, "una ricerca con piazzamenti fissati va al Worker");

        addClue(puzzle, b.id, "inRoom", { zoneId: z1.id }); // B cannot be in both rooms: no solution
        const none = await checkUniquenessAsync(puzzle, { maxSolutions: 2 });
        assertEqual(none.solutionCount, 0);
        assertEqual(none.exhausted, true);
        assertEqual(posted.length, 3, "cambiare un indizio svuota la memoria");
        await checkUniquenessAsync(puzzle, { maxSolutions: 2 });
        assertEqual(posted.length, 3, "anche «nessuna soluzione» conclusivo si ricorda");

        // a limit never becomes a verdict: asking again searches again
        const wide = createPuzzle("limite");
        wide.grid = resizeGrid(wide.grid, 6, 6);
        for (let i = 0; i < 5; i++) addCharacter(wide, `P${i}`);
        // so tight that the search stops before it has found anything: "no solution found" here is not a verdict
        const cut = await checkUniquenessAsync(wide, { maxSolutions: 2, maxWork: 50 });
        assertEqual(cut.exhausted, false);
        assertEqual(cut.solutionCount, 0, "fermata prima di trovare qualcosa");
        const before = posted.length;
        const retry = await checkUniquenessAsync(wide, { maxSolutions: 2, maxWork: 50 });
        assertEqual(posted.length, before + 1, "un risultato fermato da un limite non si ricorda");
        assertEqual(retry.exhausted, false);
      } finally {
        Worker.prototype.postMessage = original;
      }
    },
  },
];
