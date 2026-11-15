import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone } from "../src/model/grid.js";
import { analyzePuzzle } from "../src/solver/analysis.js";
import { describeAnalysis } from "../src/editor/livePreview.js";
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
      assertEqual(describeAnalysis({ status: "ambiguous" }).tone, "warn");
      assertEqual(describeAnalysis({ status: "none" }).tone, "bad");
      assertEqual(describeAnalysis({ status: "contradiction" }).tone, "bad");
      const limit = describeAnalysis({ status: "limit" });
      assertEqual(limit.tone, "info");
      assert(!/Nessuna soluzione/.test(limit.text), "un limite non è «nessuna soluzione»");
    },
  },
];
