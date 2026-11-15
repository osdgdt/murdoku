// `npm run i18n`: lists user-facing Italian strings that have no English
// entry yet. Scans t("...") calls in src/ and visible text in the .html pages.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import en from "../src/i18n/en.js";
import { checkPageAreas, knownPages } from "./lib/i18n-pages.mjs";
import { PAGE_AREAS } from "../src/i18n/areas.js";

const root = path.resolve(import.meta.dirname, "..");
const IGNORED = new Set(["EN", "IT", "🔎 Murdoku", "github.com/osdgdt/murdoku/issues"]);
const missing = new Map();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    statSync(full).isDirectory() ? walk(full, out) : out.push(full);
  }
  return out;
}

const unescape = (s) => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");

for (const file of walk(path.join(root, "src")).filter((f) => f.endsWith(".js") && !f.includes("/i18n/"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g)) {
    const key = unescape(m[1].slice(1, -1));
    if (!(key in en)) missing.set(key, path.relative(root, file));
  }
}
for (const file of readdirSync(root).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(path.join(root, file), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  for (const m of html.matchAll(/>([^<>]+)</g)) {
    const key = m[1].trim().replace(/\s+/g, " ");
    if (key.length > 1 && /[A-Za-zÀ-ú]{2}/.test(key) && !IGNORED.has(key) && !(key in en)) missing.set(key, file);
  }
  for (const m of html.matchAll(/\b(?:title|placeholder|aria-label|alt)="([^"]+)"/g)) {
    const key = m[1].trim();
    if (/[A-Za-zÀ-ú]{3}/.test(key) && !(key in en)) missing.set(key, file);
  }
}

for (const [key, file] of missing) console.log(`${file}: ${JSON.stringify(key)}`);
console.log(`\n${missing.size} stringhe senza traduzione inglese.`);

// Each page loads only some areas of the dictionary (src/i18n/areas.js): a string used by a page but translated
// only in an area the page does not load would show in Italian. That is an error, not a listing.
const pageProblems = await checkPageAreas();
for (const p of pageProblems) console.log(`${p.page}: ${JSON.stringify(p.key)} (usato in ${p.file}) è solo nell'area «${p.area}», che questa pagina non carica`);
const unlisted = knownPages().filter((page) => !(page in PAGE_AREAS));
if (unlisted.length) console.log(`Pagine non elencate in src/i18n/areas.js (caricano tutto, va bene ma non sono verificate): ${unlisted.join(", ")}`);
console.log(`${pageProblems.length} stringhe fuori dalle aree della loro pagina.`);
process.exit((process.argv.includes("--strict") && missing.size) || pageProblems.length ? 1 : 0);
