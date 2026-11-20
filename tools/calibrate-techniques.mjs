// `node tools/calibrate-techniques.mjs [file.murdoku.json ...]`
//
// Measures the human solver (src/solver/techniques) on real cases, to check that the catalogue (catalog.js) puts the
// reasonings at the right levels:
//   - for every file: the difficulty its author declared, the level the human solver finds, the hardest reasoning it
//     needed, how many times each was used, the work and the time;
//   - `--generate [--seeds=N] [--modes=easy,medium,hard]`: for each file WITHOUT clues (the campaign cases in
//     docs/campagna-casi/ have none), picks a random solution, asks the clue generator (composer.js) for a clue set in
//     each mode and says which level the human solver gives to each set: how the generator's modes line up with the levels.
// With no file and no --generate it measures the cases shipped with the tests (test/fixtures, the benchmark case).
globalThis.__MURDOKU_LANG__ = "it";

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { LEVELS } from "../src/solver/techniques/catalog.js";
import { migratePuzzle } from "../src/model/migrations.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { proposeClueSet, withClues, rng } from "../src/solver/composer.js";
import { isOccupiable } from "../src/model/grid.js";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const generate = args.includes("--generate");
const seeds = Number(flag("seeds", 3));
const modes = flag("modes", "easy,medium,hard").split(",");
const maxWork = Number(flag("max-work", 3e7));
let files = args.filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  files = [
    ...readdirSync(path.join(root, "test/fixtures"))
      .filter((f) => f.endsWith(".murdoku.json"))
      .map((f) => path.join(root, "test/fixtures", f)),
    path.join(root, "test/bench/cases/tragedia-piastra-pendolina.murdoku.json"),
  ];
}

const load = (file) => {
  const puzzle = JSON.parse(readFileSync(file, "utf8"));
  migratePuzzle(puzzle);
  return puzzle;
};
const short = (file) => path.basename(file).replace(/\.murdoku\.json$/, "");
const countsText = (counts) =>
  Object.entries(counts)
    .map(([id, n]) => `${id}×${n}`)
    .join(" ");

function measure(puzzle) {
  const t0 = performance.now();
  const result = humanSolve(puzzle, { maxWork });
  return { result, ms: Math.round(performance.now() - t0) };
}

// A random complete arrangement that respects the base rule (the victim alone with one other person): the search tries the
// cells of every character in a shuffled order and takes the first solution.
function randomSolution(puzzle, seed) {
  const random = rng(seed);
  const cells = [];
  for (let r = 0; r < puzzle.grid.size.rows; r++)
    for (let c = 0; c < puzzle.grid.size.cols; c++) if (isOccupiable(puzzle.grid, r, c)) cells.push({ row: r, col: c });
  const shuffled = () => {
    const list = cells.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const domains = new Map(puzzle.characters.map((c) => [c.id, shuffled()]));
  const [solution] = solvePuzzle({ ...puzzle, clues: [] }, { maxSolutions: 1, domains });
  return solution ?? null;
}

if (!generate) {
  console.log(
    "caso".padEnd(34),
    "dichiarata".padEnd(11),
    "stimata".padEnd(8),
    "più difficile".padEnd(18),
    "ms".padStart(7),
    " ragionamenti"
  );
  for (const file of files) {
    const puzzle = load(file);
    const { result, ms } = measure(puzzle);
    const level = result.status === "solved" ? result.level : `(${result.status}${result.level ? `, ${result.level}` : ""})`;
    console.log(
      short(file).slice(0, 33).padEnd(34),
      String(puzzle.difficulty || "-").padEnd(11),
      String(level).padEnd(8),
      String(result.hardest ?? "-").padEnd(18),
      String(ms).padStart(7),
      " ",
      countsText(result.counts)
    );
  }
} else {
  const table = Object.fromEntries(modes.map((m) => [m, Object.fromEntries([...LEVELS, "other"].map((l) => [l, 0]))]));
  console.log(
    "caso".padEnd(30),
    "modo".padEnd(8),
    "seme",
    "indizi",
    "livello umano".padEnd(14),
    "più difficile".padEnd(18),
    " ragionamenti"
  );
  for (const file of files) {
    const base = load(file);
    for (let seed = 1; seed <= seeds; seed++) {
      const solution = randomSolution(base, seed);
      if (!solution) {
        console.log(short(file), `seme ${seed}: nessuna disposizione valida`);
        continue;
      }
      const puzzle = { ...base, clues: [], solution: { ...base.solution, placements: solution } };
      for (const mode of modes) {
        const proposal = proposeClueSet(puzzle, { mode, seed, keepExisting: false, timeMs: 30000 });
        if (proposal.status !== "ok") {
          console.log(short(file).slice(0, 29).padEnd(30), mode.padEnd(8), String(seed).padEnd(4), `generatore: ${proposal.reason}`);
          continue;
        }
        const { result } = measure(withClues(puzzle, proposal.clues));
        const level = result.status === "solved" ? result.level : "other";
        table[mode][level]++;
        console.log(
          short(file).slice(0, 29).padEnd(30),
          mode.padEnd(8),
          String(seed).padEnd(4),
          String(proposal.clues.length).padStart(6),
          String(result.status === "solved" ? result.level : `(${result.status})`).padEnd(14),
          String(result.hardest ?? "-").padEnd(18),
          countsText(result.counts)
        );
      }
    }
  }
  console.log("\nModo del generatore -> livello umano (numero di insiemi di indizi):");
  console.table(table);
}
