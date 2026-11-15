// Every page decides its theme in a tiny inline script in <head> (before the first paint, so there is no
// flash). There are ten copies; they must stay identical and know all three themes, and every page must
// load the high-contrast stylesheet after the skin.
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const PAGES = ["achievements", "campaign-editor", "campaign", "daily", "editor", "glossary", "index", "player", "privacy", "tutorial"];

const inlineThemeScript = (html) =>
  html.match(/<script>\s*try \{\s*var t = localStorage\.getItem\("murdoku:theme"\);[\s\S]*?<\/script>/)?.[0] ?? null;

export const tests = [
  {
    name: "pagine: lo script del tema in <head> è identico nelle 10 pagine e conosce chiaro, scuro e alto contrasto",
    fn: async () => {
      const scripts = await Promise.all(PAGES.map(async (p) => inlineThemeScript(await readRepoFile(`${p}.html`))));
      scripts.forEach((s, i) => assert(s, `${PAGES[i]}.html: manca lo script del tema`));
      for (let i = 1; i < scripts.length; i++) assertEqual(scripts[i], scripts[0], `${PAGES[i]}.html ha uno script del tema diverso`);
      for (const needle of ['"contrast"', '"dark"', "prefers-contrast: more", "forced-colors: active", "prefers-color-scheme: dark"]) {
        assert(scripts[0].includes(needle), `lo script del tema non contiene ${needle}`);
      }
    },
  },
  {
    name: "pagine: ogni pagina carica contrast.css subito dopo skin-paper.css",
    fn: async () => {
      for (const p of PAGES) {
        const html = await readRepoFile(`${p}.html`);
        const skin = html.indexOf("styles/skin-paper.css");
        const contrast = html.indexOf("styles/contrast.css");
        assert(skin > 0 && contrast > skin, `${p}.html: contrast.css deve venire dopo skin-paper.css`);
      }
    },
  },
];
