// The progress estimate of a search (solver.js `onProgress`): what the bar in the editor and in the player shows.
// It must never mislead: between 0 and 1, never going back, no effect whatsoever on what the search finds, and
// close to the truth often enough to be worth showing.
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone } from "../src/model/grid.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { deriveSolution } from "../src/solver/deriveSolution.js";
import { computeHintChain, waveProgress } from "../src/solver/hints.js";
import { involvedCluesViaLeaveOneOut } from "../src/solver/hintExplain.js";
import { createBudget } from "../src/solver/hintBudget.js";
import { benchCase } from "./bench/lib.mjs";
import { assert, assertEqual } from "./assert.js";

// n x n, `people` characters, no clues: every placement is a solution, so the whole tree is walked
function open(n, people) {
  const puzzle = createPuzzle(`open ${n}`);
  puzzle.grid = resizeGrid(puzzle.grid, n, n);
  for (let i = 0; i < people; i++) addCharacter(puzzle, `P${i}`);
  return puzzle;
}

// The whole tree is walked and no solution is ever kept: "exactly one person in a room that has no cells" can only be
// judged once everybody is placed, and then it is always false. Every level has the same number of children
// ((n-level)^2 free cells for any character), so how much of the tree a report stands for is known exactly.
function barren(n, people) {
  const puzzle = open(n, people);
  const nowhere = addZone(puzzle.grid, "Nessuna cella", "#ffffff");
  addClue(puzzle, null, "exactlyOneInRoom", { zoneId: nowhere.id });
  return puzzle;
}

// 7x7, four people; the first one (and so the root of the search: fewest free cells) can only be in 2 cells.
function narrowRoot() {
  const puzzle = open(7, 4);
  const pair = addZone(puzzle.grid, "Due celle", "#eeeeee");
  paintCellZone(puzzle.grid, 0, 0, pair.id);
  paintCellZone(puzzle.grid, 1, 1, pair.id);
  addClue(puzzle, puzzle.characters[0].id, "inRoom", { zoneId: pair.id });
  return puzzle;
}

const everyTime = { progressIntervalMs: 0 };
const never = (values) => values.every((v, i) => v >= 0 && v <= 1 && (i === 0 || v >= values[i - 1]));

export const tests = [
  {
    name: "progresso: su un albero uniforme (6x6, 4 persone, nessuna soluzione) parte da quasi 0, cresce senza tornare indietro e finisce a quasi 1",
    fn: () => {
      const puzzle = barren(6, 4);
      const seen = [];
      const stats = {};
      const found = solvePuzzle(puzzle, { maxSolutions: 5, stats, onProgress: (f) => seen.push(f), ...everyTime });
      assertEqual(found.length, 0, "premessa: nessuna soluzione, ma l'albero viene percorso tutto");
      assert(stats.nodesVisited > 100000, `premessa: albero intero (${stats.nodesVisited} nodi)`);
      assert(seen.length > 300, `molte segnalazioni (${seen.length})`);
      assert(never(seen), "sempre tra 0 e 1 e mai all'indietro");
      // 256 nodes in: at most 256 of the 129600 leaves are done, so the first report must still be tiny
      assert(seen[0] < 0.01, `la prima segnalazione è vicina a 0 (${seen[0]})`);
      assert(seen[seen.length - 1] > 0.99, `l'ultima è vicina a 1 (${seen[seen.length - 1]})`);
      // the tree is uniform, so the estimate is the share of leaves done: halfway through the reports, about half the nodes
      const middle = seen[Math.floor(seen.length / 2)];
      assert(middle > 0.4 && middle < 0.6, `a metà delle segnalazioni siamo a metà (${middle})`);
    },
  },
  {
    name: "progresso: va da 0 a 1 senza mai tornare indietro, arriva vicino a 1 a ricerca finita e non cambia ciò che la ricerca trova",
    fn: () => {
      const puzzle = open(5, 3);
      const seen = [];
      const statsWith = {};
      const withProgress = solvePuzzle(puzzle, { maxSolutions: 1e6, stats: statsWith, onProgress: (f) => seen.push(f), ...everyTime });
      const statsPlain = {};
      const plain = solvePuzzle(puzzle, { maxSolutions: 1e6, stats: statsPlain });
      assert(seen.length >= 10, `almeno una decina di segnalazioni (${seen.length})`);
      assert(never(seen), "sempre tra 0 e 1 e mai all'indietro");
      assert(seen[seen.length - 1] > 0.9, `a fine ricerca è vicino a 1 (${seen[seen.length - 1]})`);
      assert(seen[0] < 0.2, `all'inizio è vicino a 0 (${seen[0]})`);
      assertEqual(JSON.stringify(withProgress), JSON.stringify(plain), "stesse soluzioni, nello stesso ordine");
      assertEqual(statsWith.nodesVisited, statsPlain.nodesVisited, "stessi nodi");
      assertEqual(statsWith.evaluations, statsPlain.evaluations, "stesso lavoro");
    },
  },
  {
    name: "progresso: con le fette ogni fetta riporta la posizione nell'albero intero (crescente), e con il controllo in avanti vale lo stesso",
    fn: () => {
      const puzzle = narrowRoot();
      for (const forwardCheck of [false, true]) {
        const lasts = [];
        for (let index = 0; index < 3; index++) {
          const seen = [];
          solvePuzzle(puzzle, {
            maxSolutions: 1e6,
            forwardCheck,
            slice: { index, count: 3 },
            onProgress: (f) => seen.push(f),
            ...everyTime,
          });
          assert(seen.length >= 5, "la fetta riporta");
          assert(never(seen), `fetta ${index} (controllo in avanti ${forwardCheck}): mai all'indietro`);
          lasts.push(seen[seen.length - 1]);
        }
        assert(
          Math.max(...lasts) - Math.min(...lasts) < 0.2,
          `le fette riportano quasi lo stesso numero (${lasts.map((x) => x.toFixed(2))})`
        );
        assert(Math.min(...lasts) > 0.8, "e a fine ricerca è vicino a 1");
      }
    },
  },
  {
    name: "progresso: da un caso vero (10x10) le segnalazioni sono crescenti, e checkUniqueness e deriveSolution le passano",
    fn: () => {
      const puzzle = benchCase(10, 5);
      const viaCheck = [];
      const report = checkUniqueness(puzzle, { maxSolutions: 2, forwardCheck: true, onProgress: (f) => viaCheck.push(f), ...everyTime });
      assertEqual(report.solutionCount >= 1, true);
      assert(viaCheck.length > 0 && never(viaCheck), `checkUniqueness segnala e non torna indietro (${viaCheck.length})`);
      const viaDerive = [];
      const derived = deriveSolution(puzzle, { onProgress: (f) => viaDerive.push(f), ...everyTime });
      assert(["unique", "ambiguous", "unsatisfiable"].includes(derived.status), "il verdetto non cambia");
      assert(viaDerive.length > 0 && never(viaDerive), `deriveSolution segnala e non torna indietro (${viaDerive.length})`);
    },
  },
  {
    name: "progresso: senza `onProgress` non si chiama niente, e con l'intervallo predefinito (100 ms) non si segnala più spesso di così",
    fn: () => {
      const puzzle = open(6, 4);
      const calls = [];
      const started = performance.now();
      solvePuzzle(puzzle, { maxSolutions: 1e6, onProgress: (f) => calls.push([f, performance.now()]) });
      const elapsed = performance.now() - started;
      assert(
        calls.length <= Math.ceil(elapsed / 100) + 1,
        `al più una segnalazione ogni 100 ms (${calls.length} in ${Math.round(elapsed)} ms)`
      );
      for (let i = 1; i < calls.length; i++) assert(calls[i][1] - calls[i - 1][1] >= 90, "distanziate di circa 100 ms");
      assertEqual(solvePuzzle(open(4, 2), { maxSolutions: 1e6 }).length, 144, "senza callback funziona come sempre");
    },
  },
  {
    name: "progresso dei suggerimenti: le ondate si dividono la barra senza mai tornare indietro (la prima ne copre quasi tutta), la spiegazione ha il resto",
    fn: () => {
      let last = -1;
      for (let wave = 0; wave < 8; wave++) {
        for (let step = 0; step <= 10; step++) {
          const value = waveProgress(wave, step / 10);
          assert(value >= last - 1e-12, `ondata ${wave}, ${step * 10}%: ${value} non torna indietro (prima ${last})`);
          assert(value < 0.7 + 1e-12, "le ondate non superano la loro parte (70 %)");
          last = value;
        }
      }
      assert(Math.abs(waveProgress(0, 1) - waveProgress(1, 0)) < 1e-12, "finita un'ondata, la prossima parte da lì");
      assert(waveProgress(0, 1) > 0.5, "la prima ondata ne copre la maggior parte");
    },
  },
  {
    name: "progresso dei suggerimenti: la catena segnala (0..1, crescente) e dà gli stessi passi di prima, con o senza budget",
    fn: () => {
      const puzzle = createPuzzle("suggerimenti");
      puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const plain = computeHintChain(puzzle, new Map());
      const seen = [];
      const heard = computeHintChain(puzzle, new Map(), new Map(), { onProgress: (f) => seen.push(f) });
      assertEqual(JSON.stringify(heard), JSON.stringify(plain), "ascoltare l'avanzamento non cambia i passi");
      assert(seen.length >= 1 && never(seen), `segnala e non torna indietro (${seen})`);
      const unlimited = computeHintChain(puzzle, new Map(), new Map(), { unlimited: true });
      assertEqual(JSON.stringify(unlimited), JSON.stringify(plain), "senza budget, quando il budget non serviva, stessi passi");
    },
  },
  {
    name: "budget dei suggerimenti: «illimitato» non ha scadenza né tetto di nodi per i fatti (la spiegazione resta a budget piccolo), quello normale sì; la spiegazione segnala un passo per ogni ricerca",
    fn: () => {
      const puzzle = open(9, 3);
      const limited = createBudget(puzzle);
      const free = createBudget(puzzle, { unlimited: true });
      assertEqual(free.deadline, null);
      assertEqual(free.expired(), false);
      assertEqual(free.waveNodesFor(150000), Infinity);
      free.spendWaveNodes(10 ** 12);
      assertEqual(free.waveNodesFor(150000), Infinity, "spendere non lo esaurisce");
      assertEqual(free.involvedNodesFor(10 ** 9), 150000, "la spiegazione degli indizi coinvolti ha invece sempre il suo budget piccolo");
      free.spendInvolvedClueNodes(150000 - 5);
      assertEqual(free.involvedNodesFor(10 ** 9), 5, "e si esaurisce (poi ripiega sulla risposta prudente)");
      assertEqual(limited.waveNodesFor(150000), 150000);
      limited.spendWaveNodes(limited.waveNodesRemaining - 7);
      assertEqual(limited.waveNodesFor(150000), 7, "quello normale si esaurisce");
      assert(Number.isFinite(limited.deadline), "e ha una scadenza");

      const small = createPuzzle("spiegazione");
      small.grid = resizeGrid(small.grid, 3, 3);
      const a = addCharacter(small, "A", "person1");
      addCharacter(small, "B", "person2");
      const zone = addZone(small.grid, "Studio", "#fff");
      paintCellZone(small.grid, 1, 1, zone.id);
      addClue(small, a.id, "inRoom", { zoneId: zone.id });
      addClue(small, a.id, "inRowOrCol", { axis: "row", index: 2 });
      let ticks = 0;
      involvedCluesViaLeaveOneOut(
        small,
        new Map(),
        { type: "forcedPlacement", characterId: a.id, row: 1, col: 1 },
        createBudget(small, { unlimited: true }),
        () => ticks++
      );
      assert(ticks >= small.clues.length, `un passo per ogni indizio rimosso e riprovato (${ticks})`);
    },
  },
];
