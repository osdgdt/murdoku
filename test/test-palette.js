import { CHARACTER_COLORS, createPuzzle, addCharacter } from "../src/model/puzzle.js";
import { migratePuzzle, MIGRATED_CHARACTER_COLORS, LEGACY_CHARACTER_COLORS } from "../src/model/migrations.js";
import { minPair, contrast } from "./cvd-sim.js";
import { assert, assertEqual } from "./assert.js";

const DANGER = "#a83a2e"; // the victim's fixed color (--danger in base.css)

export const tests = [
  {
    name: "palette: i primi 10 colori non cambiano mai e la copia nelle migrazioni coincide con loro (i casi salvati li conservano)",
    fn: () => {
      assertEqual(JSON.stringify(MIGRATED_CHARACTER_COLORS), JSON.stringify(CHARACTER_COLORS.slice(0, 10)));
      assertEqual(CHARACTER_COLORS.length, 16, "uno per ogni personaggio di una griglia 16×16");
      assertEqual(new Set(CHARACTER_COLORS).size, 16, "tutti diversi");
    },
  },
  {
    name: "palette: i primi 10 colori restano distinguibili per protanopia, deuteranopia e tritanopia (ΔE2000 ≥ 8, vittima inclusa)",
    fn: () => {
      const worst = minPair([DANGER, ...CHARACTER_COLORS.slice(0, 10)]);
      assert(worst.d >= 8, `coppia troppo vicina (${worst.type || "visione normale"}): ${worst.i}-${worst.j}, ΔE=${worst.d.toFixed(1)}`);
    },
  },
  {
    name: "palette: tutti e 16 i colori (per le griglie grandi) restano distinguibili con ΔE2000 ≥ 5, vittima inclusa; l'icona e la posizione fissa delle note fanno il resto",
    fn: () => {
      const worst = minPair([DANGER, ...CHARACTER_COLORS]);
      assert(worst.d >= 5, `coppia troppo vicina (${worst.type || "visione normale"}): ${worst.i}-${worst.j}, ΔE=${worst.d.toFixed(1)}`);
    },
  },
  {
    name: "palette: ogni prefisso della palette è ben separato (i casi piccoli ricevono i colori più distinti)",
    fn: () => {
      for (let n = 2; n <= 5; n++) {
        const worst = minPair([DANGER, ...CHARACTER_COLORS.slice(0, n)]);
        assert(worst.d >= 10, `con ${n} personaggi ΔE=${worst.d.toFixed(1)}`);
      }
    },
  },
  {
    name: "palette: contrasto ≥ 3:1 con il testo bianco dei token e con gli sfondi cella chiaro e scuro",
    fn: () => {
      for (const color of CHARACTER_COLORS) {
        assert(contrast(color, "#ffffff") >= 3, `${color} su bianco`);
        assert(contrast(color, "#fffaf0") >= 3, `${color} su cella chiara`);
        assert(contrast(color, "#2a231c") >= 3, `${color} su cella scura`);
      }
    },
  },
  {
    name: "palette: i nuovi personaggi ricevono i colori nell'ordine della palette (16 personaggi: tutti i 16 colori)",
    fn: () => {
      const p = createPuzzle("P");
      const a = addCharacter(p, "A", "person1", true);
      const b = addCharacter(p, "B", "person2");
      assertEqual(a.color, CHARACTER_COLORS[0]);
      assertEqual(b.color, CHARACTER_COLORS[1]);
      for (let i = 2; i < 16; i++) addCharacter(p, `P${i}`, "person1");
      assertEqual(p.characters.map((c) => c.color).join(), CHARACTER_COLORS.join());
    },
  },
  {
    name: "migrazione colori: i vecchi colori predefiniti vengono rimappati per indice, quelli personalizzati restano",
    fn: () => {
      const legacy = {
        schemaVersion: 1,
        characters: [
          { id: "a", name: "A", color: LEGACY_CHARACTER_COLORS[3] },
          { id: "b", name: "B", color: "#123456" },
          { id: "c", name: "C", color: LEGACY_CHARACTER_COLORS[0].toUpperCase() },
          { id: "d", name: "D" },
        ],
        grid: { zones: [] },
      };
      migratePuzzle(legacy);
      assertEqual(legacy.characters[0].color, CHARACTER_COLORS[3]);
      assertEqual(legacy.characters[1].color, "#123456");
      assertEqual(legacy.characters[2].color, CHARACTER_COLORS[0]);
      assertEqual(legacy.characters[3].color, undefined);
      migratePuzzle(legacy); // idempotent
      assertEqual(legacy.characters[0].color, CHARACTER_COLORS[3]);
    },
  },
];
