// `npm run test:functions` from the repository root: runs functions/test/emulator.test.mjs against the Auth, Functions and
// Firestore emulators (firebase-tools from test/rules/node_modules, a Java runtime, and `cd functions && npm install`).
// Not part of `npm test`; without those it says so and exits 0, unless REQUIRE_FUNCTIONS=1 (use that in a CI that must not skip it).
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const required = process.env.REQUIRE_FUNCTIONS === "1";
const skip = (why) => {
  console.log(`Test delle Cloud Functions saltati: ${why}`);
  console.log(
    "Per eseguirli: cd test/rules && npm install; cd ../../functions && npm install; poi npm run test:functions dalla radice (serve Java)."
  );
  process.exit(required ? 1 : 0);
};
const firebase = path.join(root, "test", "rules", "node_modules", ".bin", "firebase");
if (!existsSync(firebase)) skip("manca firebase-tools (test/rules/node_modules).");
if (!existsSync(path.join(root, "functions", "node_modules", "firebase-functions")))
  skip("mancano le dipendenze di functions/ (cd functions && npm install).");
if (spawnSync("java", ["-version"], { stdio: "ignore" }).status !== 0) skip("Java non è installato (serve agli emulatori).");

// the Functions are deployed with a generated copy of the page's rules module: make sure it is current
const build = spawnSync("node", ["tools/build-functions.mjs"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const result = spawnSync(
  firebase,
  ["emulators:exec", "--only", "auth,functions,firestore", "--project", "demo-murdoku", "node --test functions/test/emulator.test.mjs"],
  { cwd: root, stdio: "inherit", env: { ...process.env, FIREBASE_TOOLS_DISABLE_UPDATE_CHECK: "true" } }
);
process.exit(result.status ?? 1);
