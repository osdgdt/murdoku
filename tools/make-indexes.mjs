// Writes firestore.indexes.json from the queries the gallery can make (src/community/galleryQuery.js).
//   node tools/make-indexes.mjs            write the file
//   node tools/make-indexes.mjs --check    fail if the file is not what the queries need (npm test does the same)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { indexesFile } from "../src/community/galleryQuery.js";

const file = path.resolve(import.meta.dirname, "../firestore.indexes.json");
const text = `${JSON.stringify(indexesFile(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(file, "utf8") !== text) {
    console.error("firestore.indexes.json is out of date: run node tools/make-indexes.mjs");
    process.exit(1);
  }
  console.log("firestore.indexes.json is up to date");
} else {
  writeFileSync(file, text);
  console.log(`wrote ${file}`);
}
