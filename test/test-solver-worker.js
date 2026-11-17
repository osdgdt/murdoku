import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { computeHintChain } from "../src/solver/hints.js";
import {
  computeHintChainAsync,
  checkUniquenessAsync,
  deriveSolutionAsync,
  searchInSlices,
  mergeSliceReports,
  forgetSettledResults,
  SolverCancelled,
  cancelSolver,
  laneCountFor,
} from "../src/solver/solverClient.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { randomPuzzle } from "./helpers/random-puzzle.js";
import { assert, assertEqual } from "./assert.js";

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
  {
    name: "ricerca a fette (client): il risultato unito coincide con quello della ricerca singola (un caso unico fatto a mano e 40 casuali: nessuna soluzione o ambigui)",
    fn: async () => {
      let none = 0;
      let ambiguous = 0;
      // the random cases are never unique: one is built by hand (A alone fits room 1, B alone fits room 2)
      const handmade = createPuzzle("unica");
      handmade.grid = resizeGrid(handmade.grid, 3, 3);
      const ha = addCharacter(handmade, "A", "person1");
      const hb = addCharacter(handmade, "B", "person2");
      const r1 = addZone(handmade.grid, "Uno", "#fff");
      const r2 = addZone(handmade.grid, "Due", "#eee");
      paintCellZone(handmade.grid, 1, 1, r1.id);
      paintCellZone(handmade.grid, 0, 0, r2.id);
      addClue(handmade, ha.id, "inRoom", { zoneId: r1.id });
      addClue(handmade, hb.id, "inRoom", { zoneId: r2.id });
      const cases = [handmade, ...Array.from({ length: 40 }, (_, i) => randomPuzzle(i + 1))];
      for (const [index, puzzle] of cases.entries()) {
        const seed = index;
        const single = checkUniqueness(puzzle, { maxSolutions: 2, forwardCheck: true });
        const merged = await searchInSlices(puzzle, { maxSolutions: 2, forwardCheck: true }, {}, 3);
        assertEqual(merged.solutionCount, single.solutionCount, `caso ${seed}: numero di soluzioni`);
        assertEqual(merged.exhausted, single.exhausted, `caso ${seed}: exhausted`);
        assertEqual(merged.unique, single.unique, `caso ${seed}: unique`);
        assertEqual(merged.stoppedBy, single.stoppedBy, `caso ${seed}: stoppedBy`);
        if (single.solutionCount === 1)
          assertEqual(JSON.stringify(merged.solutions), JSON.stringify(single.solutions), `caso ${seed}: la soluzione unica è la stessa`);
        if (single.solutionCount === 0) none++;
        else if (single.solutionCount > 1) ambiguous++;
        else assertEqual(seed, 0, "l'unico caso a soluzione unica è quello fatto a mano");
      }
      assert(none >= 3 && ambiguous >= 3, `serve un mix di esiti (${none} senza soluzione, ${ambiguous} ambigue)`);
    },
  },
  {
    name: "ricerca a fette (client): due soluzioni trovate ovunque chiudono la ricerca (ambigua), un limite non diventa un verdetto, un'anteprima restituisce fino a maxSolutions",
    fn: async () => {
      const open = createPuzzle("aperto");
      open.grid = resizeGrid(open.grid, 4, 4);
      for (let i = 0; i < 3; i++) addCharacter(open, `P${i}`);
      const two = await searchInSlices(open, { maxSolutions: 2 }, {}, 4);
      assertEqual(two.solutionCount, 2);
      assertEqual(two.exhausted, true, "due soluzioni bastano per dire «ambigua»");
      assertEqual(two.truncated, true);
      assertEqual(new Set(two.solutions.map((x) => JSON.stringify(x))).size, 2, "due soluzioni diverse");
      // 3x3 with two people has 36 solutions: no single slice holds 24, so the reports have to be added up and cut
      const small = createPuzzle("piccolo");
      small.grid = resizeGrid(small.grid, 3, 3);
      for (let i = 0; i < 2; i++) addCharacter(small, `Q${i}`);
      const preview = await searchInSlices(small, { maxSolutions: 24 }, {}, 4);
      assertEqual(preview.solutionCount, 24, "l'anteprima chiede fino a 24 soluzioni");
      assertEqual(preview.solutions.length, 24, "e ne riceve esattamente 24, non quelle di tutte le fette");
      assertEqual(new Set(preview.solutions.map((x) => JSON.stringify(x))).size, 24, "tutte diverse");
      const cut = await searchInSlices(open, { maxSolutions: 1_000_000, maxWork: 50 }, {}, 3);
      assertEqual(cut.exhausted, false, "fermata da un limite");
      assertEqual(cut.stoppedBy, "work");
      assertEqual(cut.unique, false);
    },
  },
  {
    name: "ricerca a fette (client): annullare ferma tutte le fette e il client lavora ancora dopo; «Calcola soluzione» in parallelo dà gli stessi stati della versione singola",
    fn: async () => {
      const puzzle = createPuzzle("fette");
      puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const z1 = addZone(puzzle.grid, "Uno", "#fff");
      const z2 = addZone(puzzle.grid, "Due", "#eee");
      paintCellZone(puzzle.grid, 1, 1, z1.id);
      paintCellZone(puzzle.grid, 0, 0, z2.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: z1.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: z2.id });

      const controller = new AbortController();
      const pending = searchInSlices(puzzle, { maxSolutions: 2 }, { signal: controller.signal }, 3);
      controller.abort();
      let error = null;
      try {
        await pending;
      } catch (e) {
        error = e;
      }
      assert(error instanceof SolverCancelled && error.name === "AbortError", "annullata: rifiuta con SolverCancelled");
      const after = await searchInSlices(puzzle, { maxSolutions: 2 }, {}, 3);
      assertEqual(after.solutionCount, 1, "dopo un annullamento le fette lavorano ancora");

      forgetSettledResults();
      const derivedParallel = await deriveSolutionAsync(puzzle, { parallel: true, parallelism: 3, timeMs: 60000, maxWork: 1e9 });
      forgetSettledResults();
      const derivedSingle = await deriveSolutionAsync(puzzle, {});
      assertEqual(derivedParallel.status, "unique");
      assertEqual(JSON.stringify(derivedParallel), JSON.stringify(derivedSingle), "stesso stato e stessa soluzione");

      addClue(puzzle, b.id, "inRoom", { zoneId: z1.id }); // impossibile
      forgetSettledResults();
      assertEqual(
        (await deriveSolutionAsync(puzzle, { parallel: true, parallelism: 3, timeMs: 60000, maxWork: 1e9 })).status,
        "unsatisfiable"
      );
      const wide = createPuzzle("largo");
      wide.grid = resizeGrid(wide.grid, 4, 4);
      for (let i = 0; i < 3; i++) addCharacter(wide, `P${i}`);
      forgetSettledResults();
      assertEqual((await deriveSolutionAsync(wide, { parallel: true, parallelism: 3, timeMs: 60000, maxWork: 1e9 })).status, "ambiguous");
      forgetSettledResults();
      const limited = await deriveSolutionAsync(wide, { parallel: true, parallelism: 3, timeMs: 60000, maxWork: 1e9, maxSolutions: 2 });
      assert(limited.status === "ambiguous" || limited.status === "inconclusive", "mai «unique» per un caso largo");
    },
  },
  {
    name: "corsie (indizi superflui): due controlli insieme su worker diversi rispondono ciascuno per il proprio caso; annullare «main» ferma anche le corsie e dopo lavorano ancora",
    fn: async () => {
      const mk = (withClue) => {
        const puzzle = createPuzzle("corsia");
        puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
        const a = addCharacter(puzzle, "A", "person1");
        const z = addZone(puzzle.grid, "Uno", "#fff");
        paintCellZone(puzzle.grid, 1, 1, z.id);
        if (withClue) addClue(puzzle, a.id, "inRoom", { zoneId: z.id });
        return puzzle;
      };
      forgetSettledResults();
      const [unique, many] = await Promise.all([
        checkUniquenessAsync(mk(true), { maxSolutions: 2 }, { worker: "lane0" }),
        checkUniquenessAsync(mk(false), { maxSolutions: 2 }, { worker: "lane1" }),
      ]);
      assertEqual(unique.solutionCount, 1, "con l'indizio: una sola soluzione");
      assertEqual(many.solutionCount, 2, "senza: ambiguo (due soluzioni bastano)");

      // three searches in flight (two lanes and the main worker), cancelled at once: every one must be rejected
      // (a search is never already over here: the request has not even reached its worker yet)
      const outcomes = [
        checkUniquenessAsync(mk(true), { maxSolutions: 2 }, { worker: "lane0" }),
        checkUniquenessAsync(mk(true), { maxSolutions: 2 }, { worker: "lane1" }),
        checkUniquenessAsync(mk(true), { maxSolutions: 2 }),
      ].map((promise) =>
        promise.then(
          () => "finita",
          (e) => e
        )
      );
      cancelSolver("main");
      for (const outcome of await Promise.all(outcomes))
        assert(outcome instanceof SolverCancelled, `ogni ricerca in corso, anche sulle corsie, viene annullata (${outcome})`);
      forgetSettledResults();
      const again = await Promise.all([
        checkUniquenessAsync(mk(true), { maxSolutions: 2 }, { worker: "lane0" }),
        checkUniquenessAsync(mk(true), { maxSolutions: 2 }),
      ]);
      forgetSettledResults();
      assert(
        again.every((r) => r.solutionCount === 1),
        "dopo l'annullamento le corsie e il worker principale lavorano ancora"
      );
      const lanes = laneCountFor();
      assert(Number.isInteger(lanes) && lanes >= 1 && lanes <= 4, `numero di corsie ragionevole (${lanes})`);
      assertEqual(laneCountFor({ parallelism: 2 }), 2, "si può forzare (test)");
    },
  },
  {
    name: "mergeSliceReports: con una fetta finita e una fermata da un limite non c'è verdetto; due soluzioni bastano comunque; unica solo se tutte finiscono",
    fn: () => {
      const report = (over) => ({
        solutionCount: 0,
        unique: false,
        solutions: [],
        truncated: false,
        exhausted: true,
        stoppedBy: null,
        nodesVisited: 10,
        evaluations: 100,
        ...over,
      });
      const sol = (n) => [{ characterId: "a", row: n, col: n }];
      // one slice ended with nothing, the other was cut by the clock: "no solution" cannot be said
      const cutOne = mergeSliceReports([report({}), report({ exhausted: false, stoppedBy: "time", truncated: true })], 2);
      assertEqual(cutOne.exhausted, false);
      assertEqual(cutOne.stoppedBy, "time");
      assertEqual(cutOne.unique, false);
      assertEqual(cutOne.solutionCount, 0);
      // one solution in total and every slice ended: unique
      const oneSolution = mergeSliceReports([report({ solutionCount: 1, solutions: [sol(1)] }), report({}), report({})], 2);
      assertEqual(oneSolution.unique, true);
      assertEqual(oneSolution.exhausted, true);
      assertEqual(oneSolution.stoppedBy, null);
      // one solution but another slice was cut: found one, cannot rule out others
      const unsure = mergeSliceReports(
        [report({ solutionCount: 1, solutions: [sol(1)] }), report({ exhausted: false, stoppedBy: "work", truncated: true })],
        2
      );
      assertEqual(unsure.unique, false);
      assertEqual(unsure.exhausted, false);
      assertEqual(unsure.stoppedBy, "work");
      // two solutions anywhere settle it as ambiguous, even if a slice was cut
      const ambiguous = mergeSliceReports(
        [
          report({ solutionCount: 1, solutions: [sol(1)] }),
          report({ solutionCount: 1, solutions: [sol(2)] }),
          report({ exhausted: false, stoppedBy: "time", truncated: true }),
        ],
        2
      );
      assertEqual(ambiguous.solutionCount, 2);
      assertEqual(ambiguous.exhausted, true);
      assertEqual(ambiguous.stoppedBy, null);
      assertEqual(ambiguous.unique, false);
      // more than asked for are cut to what was asked, and the work adds up
      const many = mergeSliceReports(
        [report({ solutionCount: 2, solutions: [sol(1), sol(2)] }), report({ solutionCount: 2, solutions: [sol(3), sol(4)] })],
        3
      );
      assertEqual(many.solutions.length, 3);
      assertEqual(many.solutionCount, 3);
      assertEqual(many.nodesVisited, 20);
      assertEqual(many.evaluations, 200);
    },
  },
];
