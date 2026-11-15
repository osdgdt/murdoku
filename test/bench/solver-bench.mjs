// `npm run bench`: how the solver does on fixed 10x10 - 16x16 cases (test/bench/lib.mjs makes them from
// a seed, so they are the same everywhere). It compares with test/bench/baseline.json and FAILS when:
//   - a case the baseline solved now hits the node cap or finds a different number of solutions, or
//   - a solved case needs more than 25% more search nodes (nodes do not depend on the machine).
// Times are shown and compared as a warning only (they do depend on the machine): a case more than
// twice as slow per node as the baseline is flagged.
// `npm run bench -- --update` rewrites the baseline (do it on purpose, after a change that should
// move the numbers, and say so in the commit).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

globalThis.__MURDOKU_LANG__ = "it";
const { benchCase, measure } = await import("./lib.mjs");

const BASELINE = path.join(import.meta.dirname, "baseline.json");
const NODE_CAP = 20000;
export const CASES = [
  [10, [1, 3, 4, 5, 6]],
  [12, [1, 2, 3, 4, 5]],
  [14, [1, 2, 3, 4]],
  [16, [1, 2, 3, 4]],
].flatMap(([n, seeds]) => seeds.map((seed) => ({ n, seed })));

const update = process.argv.includes("--update");
let baseline = { version: 1, nodeCap: NODE_CAP, cases: [] };
if (!update) baseline = JSON.parse(await readFile(BASELINE, "utf8"));
const known = new Map(baseline.cases.map((c) => [`${c.n}/${c.seed}`, c]));

const rows = [];
let failed = false;
for (const { n, seed } of CASES) {
  const puzzle = benchCase(n, seed);
  if (!puzzle) throw new Error(`no valid solution for ${n}x${n} seed ${seed}`);
  const now = measure(puzzle, { maxNodes: NODE_CAP });
  const before = known.get(`${n}/${seed}`);
  const notes = [];
  if (before && !update) {
    if (!before.capped && (now.capped || now.solutions !== before.solutions)) {
      failed = true;
      notes.push(
        `REGRESSIONE: prima chiuso (${before.solutions} soluzioni, ${before.nodes} nodi), ora ${now.capped ? "limite di nodi" : now.solutions + " soluzioni"}`
      );
    } else if (!before.capped && now.nodes > before.nodes * 1.25 + 20) {
      failed = true;
      notes.push(`REGRESSIONE: ${before.nodes} → ${now.nodes} nodi (+${Math.round((now.nodes / before.nodes - 1) * 100)}%)`);
    } else if (now.nodes && before.nodes && now.ms / now.nodes > (2 * before.ms) / before.nodes && now.ms > 200) {
      notes.push("attenzione: più del doppio del tempo per nodo rispetto alla baseline (dipende dalla macchina)");
    }
    if (before.capped && !now.capped) notes.push("migliorato: ora chiuso");
  }
  rows.push({ n, seed, ...now, notes });
  console.log(
    `${String(n).padStart(2)}x${n} seed ${seed}: ${now.capped ? "limite" : now.solutions + " sol"} · ${String(now.nodes).padStart(6)} nodi · ${String(now.ms).padStart(5)} ms${
      before ? `  (baseline: ${before.capped ? "limite" : before.solutions + " sol"}, ${before.nodes} nodi, ${before.ms} ms)` : ""
    }${notes.length ? "\n    " + notes.join("\n    ") : ""}`
  );
}

if (update) {
  baseline.cases = rows.map(({ n, seed, solutions, capped, nodes, ms }) => ({ n, seed, solutions, capped, nodes, ms }));
  await writeFile(BASELINE, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`\nbaseline aggiornata: ${BASELINE}`);
} else if (failed) {
  console.error("\nIl solutore è peggiorato rispetto alla baseline (vedi REGRESSIONE sopra).");
  process.exit(1);
}
