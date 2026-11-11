// Builds the bundled case library (examples/library/*.json + examples/library.json)
// from tools/cases/library.mjs. Only ids listed in the CLI args are rebuilt
// when given (`node tools/make-library.mjs villa`); seeds that already passed
// their gate are remembered in tools/cases/seeds.json so reruns are instant
// and byte-identical. The work itself lives in tools/lib/library-build.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { buildLibrary } from "./lib/library-build.mjs";

const root = path.resolve(import.meta.dirname, "..");
const seedsFile = path.join(root, "tools/cases/seeds.json");
const caseFile = (lang, id) => path.join(root, `examples/library/${id}.${lang}.murdoku.json`);
mkdirSync(path.join(root, "examples/library"), { recursive: true });

await buildLibrary({
  only: process.argv.slice(2),
  io: {
    readSeeds: () => (existsSync(seedsFile) ? JSON.parse(readFileSync(seedsFile, "utf8")) : {}),
    writeSeeds: (seeds) => writeFileSync(seedsFile, JSON.stringify(seeds, null, 2) + "\n"),
    readCase: (lang, id) => (existsSync(caseFile(lang, id)) ? JSON.parse(readFileSync(caseFile(lang, id), "utf8")) : null),
    writeCase: (lang, id, puzzle) => writeFileSync(caseFile(lang, id), JSON.stringify(puzzle, null, 2) + "\n"),
    writeIndex: (index) => writeFileSync(path.join(root, "examples/library.json"), JSON.stringify(index, null, 2) + "\n"),
  },
});
