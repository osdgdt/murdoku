// The authoring check for library cases (tools/lib/case-report.mjs, `npm run check:case`): it must tell a good case from
// one with no/many solutions, a wrong declared solution, a house-rule breach or a mismatched translation.
import { readRepoFile } from "./helpers/read-file.js";
import { reportCase, houseRuleProblems, pairProblems } from "../tools/lib/case-report.mjs";
import { assert, assertEqual } from "./assert.js";

const load = async (name) => JSON.parse(await readRepoFile(`test/fixtures/${name}.murdoku.json`));
const has = (list, re) => list.some((m) => re.test(m));

export const tests = [
  {
    name: "controllo caso: un caso a soluzione unica e coerente non ha errori e riporta le sue misure",
    fn: async () => {
      const { errors, metrics } = await reportCase(await load("faro.en"), { lang: "en", library: false });
      assertEqual(errors.join("; "), "", "nessun errore");
      assertEqual(metrics.status, "unique");
      assertEqual(metrics.characters, 5);
    },
  },
  {
    name: "controllo caso: togliendo gli indizi la soluzione non è più unica ed è un errore",
    fn: async () => {
      const puzzle = await load("faro.en");
      puzzle.clues = puzzle.clues.slice(0, 1);
      const { errors } = await reportCase(puzzle, { lang: "en", library: false });
      assert(has(errors, /più di una soluzione/), `atteso «più di una soluzione», trovato: ${errors.join("; ")}`);
    },
  },
  {
    name: "controllo caso: una soluzione dichiarata che viola un indizio è un errore",
    fn: async () => {
      const puzzle = await load("faro.en");
      const [a, b] = puzzle.solution.placements;
      [a.col, b.col] = [b.col, a.col]; // scambia due colonne: righe e colonne restano distinte, ma gli indizi non tornano
      const { errors } = await reportCase(puzzle, { lang: "en", library: false });
      assert(
        has(errors, /la soluzione dichiarata non rispetta/),
        `atteso un errore sulla soluzione dichiarata, trovato: ${errors.join("; ")}`
      );
    },
  },
  {
    name: "controllo caso: gli indizi superflui sono un avviso (non un errore) e la difficoltà molto lontana dalla stima è segnalata",
    fn: async () => {
      const puzzle = await load("faro.en");
      puzzle.difficulty = "expert"; // il solutore la stima molto facile: cinque personaggi, tutti dedotti subito
      const { errors, warnings, metrics } = await reportCase(puzzle, { lang: "en", library: false });
      assertEqual(errors.length, 0, errors.join("; "));
      assert(has(warnings, /indizi superflui/), `atteso l'avviso sugli indizi superflui: ${warnings.join("; ")}`);
      assert(has(warnings, /difficoltà dichiarata/), `atteso l'avviso sulla difficoltà: ${warnings.join("; ")}`);
      assertEqual(metrics.estimated, "very-easy");
    },
  },
  {
    name: "controllo caso: una difficoltà vicina alla stima (un solo livello) non dà avvisi",
    fn: async () => {
      const puzzle = await load("faro.en");
      puzzle.difficulty = "easy"; // stima molto facile: un livello di distanza
      const { warnings } = await reportCase(puzzle, { lang: "en", library: false });
      assert(!has(warnings, /difficoltà/), `nessun avviso sulla difficoltà atteso: ${warnings.join("; ")}`);
    },
  },
  {
    name: "regole della libreria: un indizio sulla vittima, la vittima non ultima e un nome senza V sono segnalati",
    fn: async () => {
      const puzzle = await load("monastero.en");
      const victim = puzzle.characters.find((c) => c.isVictim);
      const asLibrary = (p) => houseRuleProblems(p, "en");
      const before = asLibrary(puzzle);
      puzzle.clues.push({ id: "kv", characterId: victim.id, type: "inRowOrCol", params: { axis: "row", index: 1 } });
      assert(has(asLibrary(puzzle), /riguarda la vittima/), "un indizio sulla vittima va segnalato");
      assert(asLibrary(puzzle).length > before.length, "il problema in più è proprio quello");
      const reordered = JSON.parse(JSON.stringify(puzzle));
      reordered.characters.reverse();
      assert(has(asLibrary(reordered), /ultima della lista/), "la vittima deve essere l'ultima");
      const renamed = JSON.parse(JSON.stringify(puzzle));
      renamed.characters.find((c) => c.isVictim).name = "Bianca";
      assert(has(asLibrary(renamed), /iniziare con la V/), "il nome della vittima deve iniziare con la V");
    },
  },
  {
    name: "versione italiana e inglese: due file identici nella struttura non hanno problemi, una differenza negli indizi sì",
    fn: async () => {
      const it = await load("faro.en");
      const en = JSON.parse(JSON.stringify(it));
      assertEqual(pairProblems(it, en).length, 0);
      en.clues.pop();
      assert(has(pairProblems(it, en), /indizi/), "indizi diversi tra le due versioni");
      const noTitle = JSON.parse(JSON.stringify(it));
      noTitle.title = "";
      assert(has(pairProblems(it, noTitle), /titolo/), "manca il titolo");
    },
  },
];
