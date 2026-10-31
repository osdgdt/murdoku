// `npm run i18n`: lists user-facing Italian strings that have no English
// entry yet. Scans t("...") calls in src/ and visible text in the .html pages.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import en from "../src/i18n/en.js";

const root = path.resolve(import.meta.dirname, "..");
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
    if (key.length > 1 && /[A-Za-zÀ-ú]{2}/.test(key) && !(key in en)) missing.set(key, file);
  }
  for (const m of html.matchAll(/\b(?:title|placeholder|aria-label|alt)="([^"]+)"/g)) {
    const key = m[1].trim();
    if (/[A-Za-zÀ-ú]{3}/.test(key) && !(key in en)) missing.set(key, file);
  }
}

for (const [key, file] of missing) console.log(`${file}: ${JSON.stringify(key)}`);
console.log(`\n${missing.size} stringhe senza traduzione inglese.`);
process.exit(process.argv.includes("--strict") && missing.size ? 1 : 0);
