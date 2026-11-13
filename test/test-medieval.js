// The medieval / dark-fantasy assets: floors (model/texturesMedieval.js) and props
// (OBJECT_TYPES "group: medieval"). Their drawings are checked for every type by
// test-skin.js; the wording of the clues in each language by e2e/gameplay.mjs.
import {
  OBJECT_TYPES,
  CHARACTER_ICONS,
  SELECTABLE_CHARACTER_ICON_IDS,
  isEdgeObjectType,
  isObjectTypeOccupiable,
  isObjectTypeSeat,
} from "../src/model/icons.js";
import { ZONE_TEXTURES, floorStyle } from "../src/model/textures.js";
import { MEDIEVAL_TEXTURES } from "../src/model/texturesMedieval.js";
import { objectTypePhrase } from "../src/model/clues/shared.js";
import { createGrid, placeObject, isOccupiable } from "../src/model/grid.js";
import { assert, assertEqual } from "./assert.js";

const MEDIEVAL_IDS = Object.keys(OBJECT_TYPES).filter((id) => OBJECT_TYPES[id].group === "medieval");

export const tests = [
  {
    name: "medievale: ci sono almeno 20 oggetti e 15 pavimenti nuovi, e i pavimenti sono davvero registrati",
    fn: () => {
      assert(MEDIEVAL_IDS.length >= 20, `oggetti medievali: ${MEDIEVAL_IDS.length}`);
      const floors = Object.keys(MEDIEVAL_TEXTURES);
      assert(floors.length >= 15, `pavimenti medievali: ${floors.length}`);
      for (const id of floors) assert(ZONE_TEXTURES[id] === MEDIEVAL_TEXTURES[id], `${id} deve essere in ZONE_TEXTURES`);
    },
  },
  {
    name: "medievale: i pavimenti hanno layers/sizes paralleli, tinta valida, colori propri e nessun id duplicato di quelli esistenti",
    fn: () => {
      const legacy = Object.keys(ZONE_TEXTURES).filter((id) => !(id in MEDIEVAL_TEXTURES));
      for (const [id, def] of Object.entries(MEDIEVAL_TEXTURES)) {
        assert(!legacy.includes(id), `${id}: id già esistente`);
        assert(def.label, `${id}: etichetta`);
        assertEqual(def.layers.length, def.sizes.length, `${id}: layers e sizes`);
        assert(def.tint > 0 && def.tint <= 1, `${id}: tinta`);
        assert(def.layers.at(-1).startsWith("linear-gradient"), `${id}: l'ultimo livello è il colore di base`);
      }
    },
  },
  {
    name: "medievale: ogni oggetto ha etichetta, articolo italiano e un solo comportamento (occupabile / bordo / ingombrante)",
    fn: () => {
      for (const id of MEDIEVAL_IDS) {
        const def = OBJECT_TYPES[id];
        assert(def.label && ["un", "una", "uno", "un'"].includes(def.article), `${id}: etichetta e articolo`);
        assert(!(def.edge && def.occupiable), `${id}: un oggetto sul bordo non è occupabile (non blocca nessuno)`);
        if (def.seat) assert(def.occupiable, `${id}: una seduta è occupabile`);
      }
    },
  },
  {
    name: "medievale: letto, panca, trono, pelle d'orso e giaciglio si occupano; botte, forziere, camino, pozzo ecc. bloccano la cella",
    fn: () => {
      for (const id of ["bed", "bench", "throne", "bearskin", "pallet"]) assert(isObjectTypeOccupiable(id), `${id} occupabile`);
      for (const id of ["barrel", "chest", "fireplace", "anvil", "altar", "statue", "armor", "well", "cauldron", "sarcophagus"]) {
        assert(!isObjectTypeOccupiable(id), `${id} blocca`);
      }
      assert(isObjectTypeSeat("bench") && isObjectTypeSeat("throne"), "panca e trono sono sedute");
      assert(!isObjectTypeSeat("bed"), "il letto non è una seduta");
      const grid = createGrid(3, 3);
      placeObject(grid, "chest", 0, 0);
      placeObject(grid, "throne", 1, 1);
      assertEqual(isOccupiable(grid, 0, 0), false, "sul forziere non si sta");
      assertEqual(isOccupiable(grid, 1, 1), true, "sul trono sì");
    },
  },
  {
    name: "medievale: saracinesca e feritoia stanno sul bordo di una casella, come porte e finestre, e non la bloccano",
    fn: () => {
      for (const id of ["portcullis", "arrow_slit"]) {
        assert(isEdgeObjectType(id), `${id} è un oggetto di bordo`);
        assert(OBJECT_TYPES[id].edgeIcon.startsWith("<svg"), `${id}: disegno del bordo`);
      }
      const grid = createGrid(3, 3);
      placeObject(grid, "portcullis", 1, 1, "N");
      assertEqual(isOccupiable(grid, 1, 1), true, "una persona può stare nella casella con la saracinesca");
    },
  },
  {
    name: "medievale: i dieci personaggi nuovi hanno etichetta e disegno, si possono scegliere, e «vittima» resta l'ultimo e non selezionabile",
    fn: () => {
      const ids = ["blacksmith", "executioner", "herald", "thief", "alchemist", "archer", "princess", "prince", "jester", "bard"];
      for (const id of ids) {
        assert(CHARACTER_ICONS[id]?.label, `${id}: etichetta`);
        assert(CHARACTER_ICONS[id].icon.startsWith("<svg"), `${id}: disegno`);
        assert(SELECTABLE_CHARACTER_ICON_IDS.includes(id), `${id}: selezionabile`);
      }
      assertEqual(Object.keys(CHARACTER_ICONS).at(-1), "victim", "la vittima resta l'ultima");
      assert(!SELECTABLE_CHARACTER_ICON_IDS.includes("victim"));
    },
  },
  {
    name: "medievale: la frase di un oggetto elide l'articolo italiano («un'incudine», «un'armatura») e non lascia spazi doppi",
    fn: () => {
      assertEqual(objectTypePhrase("anvil"), "un'incudine");
      assertEqual(objectTypePhrase("armor"), "un'armatura");
      assertEqual(objectTypePhrase("barrel"), "una botte");
      assertEqual(objectTypePhrase("throne"), "un trono");
      assertEqual(objectTypePhrase("banner"), "uno stendardo");
      assertEqual(objectTypePhrase("arrow_slit"), "una feritoia");
      assertEqual(objectTypePhrase("shelf"), "uno scaffale", "gli oggetti di prima non cambiano");
      assert(!MEDIEVAL_IDS.some((id) => /\s{2,}/.test(objectTypePhrase(id))), "nessuno spazio doppio");
    },
  },
  {
    name: "pavimenti: ogni piastrella è disegnata nove volte (spostata di ±lato) così che i segni sul bordo continuino sul lato opposto",
    fn: () => {
      for (const [id, def] of Object.entries(MEDIEVAL_TEXTURES)) {
        const svg = decodeURIComponent(def.layers[0].slice('url("data:image/svg+xml,'.length, -2));
        assertEqual((svg.match(/<use /g) || []).length, 9, `${id}: nove copie`);
        const size = parseInt(def.sizes[0], 10);
        assert(svg.includes(`x='-${size}'`) && svg.includes(`y='${size}'`), `${id}: spostamenti ±${size}`);
      }
    },
  },
  {
    name: "pavimenti: floorStyle dà una posizione per ogni livello; solo le piastrelle di dimensione fissa seguono la posizione della casella",
    fn: () => {
      for (const id of Object.keys(ZONE_TEXTURES)) {
        for (const zoneColor of [null, "#f4c2c2"]) {
          const { image, size, pos } = floorStyle(id, zoneColor);
          // Gradients contain commas, so count layers through the sizes (one each).
          const n = size.split(", ").length;
          assert(image.length > 0 && n >= 1, `${id}: livelli`);
          const positions = pos.split(/, (?![^()]*\))/); // not the comma inside var(--tile-pos, 0 0)
          assertEqual(positions.length, n, `${id}: una posizione per livello`);
          size.split(", ").forEach((sz, i) => {
            const expected = sz === "auto" ? "0 0" : "var(--tile-pos, 0 0)";
            assertEqual(positions[i], expected, `${id}: livello ${i}`);
          });
        }
      }
      // A medieval floor with its tint layer: tint (auto) then tile then base (auto).
      assertEqual(floorStyle("herringbone", "#f4c2c2").pos, "0 0, var(--tile-pos, 0 0), 0 0");
    },
  },
];
