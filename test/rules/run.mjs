// `npm run test:rules` from the repository root: runs rules.test.mjs against the Firestore emulator
// (firebase-tools + a Java runtime; the emulator jar is downloaded by firebase-tools the first time).
// Not part of `npm test`: it needs `cd test/rules && npm install` once. Without that it says so and exits 0,
// unless REQUIRE_RULES=1 (then it fails: use that in a CI that must not skip it).
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const here = import.meta.dirname;
const required = process.env.REQUIRE_RULES === "1";
const skip = (why) => {
  console.log(`Test delle regole Firestore saltati: ${why}`);
  console.log("Per eseguirli: cd test/rules && npm install, poi npm run test:rules dalla radice (serve Java).");
  process.exit(required ? 1 : 0);
};

if (!existsSync(path.join(here, "node_modules", ".bin", "firebase"))) skip("manca firebase-tools (test/rules/node_modules).");
if (spawnSync("java", ["-version"], { stdio: "ignore" }).status !== 0) skip("Java non è installato (serve all'emulatore).");

const result = spawnSync(
  path.join(here, "node_modules", ".bin", "firebase"),
  ["emulators:exec", "--only", "firestore", "--project", "demo-murdoku", "node --test test/rules/rules.test.mjs"],
  { cwd: path.resolve(here, "../.."), stdio: "inherit", env: { ...process.env, FIREBASE_TOOLS_DISABLE_UPDATE_CHECK: "true" } }
);
process.exit(result.status ?? 1);
