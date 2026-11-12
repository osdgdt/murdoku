// Fails when a tracked file is bigger than expected, so the repository (and the
// published site) doesn't quietly grow. Files under design/ are reference
// images that are NOT published, so they get a larger allowance.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const MB = 1024 * 1024;
const LIMITS = [
  { prefix: "design/", max: 5 * MB },
  { prefix: "", max: 1 * MB },
];

const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const tooBig = [];
for (const file of files) {
  let size;
  try {
    size = statSync(path.join(root, file)).size;
  } catch {
    continue; // listed but deleted in the working tree
  }
  const { max } = LIMITS.find((l) => file.startsWith(l.prefix));
  if (size > max) tooBig.push(`${file}: ${(size / MB).toFixed(2)} MB (limit ${(max / MB).toFixed(0)} MB)`);
}
if (tooBig.length) {
  console.error(`File troppo grandi:\n  ${tooBig.join("\n  ")}`);
  process.exit(1);
}
console.log(`Dimensione dei file ok (${files.length} file controllati).`);
