// `npm run bench`: how the solver does on fixed cases. Two groups:
//   - generated 10x10 - 16x16 cases (test/bench/lib.mjs makes them from a seed, so they are the same everywhere);
//   - "editor" cases (test/bench/cases/*.murdoku.json): real cases, settled to the end the way the editor's
//     "Verifica unicità" does it. They are the ones where an author waits.
// It compares with test/bench/baseline.json and FAILS when:
//   - a case the baseline settled now hits the work cap or finds a different number of solutions, or
//   - a case needs more than 25% more WORK than the baseline. Work is clue evaluations plus a charge per node
//     (see lib.mjs): it does not depend on the machine and, unlike the node count, stays comparable when the
//     search strategy changes (a node with forward checking costs ~15 times one without).
// Times are shown and compared as a warning only (they do depend on the machine): a case more than twice as
// slow per unit of work as the baseline is flagged.
// `npm run bench -- --update` rewrites the baseline (do it on purpose, after a change that should
// move the numbers, and say so in the commit).
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

globalThis.__MURDOKU_LANG__ = "it";
const { benchCase, measure } = await import("./lib.mjs");
const { migratePuzzle } = await import("../../src/model/migrations.js");
const { SETTLE_MIN_REMAINING } = await import("../../src/solver/limits.js");

const BASELINE = path.join(import.meta.dirname, "baseline.json");
const CASES_DIR = path.join(import.meta.dirname, "cases");
// The budgets are in WORK (see lib.mjs) and the strategy is the one the app uses to settle a case (src/solver/limits.js).
const WORK_CAP = 5_000_000;
const EDITOR_WORK_CAP = 200_000_000;
const STRATEGY = { maxNodes: Infinity, forwardCheckMinRemaining: SETTLE_MIN_REMAINING };
const WORK_TOLERANCE = 1.25;
export const CASES = [
  [10, [1, 3, 4, 5, 6]],
  [12, [1, 2, 3, 4, 5]],
  [14, [1, 2, 3, 4]],
  [16, [1, 2, 3, 4]],
].flatMap(([n, seeds]) => seeds.map((seed) => ({ n, seed })));

const update = process.argv.includes("--update");
let baseline = {
  version: 3,
  workCap: WORK_CAP,
  editorWorkCap: EDITOR_WORK_CAP,
  strategy: { forwardCheckMinRemaining: SETTLE_MIN_REMAINING },
  cases: [],
  editorCases: [],
};
if (!update) baseline = JSON.parse(await readFile(BASELINE, "utf8"));
const known = new Map(baseline.cases.map((c) => [`${c.n}/${c.seed}`, c]));
const knownEditor = new Map((baseline.editorCases ?? []).map((c) => [c.file, c]));

let failed = false;

// Compares one measurement with its baseline entry; returns the notes to print (and sets `failed`).
function compare(now, before) {
  const notes = [];
  if (!before || update) return notes;
  if (!before.capped && (now.capped || now.solutions !== before.solutions)) {
    failed = true;
    notes.push(
      `REGRESSIONE: prima chiuso (${before.solutions} soluzioni, lavoro ${before.work}), ora ${now.capped ? "limite raggiunto" : now.solutions + " soluzioni"}`
    );
  } else if (now.work > before.work * WORK_TOLERANCE + 200) {
    failed = true;
    notes.push(`REGRESSIONE: lavoro ${before.work} → ${now.work} (+${Math.round((now.work / before.work - 1) * 100)}%)`);
  } else if (now.work && before.work && now.ms / now.work > (2 * before.ms) / before.work && now.ms > 200) {
    notes.push("attenzione: più del doppio del tempo per unità di lavoro rispetto alla baseline (dipende dalla macchina)");
  }
  if (before.capped && !now.capped) notes.push("migliorato: ora chiuso");
  return notes;
}

const line = (label, now, before) =>
  `${label}: ${now.capped ? "limite" : now.solutions + " sol"} · ${String(now.nodes).padStart(8)} nodi · lavoro ${String(now.work).padStart(10)} · ${String(now.ms).padStart(6)} ms${
    before ? `  (baseline: ${before.capped ? "limite" : before.solutions + " sol"}, lavoro ${before.work}, ${before.ms} ms)` : ""
  }`;

const rows = [];
for (const { n, seed } of CASES) {
  const puzzle = benchCase(n, seed);
  if (!puzzle) throw new Error(`no valid solution for ${n}x${n} seed ${seed}`);
  const now = measure(puzzle, { ...STRATEGY, maxWork: WORK_CAP });
  const before = known.get(`${n}/${seed}`);
  const notes = compare(now, before);
  rows.push({ n, seed, ...now });
  console.log(line(`${String(n).padStart(2)}x${n} seed ${seed}`, now, before) + (notes.length ? "\n    " + notes.join("\n    ") : ""));
}

console.log("\ncasi da editor (come «Verifica unicità»):");
const editorRows = [];
const files = (await readdir(CASES_DIR)).filter((f) => f.endsWith(".murdoku.json")).sort();
for (const file of files) {
  const puzzle = JSON.parse(await readFile(path.join(CASES_DIR, file), "utf8"));
  migratePuzzle(puzzle);
  const now = measure(puzzle, { ...STRATEGY, maxWork: EDITOR_WORK_CAP });
  const before = knownEditor.get(file);
  const notes = compare(now, before);
  editorRows.push({ file, ...now });
  const size = `${puzzle.grid.size.rows}x${puzzle.grid.size.cols}`;
  console.log(
    line(`${file.replace(".murdoku.json", "")} (${size}, ${puzzle.clues.length} indizi)`, now, before) +
      (notes.length ? "\n    " + notes.join("\n    ") : "")
  );
}

if (update) {
  const keep = ({ solutions, capped, nodes, evaluations, work, ms }) => ({ solutions, capped, nodes, evaluations, work, ms });
  baseline.cases = rows.map((r) => ({ n: r.n, seed: r.seed, ...keep(r) }));
  baseline.editorCases = editorRows.map((r) => ({ file: r.file, ...keep(r) }));
  await writeFile(BASELINE, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`\nbaseline aggiornata: ${BASELINE}`);
} else if (failed) {
  console.error("\nIl solutore è peggiorato rispetto alla baseline (vedi REGRESSIONE sopra).");
  process.exit(1);
}
