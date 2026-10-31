// Regenerates the PRECACHE list + VERSION hash inside sw.js.
//   node tools/build-sw.mjs          rewrite sw.js
//   node tools/build-sw.mjs --check  exit 1 if sw.js is stale (used by `npm test`)
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const INCLUDE_DIRS = ["src", "styles", "icons"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    statSync(full).isDirectory() ? walk(full, out) : out.push(full);
  }
  return out;
}

function precacheFiles() {
  const files = readdirSync(root).filter((f) => f.endsWith(".html") || f === "manifest.webmanifest").sort();
  for (const dir of INCLUDE_DIRS) files.push(...walk(path.join(root, dir)).map((f) => path.relative(root, f)));
  return files.map((f) => f.split(path.sep).join("/")).filter((f) => f !== "icons/icon.svg");
}

export function generate() {
  const files = precacheFiles();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update(readFileSync(path.join(root, f)));
  const version = hash.digest("hex").slice(0, 12);
  const block = `const VERSION = ${JSON.stringify(version)};\nconst PRECACHE = ${JSON.stringify(["./", ...files], null, 2)};`;
  const swPath = path.join(root, "sw.js");
  const current = readFileSync(swPath, "utf8");
  const next = current.replace(/\/\/ BEGIN GENERATED\n[\s\S]*?\n\/\/ END GENERATED/, `// BEGIN GENERATED\n${block}\n// END GENERATED`);
  return { swPath, current, next };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { swPath, current, next } = generate();
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("sw.js è obsoleto: esegui `npm run build:sw` e committa il risultato.");
      process.exit(1);
    }
    console.log("sw.js aggiornato.");
  } else {
    writeFileSync(swPath, next);
    console.log("sw.js rigenerato.");
  }
}
