// `npm run e2e:visual:docker` (compare) / `npm run e2e:visual:docker -- --update` (rewrite the references):
// runs the pixel-comparison test inside Playwright's own container image, the same image the CI job uses
// (.github/workflows/ci.yml). Fonts, emoji and the renderer are then the same everywhere, which is what makes the
// references in test/visual/ comparable between a developer's machine and the CI. The image tag follows the
// installed Playwright version, so the two cannot drift apart (test/test-ci-config.js checks the workflow too).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(path.join(root, "node_modules/playwright/package.json"), "utf8")).version;
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const update = process.argv.includes("--update");
// where a failing comparison leaves the actual images (the test writes to /tmp/murdoku-visual inside the container)
const out = path.join(os.tmpdir(), "murdoku-visual");
mkdirSync(out, { recursive: true });

const args = ["run", "--rm", "--ipc=host", "-v", `${root}:/work`, "-v", `${out}:/tmp/murdoku-visual`, "-w", "/work"];
// on Linux, files written to the repository stay owned by you, not by root
if (typeof process.getuid === "function" && process.platform === "linux") args.push("--user", `${process.getuid()}:${process.getgid()}`);
if (update) args.push("-e", "UPDATE_VISUAL=1");
args.push(image, "node", "test/e2e/visual.mjs");

console.log(`${update ? "Rewriting" : "Comparing"} the visual references in ${image}`);
const result = spawnSync("docker", args, { stdio: "inherit" });
if (result.error?.code === "ENOENT") {
  console.error("Docker is needed for this command (https://docs.docker.com/get-docker/); the CI job does not need it.");
  process.exit(2);
}
if (result.status !== 0 && !update) console.error(`Actual images of the failures: ${out}`);
process.exit(result.status ?? 1);
