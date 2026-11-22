// What the game pages load at start-up: the solver, the hint logic and the win panel come later (gameScreen.js loads them
// in the idle time after the first paint), and every module the page does load at once is announced with a modulepreload.
import { staticModules } from "../tools/build-sw.mjs";
import { readRepoFile } from "./helpers/read-file.js";
import { assert } from "./assert.js";

const LATER = [
  "src/solver/solver.js",
  "src/solver/propagation.js",
  "src/solver/solverClient.js",
  "src/solver/hoverTargets.js",
  "src/player/hintLogic.js",
  "src/player/hintView.js",
  "src/player/winPanel.js",
  "src/player/effectiveSolution.js",
];

export const tests = [
  ...["player.html", "campaign.html"].map((page) => ({
    name: `avvio: ${page} non carica subito il solver, i suggerimenti e il pannello di vittoria`,
    fn: async () => {
      const { modules } = staticModules(await readRepoFile(page));
      const early = LATER.filter((f) => modules.includes(f));
      assert(
        early.length === 0,
        `${page} importa all'avvio: ${early.join(", ")} (vanno caricati dopo il primo disegno, vedi gameScreen.js)`
      );
    },
  })),
  ...["player.html", "campaign.html"].map((page) => ({
    name: `avvio: ${page} precarica tutti i moduli che importa all'avvio`,
    fn: async () => {
      const html = await readRepoFile(page);
      const { modules } = staticModules(html);
      const missing = modules.filter((f) => !html.includes(`<link rel="modulepreload" href="${f}" fetchpriority="low" />`));
      assert(modules.length > 20 && missing.length === 0, `${page}: manca il modulepreload di ${missing.join(", ")} (npm run build:sw)`);
    },
  })),
];
