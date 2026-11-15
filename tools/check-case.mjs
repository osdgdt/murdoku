// `npm run check:case -- <file> [<file> …]` or `npm run check:case -- --library`
//
// Checks a case before it goes into the bundled library (and so into the daily challenge): well-formed, exactly one
// solution, the declared solution obeys every clue, no superfluous clues, a difficulty that matches what the solver
// measures, and the house rules of library cases (tools/cases/library.mjs). Give the Italian and the English file of
// a case together (`villa.it.murdoku.json villa.en.murdoku.json`) and it also checks that they are the same case.
// A language is taken from the file name (`.it.` / `.en.`), Italian otherwise. Exit status 1 if anything is an error;
// warnings are listed but do not fail.
globalThis.__MURDOKU_LANG__ = "it"; // messages of the solver's own checks are in Italian

import { readFileSync } from "node:fs";
import path from "node:path";
import { reportCase, pairProblems } from "./lib/case-report.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const langOf = (file) => (/\.en\.[^/]*$/.test(file) ? "en" : "it");
const load = (file) => JSON.parse(readFileSync(file, "utf8"));

let files = args.filter((a) => !a.startsWith("--"));
if (args.includes("--library")) {
  const index = load(path.join(root, "examples/library.json"));
  files = index.cases.flatMap((c) => [c.files.it, c.files.en]).map((f) => path.join(root, f));
  if (files.length === 0) console.log("La libreria è vuota: niente da controllare.");
}
if (files.length === 0 && !args.includes("--library")) {
  console.error("Uso: npm run check:case -- file.murdoku.json [altro.murdoku.json …]\n     npm run check:case -- --library");
  process.exit(2);
}

let failed = 0;
const puzzles = new Map();
for (const file of files) {
  let puzzle;
  try {
    puzzle = load(file);
  } catch (error) {
    console.log(`✗ ${file}\n    non riesco a leggerlo: ${error.message}`);
    failed++;
    continue;
  }
  puzzles.set(file, puzzle);
  const { errors, warnings, metrics } = await reportCase(puzzle, { lang: langOf(file) });
  console.log(`${errors.length ? "✗" : "✓"} ${path.relative(process.cwd(), file)}`);
  if (metrics.characters) {
    const parts = [`${metrics.characters} personaggi`, `${metrics.clues} indizi`];
    if (metrics.status === "unique")
      parts.push(`soluzione unica, ${metrics.nodes} nodi, ${metrics.forced} su ${metrics.characters} determinati subito`);
    console.log(`    ${parts.join(" · ")}`);
  }
  for (const e of errors) console.log(`    ✗ ${e}`);
  for (const w of warnings) console.log(`    ⚠ ${w}`);
  if (errors.length) failed++;
}

// pairs: x.it.murdoku.json + x.en.murdoku.json given together
for (const file of files.filter((f) => langOf(f) === "it" && /\.it\./.test(f))) {
  const other = file.replace(/\.it\./, ".en.");
  if (!puzzles.has(file) || !puzzles.has(other)) continue;
  const problems = pairProblems(puzzles.get(file), puzzles.get(other));
  console.log(`${problems.length ? "✗" : "✓"} ${path.basename(file).replace(/\.it\..*/, "")}: versione italiana e inglese`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  if (problems.length) failed++;
}

console.log(failed ? `\n${failed} controlli falliti.` : "\nTutto a posto.");
process.exit(failed ? 1 : 0);
