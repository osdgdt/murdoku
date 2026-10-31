import { setLanguageForSession, getLanguage, t } from "../src/i18n/i18n.js";
import en from "../src/i18n/en.js";
import { CLUE_TYPES, describeClue } from "../src/model/clueTypes.js";
import { createPuzzle, addCharacter } from "../src/model/puzzle.js";
import { addZone, resizeGrid, placeObject } from "../src/model/grid.js";
import { assertEqual } from "./assert.js";

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

// Words that betray an untranslated Italian fragment inside an English sentence.
const ITALIAN_LEAK = /\b(che|nella|nello|della|delle|con|una|uno|il|lo|la|le|gli|è|si trova|stanza|stanze|persona|nessuno|qualcuno|accanto|oppure|riga|colonna|sola|vittima|esattamente)\b|[àèéìòù]/i;

function sampleParams(def, ids) {
  const params = {};
  for (const p of def.params || []) {
    switch (p.kind) {
      case "characterOrObject": case "character": params[p.name] = ids.other; break;
      case "characterOrObjectMulti": params[p.name] = [ids.other, ids.obj]; break;
      case "zone": params[p.name] = ids.zone; break;
      case "number": params[p.name] = 2; break;
      case "enum": params[p.name] = p.values.find((v) => v !== "") ?? ""; break;
      case "clueRef": params[p.name] = { type: "inCorner", params: {} }; break;
      default: break;
    }
  }
  return params;
}

function samplePuzzle() {
  const puzzle = createPuzzle("Sample");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const a = addCharacter(puzzle, "Anna", "person1", true);
  const b = addCharacter(puzzle, "Bruno", "person2");
  const zone = addZone(puzzle.grid, "Kitchen", "#fff");
  const obj = placeObject(puzzle.grid, "chair", 0, 0);
  return { puzzle, ids: { owner: a.id, other: b.id, zone: zone.id, obj: obj.id } };
}

export const tests = [
  {
    name: "i18n: ogni voce inglese ha gli stessi segnaposto della chiave italiana",
    fn: () => {
      const bad = Object.entries(en).filter(([k, v]) => placeholders(k) !== placeholders(v));
      assertEqual(bad.length, 0, "segnaposto incoerenti: " + bad.map(([k]) => k).slice(0, 5).join(" | "));
    },
  },
  {
    name: "i18n: t() interpola i segnaposto e torna l'italiano per le chiavi senza traduzione",
    fn: async () => {
      assertEqual(t("Gioca"), "Gioca");
      assertEqual(t("Aggiornato il {updated}", { updated: "oggi" }), "Aggiornato il oggi");
      await setLanguageForSession("en");
      try {
        assertEqual(getLanguage(), "en");
        assertEqual(t("Gioca"), "Play");
        assertEqual(t("Aggiornato il {updated}", { updated: "today" }), "Updated on today");
        assertEqual(t("frase non presente nel dizionario"), "frase non presente nel dizionario");
      } finally {
        await setLanguageForSession("it");
      }
    },
  },
  {
    name: "i18n: ogni tipo di indizio ha descrizione e negazione in inglese senza frammenti italiani",
    fn: async () => {
      const { puzzle, ids } = samplePuzzle();
      await setLanguageForSession("en");
      try {
        const leaks = [];
        for (const [type, def] of Object.entries(CLUE_TYPES)) {
          const clue = { id: "c", type, characterId: def.scope === "generic" ? null : ids.owner, params: sampleParams(def, ids), negate: false };
          if (type === "orClue") clue.params = { a: { type: "inCorner", params: {} }, b: { type: "adjacent", params: { targetId: ids.other } } };
          // Static labels are built once at module load (so can't follow a mid-session
          // language switch); their dictionary coverage is enforced by `npm run i18n -- --strict`.
          const texts = [describeClue(clue, puzzle), describeClue({ ...clue, negate: true }, puzzle)];
          for (const text of texts) if (typeof text === "string" && ITALIAN_LEAK.test(text)) leaks.push(`${type}: ${text}`);
        }
        assertEqual(leaks.length, 0, "frammenti italiani in inglese:\n" + leaks.join("\n"));
      } finally {
        await setLanguageForSession("it");
      }
    },
  },
  {
    name: "i18n: le frasi inglesi negate restano grammaticali (nessun 'Non' italiano, nessun doppio verbo)",
    fn: async () => {
      const { puzzle, ids } = samplePuzzle();
      await setLanguageForSession("en");
      try {
        const clue = { id: "c", type: "adjacent", characterId: ids.owner, params: { targetId: ids.other }, negate: true };
        assertEqual(describeClue(clue, puzzle), "Is not next to Bruno.");
        const shares = { id: "c", type: "rowOrColWith", characterId: ids.owner, params: { axis: "row", targetId: ids.other }, negate: true };
        assertEqual(describeClue(shares, puzzle), "Does not share the row with Bruno.");
      } finally {
        await setLanguageForSession("it");
      }
    },
  },
];
