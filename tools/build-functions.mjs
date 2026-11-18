// Copies the page's own rules module (src/community/casePolicy.js) and everything it imports into functions/shared/, keeping
// the paths (functions/shared/src/model/puzzle.js ...), so that the Cloud Functions check a case with exactly the code the
// page does. The Functions are deployed from the functions/ folder alone: they cannot import from ../src.
//   node tools/build-functions.mjs          (firebase.json runs it before every deploy; the CI runs it before the tests)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "functions", "shared");
const ENTRIES = ["src/community/casePolicy.js"];

// every relative import, static or dynamic with a string literal, followed recursively
export function closureOf(entries, base = root) {
  const files = new Set();
  const visit = (rel) => {
    if (files.has(rel)) return;
    if (!existsSync(path.join(base, rel))) throw new Error(`Manca il file importato: ${rel}`);
    files.add(rel);
    const source = readFileSync(path.join(base, rel), "utf8");
    for (const match of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g))
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), match[1])));
  };
  entries.forEach(visit);
  return [...files].sort();
}

export function buildFunctions() {
  const files = closureOf(ENTRIES);
  rmSync(target, { recursive: true, force: true });
  for (const rel of files) {
    const to = path.join(target, rel);
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(path.join(root, rel), to);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = buildFunctions();
  console.log(`functions/shared: ${files.length} file copiati da src/`);
}
