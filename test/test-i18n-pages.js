// The English dictionary is loaded by area, page by page (src/i18n/areas.js). Two things must hold: a page's areas
// are chosen by its name the way the table says, and no page uses a string that only an area it does not load can
// translate (tools/lib/i18n-pages.mjs walks each page's modules to check). The second needs the file system, so it
// runs in Node only (`npm test`).
import { areasForPage, AREA_LOADERS, PAGE_AREAS } from "../src/i18n/areas.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "dizionario per pagina: ogni pagina carica le aree comuni e le sue; una pagina sconosciuta le carica tutte",
    fn: () => {
      assertEqual(areasForPage("/murdoku/glossary.html").join(), "ui,clues,medieval,glossary,tutorial");
      assertEqual(areasForPage("/x/editor.html").includes("glossary"), true, "il wizard degli indizi mostra i testi del glossario");
      assertEqual(areasForPage("/x/player.html").join(), "ui,clues,medieval");
      assertEqual(areasForPage("/x/").join(), "ui,clues,medieval", "la home servita come cartella");
      assertEqual(areasForPage("/x/privacy.html").includes("privacy"), true);
      assertEqual(areasForPage("/x/qualcosa-di-nuovo.html").length, Object.keys(AREA_LOADERS).length, "pagina non elencata: tutto");
      for (const [page, areas] of Object.entries(PAGE_AREAS)) {
        for (const area of areas) assert(area in AREA_LOADERS, `${page}: l'area ${area} non esiste`);
      }
    },
  },
  {
    name: "dizionario per pagina: nessuna pagina usa una stringa tradotta solo in un'area che non carica",
    fn: async () => {
      if (!globalThis.process?.versions?.node) return; // needs the file system
      const { checkPageAreas } = await import("../tools/lib/i18n-pages.mjs");
      const problems = await checkPageAreas();
      assertEqual(
        problems.length,
        0,
        problems
          .map((p) => `${p.page}: ${p.key} (area ${p.area})`)
          .slice(0, 5)
          .join("; ")
      );
    },
  },
];
