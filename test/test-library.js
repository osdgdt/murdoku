// Integrity of the bundled case library (examples/): every case must be
// well-formed, have exactly one solution that satisfies all rules, and exist
// in both languages with the same structure.
import { validatePuzzleShape } from "../src/model/puzzle.js";
import { migratePuzzle } from "../src/model/migrations.js";
import { checkUniqueness, validateSolution } from "../src/solver/validator.js";
import { describeLibraryEntry, isLibraryPuzzleId, caseOfTheDay } from "../src/player/libraryPanel.js";
import { assert, assertEqual } from "./assert.js";

const isNode = !!globalThis.process?.versions?.node;
async function loadJson(rel) {
  if (isNode) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(new URL(`../${rel}`, import.meta.url), "utf8"));
  }
  const res = await fetch(new URL(`../${rel}`, import.meta.url));
  return res.json();
}

export const tests = [
  {
    name: "libreria: l'indice elenca i casi in ordine e ogni file esiste in entrambe le lingue",
    fn: async () => {
      const { cases } = await loadJson("examples/library.json");
      assert(cases.length >= 9, `attesi almeno 9 casi (tutorial incluso), trovati ${cases.length}`);
      assertEqual(cases[0].id, "tutorial");
      const orders = cases.map((c) => c.order);
      assertEqual(JSON.stringify(orders), JSON.stringify([...orders].sort((a, b) => a - b)), "ordinati per 'order'");
      for (const c of cases) {
        for (const lang of ["it", "en"]) {
          const puzzle = await loadJson(c.files[lang]);
          assertEqual(puzzle.id, c.puzzleId[lang], `${c.id}/${lang}: id coerente con l'indice`);
          assert(isLibraryPuzzleId(puzzle.id), `${puzzle.id} deve avere un prefisso di libreria`);
        }
      }
    },
  },
  {
    name: "libreria: ogni caso è ben formato, ha soluzione unica e la soluzione dichiarata rispetta tutte le regole",
    fn: async () => {
      const { cases } = await loadJson("examples/library.json");
      for (const c of cases) {
        for (const lang of ["it", "en"]) {
          const puzzle = migratePuzzle(await loadJson(c.files[lang]));
          const shape = validatePuzzleShape(puzzle);
          assert(shape.valid, `${puzzle.id}: ${shape.errors.join("; ")}`);
          const report = checkUniqueness(puzzle, { maxSolutions: 3, forwardCheck: true });
          assertEqual(report.solutionCount, 1, `${puzzle.id}: soluzioni trovate ${report.solutionCount}`);
          assert(!report.truncated, `${puzzle.id}: ricerca troncata`);
          const check = validateSolution(puzzle);
          assert(check.valid, `${puzzle.id}: ${check.violations.map((v) => v.message).join("; ")}`);
          assertEqual(puzzle.characters.length, c.characters, `${puzzle.id}: numero di personaggi nell'indice`);
        }
      }
    },
  },
  {
    name: "libreria: la versione italiana e quella inglese hanno la stessa struttura (mappa, personaggi, indizi, soluzione)",
    fn: async () => {
      const { cases } = await loadJson("examples/library.json");
      for (const c of cases.filter((x) => x.id !== "tutorial")) {
        const it = await loadJson(c.files.it);
        const en = await loadJson(c.files.en);
        assertEqual(JSON.stringify(it.grid.cells), JSON.stringify(en.grid.cells), `${c.id}: celle`);
        assertEqual(JSON.stringify(it.clues), JSON.stringify(en.clues), `${c.id}: indizi`);
        assertEqual(JSON.stringify(it.solution), JSON.stringify(en.solution), `${c.id}: soluzione`);
        assertEqual(it.characters.map((x) => x.id).join(), en.characters.map((x) => x.id).join(), `${c.id}: id personaggi`);
        assert(it.title && en.title, `${c.id}: titolo mancante`);
        assert(!/\{(victimRoom|murderer|room)\}/.test(JSON.stringify(it) + JSON.stringify(en)), `${c.id}: segnaposto non sostituiti`);
      }
    },
  },
  {
    name: "libreria: describeLibraryEntry usa la lingua, riconosce i casi risolti e punta a ?id= se già salvato",
    fn: () => {
      const entry = { id: "x", difficulty: "easy", size: [5, 5], characters: 4, title: { it: "Titolo", en: "Title" }, files: { it: "examples/library/x.it.json", en: "examples/library/x.en.json" }, puzzleId: { it: "lib_x_it", en: "lib_x_en" } };
      const fresh = describeLibraryEntry(entry, "en", {}, new Set());
      assertEqual(fresh.title, "Title");
      assertEqual(fresh.size, "5×5");
      assertEqual(fresh.solved, false);
      assert(fresh.href.startsWith("player.html?import="));
      const played = describeLibraryEntry(entry, "it", { "puzzle:lib_x_it": { bestElapsedSeconds: 90 } }, new Set(["lib_x_it"]));
      assertEqual(played.title, "Titolo");
      assertEqual(played.solved, true);
      assertEqual(played.bestElapsedSeconds, 90);
      assertEqual(played.href, "player.html?id=lib_x_it");
    },
  },
  {
    name: "libreria: il caso del giorno è uno solo per giornata (UTC), cambia il giorno dopo e salta il tutorial",
    fn: () => {
      const entries = [{ id: "tutorial", order: 0 }, { id: "a", order: 1 }, { id: "b", order: 2 }, { id: "c", order: 3 }];
      const d1 = new Date(Date.UTC(2026, 5, 10, 1, 0, 0));
      const d1late = new Date(Date.UTC(2026, 5, 10, 23, 59, 0));
      const d2 = new Date(Date.UTC(2026, 5, 11, 0, 1, 0));
      assertEqual(caseOfTheDay(entries, d1).id, caseOfTheDay(entries, d1late).id, "stesso giorno, stesso caso");
      assert(caseOfTheDay(entries, d1).id !== caseOfTheDay(entries, d2).id, "giorno dopo, caso diverso");
      for (let i = 0; i < 10; i++) assert(caseOfTheDay(entries, new Date(Date.UTC(2026, 0, 1 + i))).id !== "tutorial");
      assertEqual(caseOfTheDay([{ id: "tutorial" }]), null);
    },
  },
];
