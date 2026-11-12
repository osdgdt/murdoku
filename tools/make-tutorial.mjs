// Builds the bundled tutorial cases (examples/tutorial.{it,en}.murdoku.json)
// through the real model API, and refuses to write them unless the solver
// confirms each has exactly one solution and the declared one satisfies it.
// The case itself lives in tools/lib/tutorial-build.mjs.
//   node tools/make-tutorial.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildTutorial } from "./lib/tutorial-build.mjs";

for (const lang of ["it", "en"]) {
  const file = path.resolve(import.meta.dirname, `../examples/tutorial.${lang}.murdoku.json`);
  writeFileSync(file, JSON.stringify(buildTutorial(lang), null, 2) + "\n");
  console.log("scritto", path.relative(process.cwd(), file));
}
