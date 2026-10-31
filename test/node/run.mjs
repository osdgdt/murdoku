// `npm test` entry: runs every test/test-*.js module (the same files the
// browser runner test/test-runner.html loads) under Node.
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { installLocalStorage, installWorkerShim } from "./shims.mjs";

installLocalStorage();
installWorkerShim();

const testDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(testDir).filter((f) => /^test-.*\.js$/.test(f)).sort();
const only = process.argv[2];

let passed = 0;
const failures = [];
for (const file of files) {
  if (only && !file.includes(only)) continue;
  const { tests } = await import(pathToFileURL(path.join(testDir, file)).href);
  for (const { name, fn } of tests) {
    try {
      localStorage.clear();
      await fn();
      passed++;
    } catch (err) {
      failures.push({ file, name, message: err.message });
    }
  }
}

for (const f of failures) console.error(`✗ [${f.file}] ${f.name}\n    ${f.message}`);
console.log(`${passed} / ${passed + failures.length} test superati`);
process.exit(failures.length ? 1 : 0);
