import { ZONE_TEXTURES, floorStyle } from "../src/model/textures.js";
import { assert, assertEqual } from "./assert.js";

const LEGACY_IDS = ["none", "hatch", "wood", "stone", "carpet", "grass", "marble", "water"];

export const tests = [
  {
    name: "ZONE_TEXTURES: gli id storici (salvati nei casi) esistono ancora e ci sono almeno 24 pavimenti",
    fn: () => {
      for (const id of LEGACY_IDS) assert(ZONE_TEXTURES[id], `manca l'id storico ${id}`);
      assert(Object.keys(ZONE_TEXTURES).length >= 24, "devono esserci almeno 24 pavimenti");
    },
  },
  {
    name: "ZONE_TEXTURES: layers e sizes sono array paralleli, con etichetta, e tint tra 0 e 1",
    fn: () => {
      for (const [id, def] of Object.entries(ZONE_TEXTURES)) {
        assert(def.label && def.label.length > 0, `${id}: etichetta mancante`);
        assertEqual(def.layers.length, def.sizes.length, `${id}: layers e sizes di lunghezza diversa`);
        assert(def.tint >= 0 && def.tint <= 1, `${id}: tint fuori range`);
      }
    },
  },
  {
    name: "floorStyle: i pavimenti legacy (none/hatch) non ricevono mai la tinta della stanza, gli altri sì (e solo se c'è un colore)",
    fn: () => {
      assert(!floorStyle("hatch", "#f4c2c2").image.includes("color-mix"));
      assert(!floorStyle("none", "#f4c2c2").image.includes("color-mix"));
      assert(floorStyle("parquet", "#f4c2c2").image.includes("color-mix(in srgb, #f4c2c2"));
      assert(!floorStyle("parquet").image.includes("color-mix"), "senza colore non c'è tinta (anteprima neutra)");
    },
  },
  {
    name: "floorStyle: un id sconosciuto o assente ricade su hatch, e image/size hanno lo stesso numero di livelli",
    fn: () => {
      assertEqual(floorStyle("inesistente").image, floorStyle("hatch").image);
      assertEqual(floorStyle(undefined).image, floorStyle("hatch").image);
      const { image, size } = floorStyle("terracotta", "#c2e0f4");
      // 5 livelli (tinta + 4): le virgole dentro rgb()/url() non contano, quindi contiamo le dimensioni
      assertEqual(size.split(", ").length, 5);
      assert(image.length > 0);
    },
  },
  {
    name: "floorStyle: `own` è falso per i pavimenti legacy (none/hatch) e vero per quelli con colori propri",
    fn: () => {
      assertEqual(floorStyle("none", "#f4c2c2").own, false);
      assertEqual(floorStyle("hatch", "#f4c2c2").own, false);
      assertEqual(floorStyle("parquet", "#f4c2c2").own, true);
      assertEqual(floorStyle(undefined).own, false);
    },
  },
];
