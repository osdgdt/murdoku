import { roomColor } from "../src/skin/paper/rooms.js";
import { OBJECT_ART } from "../src/skin/paper/objects.js";
import { CHARACTER_ART } from "../src/skin/paper/characters.js";
import { OBJECT_TYPES, CHARACTER_ICONS } from "../src/model/icons.js";
import { assert, assertEqual } from "./assert.js";

const balanced = (svg) => (svg.match(/<svg\b/g) || []).length === (svg.match(/<\/svg>/g) || []).length && (svg.match(/<g\b/g) || []).length === (svg.match(/<\/g>/g) || []).length;

export const tests = [
  {
    name: "skin: ogni tipo di oggetto e ogni personaggio ha un disegno, e nessun disegno è orfano",
    fn: () => {
      for (const id of Object.keys(OBJECT_TYPES)) assert(OBJECT_ART[id], `manca il disegno dell'oggetto ${id}`);
      for (const id of Object.keys(CHARACTER_ICONS)) assert(CHARACTER_ART[id], `manca il disegno del personaggio ${id}`);
      for (const id of Object.keys(OBJECT_ART)) assert(id in OBJECT_TYPES, `disegno orfano: oggetto ${id}`);
      for (const id of Object.keys(CHARACTER_ART)) assert(id in CHARACTER_ICONS, `disegno orfano: personaggio ${id}`);
    },
  },
  {
    name: "skin: gli SVG sono ben formati (tag bilanciati) e le figure si colorano via currentColor",
    fn: () => {
      for (const [id, def] of Object.entries(OBJECT_TYPES)) assert(balanced(def.icon) && def.icon.startsWith("<svg"), `oggetto ${id}`);
      for (const [id, def] of Object.entries(CHARACTER_ICONS)) {
        assert(balanced(def.icon) && def.icon.startsWith("<svg"), `personaggio ${id}`);
        if (id !== "victim") assert(def.icon.includes('fill="currentColor"'), `${id}: il corpo deve usare currentColor`);
      }
    },
  },
  {
    name: "skin: i colori pastello salvati negli editor si trasformano nei fogli di carta corrispondenti, case-insensitive",
    fn: () => {
      assertEqual(roomColor("#f4c2c2"), "#d9715e");
      assertEqual(roomColor("#F4C2C2"), "#d9715e");
      assertEqual(roomColor("#c2e0f4"), "#8fa9c9");
    },
  },
  {
    name: "skin: un colore sconosciuto viene portato alla saturazione/luminosità della palette, mantenendo la tinta; un valore non valido ricade sul grigio carta",
    fn: () => {
      const out = roomColor("#12ab34");
      assert(/^#[0-9a-f]{6}$/.test(out), `esadecimale atteso, ricevuto ${out}`);
      const n = parseInt(out.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      assert(g > r && g > b, "la tinta verde deve restare verde");
      assertEqual(roomColor("red; background:url(x)"), "#c9c0b0");
      assertEqual(roomColor(undefined), "#c9c0b0");
    },
  },
];
