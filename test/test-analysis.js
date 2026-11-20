import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone } from "../src/model/grid.js";
import { analyzePuzzle } from "../src/solver/analysis.js";
import { describeAnalysis } from "../src/editor/livePreview.js";
import { benchCase } from "./bench/lib.mjs";
import { readRepoFile } from "./helpers/read-file.js";
import { assertEqual, assert } from "./assert.js";

const tutorial = async () => JSON.parse(await readRepoFile("test/fixtures/tutorial.en.murdoku.json"));

function open(n, people) {
  const puzzle = createPuzzle("open");
  puzzle.grid = resizeGrid(puzzle.grid, n, n);
  for (let i = 0; i < people; i++) addCharacter(puzzle, `P${i}`);
  return puzzle;
}

export const tests = [
  {
    name: "analisi: segnala l'avanzamento (crescente, tra 0 e 1) senza cambiare il risultato, e senza limiti non si ferma mai da sola",
    fn: () => {
      const puzzle = benchCase(10, 5);
      const seen = [];
      const heard = analyzePuzzle(puzzle, { onProgress: (f) => seen.push(f), progressIntervalMs: 0 });
      const plain = analyzePuzzle(puzzle, {});
      assertEqual(JSON.stringify(heard), JSON.stringify(plain), "stesso risultato");
      assert(seen.length > 0 && seen.every((v, i) => v >= 0 && v <= 1 && (i === 0 || v >= seen[i - 1])), `crescente (${seen.length})`);
      assertEqual(plain.stoppedBy, null, "nessun limite: finisce con una risposta, mai «limit»");
      assert(plain.status !== "limit");
    },
  },
  {
    name: "analisi: un caso con una sola soluzione porta anche il riassunto dei ragionamenti usati dal solver umano",
    fn: async () => {
      const result = analyzePuzzle(await tutorial(), { maxNodes: 100000 });
      assertEqual(result.status, "unique");
      assertEqual(result.human.status, "solved");
      assert(result.human.hardest && result.human.counts[result.human.hardest] > 0 && result.human.firstStep[result.human.hardest] > 0);
      assertEqual(analyzePuzzle(await tutorial(), { maxNodes: 100000, humanMaxWork: 1 }).human.status, "limit");
      // the steps, compact, for the board of the human shown in the editor (replay.js)
      const { trace, steps } = result.human;
      assertEqual(trace.length, steps, "un passo compatto per ogni passo");
      assert(
        trace.every((step) => step.t && step.c && (step.p || step.e)),
        "ogni passo piazza o esclude qualcosa"
      );
      assert(JSON.stringify(trace).length < 20000, "resta piccolo");
    },
  },
  {
    name: "analisi: un caso con una sola soluzione è «unique», con i nodi e le deduzioni immediate",
    fn: async () => {
      const result = analyzePuzzle(await tutorial(), { maxNodes: 100000 });
      assertEqual(result.status, "unique");
      assertEqual(result.solutionCount, 1);
      assert(result.nodes >= 0 && result.total === 4 && result.forced >= 0 && result.forced <= result.total);
    },
  },
  {
    name: "analisi: togliendo indizi restano più soluzioni («ambiguous»)",
    fn: async () => {
      const puzzle = await tutorial();
      puzzle.clues = [];
      assertEqual(analyzePuzzle(puzzle, { maxNodes: 100000 }).status, "ambiguous");
    },
  },
  {
    name: "analisi: indizi che si contraddicono danno «contradiction» o «none», mai «unique»",
    fn: async () => {
      const puzzle = await tutorial();
      const [a] = puzzle.characters;
      const z1 = addZone(puzzle.grid, "Z1", "#fdd");
      const z2 = addZone(puzzle.grid, "Z2", "#dfd");
      paintCellZone(puzzle.grid, 0, 0, z1.id);
      paintCellZone(puzzle.grid, 3, 3, z2.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: z1.id });
      addClue(puzzle, a.id, "inRoom", { zoneId: z2.id });
      const status = analyzePuzzle(puzzle, { maxNodes: 100000 }).status;
      assert(status === "contradiction" || status === "none", status);
    },
  },
  {
    name: "analisi: un limite raggiunto è «limit», non «nessuna soluzione»",
    fn: () => {
      const result = analyzePuzzle(open(6, 5), { maxNodes: 2 });
      assertEqual(result.status, "limit");
      assertEqual(result.stoppedBy, "nodes");
      assertEqual(
        analyzePuzzle(open(6, 5), { timeMs: 0 }).status === "limit" || analyzePuzzle(open(6, 5), { timeMs: 0 }).status === "ambiguous",
        true
      );
    },
  },
  {
    name: "anteprima difficoltà: le frasi dicono esattamente quello che si sa",
    fn: () => {
      const unique = describeAnalysis({ status: "unique", nodes: 40, forced: 2, total: 4 });
      assertEqual(unique.tone, "ok");
      assert(/Soluzione unica/.test(unique.text) && /40 nodi/.test(unique.text) && /2 su 4/.test(unique.text), unique.text);
      // with the human solver's answer the line names the hardest reasoning and lists every reasoning used
      const human = {
        status: "solved",
        level: "medium",
        hardest: "relationalKnown",
        counts: { clueFilter: 3, onlyCandidate: 4, relationalKnown: 1 },
        firstStep: { clueFilter: 1, onlyCandidate: 4, relationalKnown: 6 },
      };
      const withHuman = describeAnalysis({ status: "unique", nodes: 40, forced: 2, total: 4, human });
      assertEqual(withHuman.tone, "ok");
      assert(/Media/.test(withHuman.text) && /Indizio con riferimento noto/.test(withHuman.text), withHuman.text);
      assertEqual(withHuman.details.map((d) => d.id).join(","), "clueFilter,onlyCandidate,relationalKnown", "in ordine di catalogo");
      assertEqual(withHuman.details[2].first, 6);
      // a human solver that gave up leaves the rough estimate
      assert(
        /Difficoltà stimata/.test(describeAnalysis({ status: "unique", nodes: 40, forced: 2, total: 4, human: { status: "limit" } }).text)
      );
      assertEqual(describeAnalysis({ status: "ambiguous" }).tone, "warn");
      assertEqual(describeAnalysis({ status: "none" }).tone, "bad");
      assertEqual(describeAnalysis({ status: "contradiction" }).tone, "bad");
      const limit = describeAnalysis({ status: "limit" });
      assertEqual(limit.tone, "info");
      assert(!/Nessuna soluzione/.test(limit.text), "un limite non è «nessuna soluzione»");
    },
  },
];
