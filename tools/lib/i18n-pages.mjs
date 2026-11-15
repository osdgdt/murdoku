// Page by page: does every English string a page uses live in an area of the dictionary that page loads
// (src/i18n/areas.js)? Walks the import graph from each page's <script type="module"> entries, collects the
// t("…") strings of those modules and the visible text of the page, and reports the ones that exist in the
// dictionary only in an area the page does NOT load (they would show in Italian, silently).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { PAGE_AREAS } from "../../src/i18n/areas.js";

const root = path.resolve(import.meta.dirname, "../..");
const AREA_FILES = ["ui", "clues", "medieval", "glossary", "tutorial", "privacy", "campaign"];

const unescape = (s) => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");
const T_CALL = /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

async function loadAreas() {
  const out = {};
  for (const area of AREA_FILES) out[area] = (await import(`../../src/i18n/en/${area}.js`)).default;
  return out;
}

// the modules a module imports (relative specifiers only: static `from "…"` and `import("…")`)
function importsOf(file, src) {
  const specs = new Set();
  for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)) specs.add(m[1]);
  return [...specs]
    .filter((s) => s.startsWith("."))
    .map((s) => path.resolve(path.dirname(file), s.split("?")[0]))
    .filter((f) => f.endsWith(".js") && existsSync(f));
}

function reachable(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    queue.push(...importsOf(file, readFileSync(file, "utf8")));
  }
  return [...seen];
}

function pageEntries(html) {
  return [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((m) => path.join(root, m[1])).filter((f) => f.endsWith(".js"));
}

function pageText(html) {
  const bare = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  const keys = [];
  for (const m of bare.matchAll(/>([^<>]+)</g)) keys.push(m[1].trim().replace(/\s+/g, " "));
  for (const m of bare.matchAll(/\b(?:title|placeholder|aria-label|alt)="([^"]+)"/g)) keys.push(m[1].trim());
  return keys;
}

// Returns [{ page, key, file, area }]: strings a page uses that only an area it does not load can translate.
export async function checkPageAreas() {
  const areas = await loadAreas();
  const problems = [];
  for (const [page, loaded] of Object.entries(PAGE_AREAS)) {
    const htmlFile = path.join(root, page);
    if (!existsSync(htmlFile)) continue;
    const html = readFileSync(htmlFile, "utf8");
    const used = new Map(); // key -> where
    for (const key of pageText(html)) used.set(key, page);
    for (const file of reachable(pageEntries(html))) {
      if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(T_CALL)) used.set(unescape(m[1].slice(1, -1)), path.relative(root, file));
    }
    for (const [key, where] of used) {
      if (loaded.some((a) => key in areas[a])) continue; // translated by an area the page loads (or by none: not this check's business)
      const owner = AREA_FILES.find((a) => key in areas[a]);
      if (owner) problems.push({ page, key, file: where, area: owner });
    }
  }
  return problems;
}

export const knownPages = () => readdirSync(root).filter((f) => f.endsWith(".html"));
