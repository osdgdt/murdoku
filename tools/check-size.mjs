// `npm run check:size`: fails when a tracked file is bigger than it should be, so the repository (and the
// published site, which is served as it is, with no build step) doesn't quietly grow. Prints the biggest files.
//   - no tracked file over 1 MB;
//   - per kind, a budget a single file must stay under (the biggest ones today are about 70-80% of it:
//     when one gets close, split it before it becomes a page-load cost):
//       src JS 64 KB · CSS 48 KB · HTML 40 KB · images in the repository 150 KB;
//   - the reference screenshots of the visual tests (test/visual) together: 500 KB.
// Tests, fixtures and lock files are only held to the 1 MB rule.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const KB = 1024;
const MB = 1024 * KB;
const MAX = 1 * MB;

const BUDGETS = [
  { name: "JS in src/", match: (f) => f.startsWith("src/") && f.endsWith(".js"), max: 64 * KB },
  { name: "CSS", match: (f) => f.startsWith("styles/") && f.endsWith(".css"), max: 48 * KB },
  { name: "HTML", match: (f) => !f.includes("/") && f.endsWith(".html"), max: 40 * KB },
  { name: "images", match: (f) => !f.startsWith("test/") && /\.(png|jpe?g|webp|gif)$/i.test(f), max: 150 * KB },
];
const VISUAL_TOTAL_MAX = 500 * KB;

const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const sized = [];
for (const file of files) {
  try {
    sized.push({ file, size: statSync(path.join(root, file)).size });
  } catch {
    // listed but deleted in the working tree
  }
}

const problems = [];
for (const { file, size } of sized) {
  if (size > MAX) problems.push(`${file}: ${(size / MB).toFixed(2)} MB (limit ${MAX / MB} MB)`);
  const budget = BUDGETS.find((b) => b.match(file));
  if (budget && size > budget.max) problems.push(`${file}: ${(size / KB).toFixed(1)} KB, over the ${budget.name} budget of ${budget.max / KB} KB — split it`);
}
const visual = sized.filter(({ file }) => file.startsWith("test/visual/") && file.endsWith(".png")).reduce((sum, f) => sum + f.size, 0);
if (visual > VISUAL_TOTAL_MAX) problems.push(`test/visual: ${(visual / KB).toFixed(0)} KB of reference screenshots, over ${VISUAL_TOTAL_MAX / KB} KB`);

if (problems.length) {
  console.error(`File troppo grandi:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
const biggest = sized
  .filter(({ file }) => !file.endsWith("package-lock.json") && !file.startsWith("fonts/"))
  .sort((a, b) => b.size - a.size)
  .slice(0, 10)
  .map(({ file, size }) => `  ${(size / KB).toFixed(1).padStart(7)} KB  ${file}`);
console.log(`Dimensione dei file ok (${files.length} file controllati). I più grandi:\n${biggest.join("\n")}`);
