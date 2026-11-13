// Integrity of the bundled case library (examples/): every case must be
// well-formed, have exactly one solution that satisfies all rules, and exist
// in both languages with the same structure.
import { validatePuzzleShape } from "../src/model/puzzle.js";
import { migratePuzzle } from "../src/model/migrations.js";
import { checkUniqueness, validateSolution } from "../src/solver/validator.js";
import { describeLibraryEntry, isLibraryPuzzleId, caseOfTheDay } from "../src/player/libraryPanel.js";
import { CLUE_TYPES } from "../src/model/clueTypes.js";
import { findRedundantClues, findCluesNeededWithoutVictim } from "../src/solver/redundancy.js";
import { addClue } from "../src/model/puzzle.js";
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
      assert(Array.isArray(cases), "l'indice ha un elenco di casi (anche vuoto)");
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
    name: "libreria: regole della casa dei casi generati (niente indizi sulla vittima, vittima ultima e con la V, nomi in ordine, niente closerTo né diagonale su stanze, briefing senza luogo)",
    fn: async () => {
      const { cases } = await loadJson("examples/library.json");
      for (const c of cases.filter((x) => x.id !== "tutorial")) {
        for (const lang of ["it", "en"]) {
          const p = await loadJson(c.files[lang]);
          const id = `${c.id}/${lang}`;
          const victim = p.characters[p.characters.length - 1];
          assert(victim.isVictim && p.characters.filter((x) => x.isVictim).length === 1, `${id}: la vittima è l'ultima della lista`);
          assert(/^V/i.test(victim.name), `${id}: il nome della vittima (${victim.name}) inizia con la V`);
          const suspects = p.characters.slice(0, -1).map((x) => x.name);
          for (let i = 1; i < suspects.length; i++)
            assert(
              suspects[i - 1].localeCompare(suspects[i], lang) < 0,
              `${id}: ${suspects[i - 1]} prima di ${suspects[i]} (ordine alfabetico)`
            );
          assertEqual(p.grid.size.rows, p.characters.length, `${id}: un personaggio per riga, così alla vittima resta una sola casella`);
          const zones = new Set(p.grid.zones.map((z) => z.id));
          for (const k of p.clues) {
            assert(k.characterId !== victim.id && !JSON.stringify(k.params).includes(victim.id), `${id}: ${k.id} riguarda la vittima`);
            assert(k.type !== "closerTo", `${id}: ${k.id} usa "è più vicino a"`);
            assert(!(k.type === "diagonal" && zones.has(k.params.targetId)), `${id}: ${k.id} è una diagonale rispetto a una stanza`);
          }
          for (const z of p.grid.zones) assert(!p.briefing.includes(z.name), `${id}: il briefing nomina la stanza «${z.name}»`);
        }
      }
    },
  },
  {
    name: "libreria: i seed memorizzati (tools/cases/seeds.json) riproducono esattamente i file dei casi — se fallisce, rigenera con tools/make-library.mjs",
    fn: async () => {
      const { buildLibrary } = await import("../tools/lib/library-build.mjs");
      const { LIBRARY } = await import("../tools/cases/library.mjs");
      const seeds = await loadJson("tools/cases/seeds.json");
      const built = {};
      const logs = [];
      await buildLibrary({
        ids: LIBRARY.map((s) => s.id),
        log: (m) => logs.push(m),
        io: {
          readSeeds: () => JSON.parse(JSON.stringify(seeds)),
          writeSeeds: () => {},
          readCase: () => null, // force the stored-seed path
          writeCase: (lang, id, puzzle) => {
            built[`${id}.${lang}`] = puzzle;
          },
          writeIndex: () => {},
        },
      });
      const stale = logs.filter((m) => /stale/.test(m));
      assertEqual(stale.length, 0, `seed scaduti: ${stale.join(" | ")}`);
      for (const spec of LIBRARY) {
        for (const lang of ["it", "en"]) {
          const file = await loadJson(`examples/library/${spec.id}.${lang}.murdoku.json`);
          assertEqual(
            JSON.stringify(built[`${spec.id}.${lang}`]),
            JSON.stringify(file),
            `${spec.id}/${lang}: il file non coincide con quanto generato dal seed`
          );
        }
      }
    },
  },
  {
    name: "editor: gli indizi «superflui» che servono ai sospettati (senza la vittima) vengono riconosciuti; con un indizio sulla vittima non si dice nulla",
    fn: async () => {
      const check = async (candidate) => checkUniqueness(candidate, { maxSolutions: 3, forwardCheck: true });
      const puzzle = await loadJson("test/fixtures/monastero.en.murdoku.json");
      const { ok, redundant } = await findRedundantClues(puzzle, check);
      assert(ok && redundant.length > 0, "la fixture del monastero ha indizi superflui solo grazie alla regola della stanza della vittima");
      const needed = await findCluesNeededWithoutVictim(puzzle, redundant, check);
      assertEqual(needed.join(), redundant.join(), "ognuno serve a determinare i sospettati");
      const victim = puzzle.characters.find((c) => c.isVictim);
      addClue(puzzle, victim.id, "inRowOrCol", { axis: "row", index: 1 });
      assertEqual((await findCluesNeededWithoutVictim(puzzle, redundant, check)).length, 0, "un indizio sulla vittima: nessuna nota");
    },
  },
  {
    name: "indizio «in diagonale»: il bersaglio non può essere una stanza (noZone)",
    fn: () => {
      assert(CLUE_TYPES.diagonal.params.find((p) => p.name === "targetId").noZone === true, "diagonal.targetId deve essere noZone");
      assert(!CLUE_TYPES.adjacent.params.find((p) => p.name === "targetId").noZone, "«accanto a» continua ad accettare le stanze");
    },
  },
  {
    name: "libreria: describeLibraryEntry usa la lingua, riconosce i casi risolti e punta a ?id= se già salvato",
    fn: () => {
      const entry = {
        id: "x",
        difficulty: "easy",
        size: [5, 5],
        characters: 4,
        title: { it: "Titolo", en: "Title" },
        files: { it: "examples/library/x.it.json", en: "examples/library/x.en.json" },
        puzzleId: { it: "lib_x_it", en: "lib_x_en" },
      };
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
      const entries = [
        { id: "tutorial", order: 0 },
        { id: "a", order: 1 },
        { id: "b", order: 2 },
        { id: "c", order: 3 },
      ];
      const d1 = new Date(Date.UTC(2026, 5, 10, 1, 0, 0));
      const d1late = new Date(Date.UTC(2026, 5, 10, 23, 59, 0));
      const d2 = new Date(Date.UTC(2026, 5, 11, 0, 1, 0));
      assertEqual(caseOfTheDay(entries, d1).id, caseOfTheDay(entries, d1late).id, "stesso giorno, stesso caso");
      assert(caseOfTheDay(entries, d1).id !== caseOfTheDay(entries, d2).id, "giorno dopo, caso diverso");
      for (let i = 0; i < 10; i++) assert(caseOfTheDay(entries, new Date(Date.UTC(2026, 0, 1 + i))).id !== "tutorial");
      assertEqual(caseOfTheDay([{ id: "tutorial" }]), null);
    },
  },
  {
    name: "libreria vuota: l'indice è valido, senza casi non c'è un caso del giorno",
    fn: async () => {
      const index = await loadJson("examples/library.json");
      assertEqual(index.version, 1, "versione dell'indice");
      assert(Array.isArray(index.cases), "l'indice ha sempre un elenco di casi");
      assertEqual(caseOfTheDay([]), null, "nessun caso, nessun caso del giorno");
      assertEqual(caseOfTheDay(index.cases.slice(0, 0)), null);
    },
  },
];
