import { CLUE_TYPES } from "../src/model/clueTypes.js";
import { FAMILIES, ENTRIES, buildExample, evaluateCells, evaluateGeneral, exampleSentence } from "../src/glossary/examples.js";
import { TECHNIQUES } from "../src/solver/techniques/catalog.js";
import { buildReasoningExample, hasReasoningWorld } from "../src/glossary/reasoning.js";
import EN_REASONING from "../src/i18n/en/reasoning.js";
import { assert, assertEqual } from "./assert.js";

const typeEntries = ENTRIES.filter((e) => e.type);

export const tests = [
  {
    name: "glossario dei ragionamenti: le frasi inglesi non nominano i personaggi italiani (Anna, Bruno, Carla, Dario)",
    fn: () => {
      for (const [italian, english] of Object.entries(EN_REASONING)) {
        const found = english.match(/\b(Anna|Bruno|Carla|Dario)\b/);
        assert(!found, `«${found?.[0]}» nella frase inglese di «${italian.slice(0, 50)}…»`);
      }
    },
  },
  {
    name: "glossario dei ragionamenti: ogni esempio disegnato è un passo vero del solver umano, coerente con quello che dice (celle rimaste ed escluse)",
    fn: () => {
      let shown = 0;
      for (const tech of TECHNIQUES) {
        if (!hasReasoningWorld(tech.id)) continue;
        const example = buildReasoningExample(tech.id);
        assert(example, `${tech.id}: l'esempio non si costruisce o il solver umano non lo risolve`);
        assertEqual(example.step.technique, tech.id, `${tech.id}: il passo mostrato è di un altro ragionamento`);
        assert(example.remaining.size >= 1, `${tech.id}: la figura non mostra nessuna casella rimasta`);
        if (example.placed) assertEqual(example.remaining.size, 1, `${tech.id}: un piazzamento lascia una sola casella`);
        else assert(example.eliminated.length >= 1, `${tech.id}: la figura non esclude nessuna casella`);
        for (const cell of example.eliminated)
          assert(!example.remaining.has(`${cell.row},${cell.col}`), `${tech.id}: una casella è sia esclusa sia rimasta`);
        shown++;
      }
      assert(shown >= 10, `servono esempi per quasi tutti i ragionamenti (${shown})`);
    },
  },
  {
    name: "glossario dei ragionamenti: solo «provare le possibilità» e l'indizio tra tre personaggi aperti restano senza figura",
    fn: () => {
      for (const tech of TECHNIQUES) {
        // no figure: the search (it is the absence of a deduction) and the clue between three open characters (any such clue
        // is already impossible with the one-per-row rule, so there is no honest little case to draw)
        if (tech.id === "exhaustive" || tech.id === "mutualSupport") assert(!hasReasoningWorld(tech.id), "questa voce non ha una figura");
        else assert(hasReasoningWorld(tech.id), `manca l'esempio disegnato di ${tech.id}`);
      }
    },
  },
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
    name: "glossario: id delle voci unici, famiglie esistenti, spiegazione e titolo non vuoti; nessuna voce obsoleta",
    fn: () => {
      const ids = ENTRIES.map((e) => e.id);
      assertEqual(new Set(ids).size, ids.length, "id duplicati");
      const families = new Set(FAMILIES.map((f) => f.id));
      for (const e of ENTRIES) {
        assert(families.has(e.family), `${e.id}: famiglia sconosciuta ${e.family}`);
        assert(e.explain().length > 20, `${e.id}: spiegazione mancante`);
        assert(e.family !== "legacy", `${e.id}: gli indizi obsoleti non esistono più`);
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
        assert(
          sentence && !/incompleto|sconosciuto|incomplete|unknown/i.test(sentence) && !sentence.includes("?"),
          `${e.id}: frase non valida: ${sentence}`
        );
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
