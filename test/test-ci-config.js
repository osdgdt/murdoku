// The CI workflow and the visual references must agree: the pixel comparison only means something when the fonts and
// the renderer are the same where the references were written and where they are compared.
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "CI: il job visivo usa l'immagine Playwright della versione installata (altrimenti i riferimenti non sono confrontabili)",
    fn: async () => {
      const lock = JSON.parse(await readRepoFile("package-lock.json"));
      const version = lock.packages["node_modules/playwright"].version;
      const ci = await readRepoFile(".github/workflows/ci.yml");
      const image = ci.match(/image:\s*(mcr\.microsoft\.com\/playwright:[^\s]+)/)?.[1];
      assert(image, "ci.yml: manca l'immagine del container del job visivo");
      assertEqual(
        image,
        `mcr.microsoft.com/playwright:v${version}-noble`,
        "ci.yml: l'immagine non corrisponde alla versione di Playwright in package-lock.json"
      );
    },
  },
  {
    name: "CI: il job visivo gira solo sulle pull request, così un pixel diverso non può fermare la pubblicazione di main",
    fn: async () => {
      const ci = await readRepoFile(".github/workflows/ci.yml");
      const job = ci.slice(ci.indexOf("\n  visual:"));
      assert(job.includes("\n  visual:"), "ci.yml: manca il job visual");
      assert(/if:\s*github\.event_name == 'pull_request'/.test(job), "ci.yml: il job visual deve essere limitato alle pull request");
      const pkg = JSON.parse(await readRepoFile("package.json"));
      assert(
        !pkg.scripts["e2e:all"].includes("e2e:visual"),
        "e2e:all non deve includere i test visivi (girano nel loro job, nel container)"
      );
    },
  },
];
