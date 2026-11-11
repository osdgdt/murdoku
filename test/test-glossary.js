import { CLUE_TYPES } from "../src/model/clueTypes.js";
import { FAMILIES, ENTRIES, buildExample, evaluateCells, evaluateGeneral, exampleSentence } from "../src/glossary/examples.js";
import { assert, assertEqual } from "./assert.js";

const typeEntries = ENTRIES.filter((e) => e.type);

export const tests = [
  {
    name: "glossario: ogni tipo di indizio (anche obsoleto) ha una voce, e non ci sono voci per tipi inesistenti",
    fn: () => {
      const covered = new Set(typeEntries.map((e) => e.type));
      for (const [id, def] of Object.entries(CLUE_TYPES)) {
        if (def.internal) continue;
        assert(covered.has(id), `manca la voce del glossario per ${id}`);
      }
      for (const e of typeEntries) assert(e.type in CLUE_TYPES, `la voce ${e.id} usa un tipo inesistente (${e.type})`);
    },
  },
  {
    name: "glossario: id delle voci unici, famiglie esistenti, spiegazione e titolo non vuoti; gli obsoleti stanno nella famiglia 'legacy' e solo loro",
    fn: () => {
      const ids = ENTRIES.map((e) => e.id);
      assertEqual(new Set(ids).size, ids.length, "id duplicati");
      const families = new Set(FAMILIES.map((f) => f.id));
      for (const e of ENTRIES) {
        assert(families.has(e.family), `${e.id}: famiglia sconosciuta ${e.family}`);
        assert(e.explain().length > 20, `${e.id}: spiegazione mancante`);
        if (e.type) assert(!!CLUE_TYPES[e.type].legacy === (e.family === "legacy"), `${e.id}: la famiglia 'legacy' deve coincidere con il flag legacy del tipo`);
      }
    },
  },
  {
    name: "glossario: ogni esempio si costruisce e la sua frase è una frase vera (nessun «incompleto/sconosciuto»)",
    fn: () => {
      for (const e of ENTRIES) {
        const built = buildExample(e);
        if (!built.clue) continue;
        const sentence = exampleSentence(built);
        assert(sentence && !/incompleto|sconosciuto|incomplete|unknown/i.test(sentence) && !sentence.includes("?"), `${e.id}: frase non valida: ${sentence}`);
      }
    },
  },
  {
    name: "glossario: le persone già collocate in un esempio stanno in righe e colonne diverse (la regola di base)",
    fn: () => {
      for (const e of ENTRIES) {
        const built = buildExample(e);
        for (const fixed of [built.trueFixed, built.falseFixed]) {
          const rows = [...fixed.values()].map((p) => p.row);
          const cols = [...fixed.values()].map((p) => p.col);
          assertEqual(new Set(rows).size, rows.length, `${e.id}: due persone sulla stessa riga`);
          assertEqual(new Set(cols).size, cols.length, `${e.id}: due persone sulla stessa colonna`);
        }
      }
    },
  },
  {
    name: "glossario: negli esempi su un personaggio ci sono caselle verdi, ma non tutte (l'esempio deve mostrare qualcosa)",
    fn: () => {
      for (const e of ENTRIES.filter((x) => (x.owner || !x.type) && x.board !== false)) {
        const cells = evaluateCells(buildExample(e));
        const usable = cells.filter((c) => c.status !== "none");
        const ok = cells.filter((c) => c.status === "ok").length;
        assert(ok > 0, `${e.id}: nessuna casella verde`);
        if (e.type) assert(ok < usable.length, `${e.id}: tutte le caselle sono verdi, l'indizio non esclude nulla`);
      }
    },
  },
  {
    name: "glossario: negli esempi su un indizio generale la scena «vera» rende vero l'indizio e quella «falsa» no",
    fn: () => {
      for (const e of typeEntries.filter((x) => !x.owner && x.board !== false)) {
        const verdict = evaluateGeneral(buildExample(e));
        assertEqual(verdict.trueHolds, true, `${e.id}: la scena vera non rende vero l'indizio`);
        assertEqual(verdict.falseHolds, false, `${e.id}: la scena falsa non rende falso l'indizio`);
      }
    },
  },
];
