import {
  CHARACTER_ICONS,
  SELECTABLE_CHARACTER_ICON_IDS,
  OBJECT_TYPES,
  characterIcon,
  objectIcon,
  isObjectTypeOccupiable,
  objectTypeTargetId,
  isObjectTypeTarget,
  parseObjectTypeTarget,
} from "../src/model/icons.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "SELECTABLE_CHARACTER_ICON_IDS esclude 'victim' e copre ogni voce selezionabile di CHARACTER_ICONS",
    fn: () => {
      assert(!SELECTABLE_CHARACTER_ICON_IDS.includes("victim"), "la vittima non è un'icona scelta manualmente per un personaggio");
      assertEqual(SELECTABLE_CHARACTER_ICON_IDS.length, Object.keys(CHARACTER_ICONS).length - 1);
      for (const id of SELECTABLE_CHARACTER_ICON_IDS) assert(id in CHARACTER_ICONS, `${id} deve esistere in CHARACTER_ICONS`);
    },
  },
  {
    name: "characterIcon restituisce l'icona giusta per un id noto, e ricade su person1 per uno sconosciuto/assente",
    fn: () => {
      assertEqual(characterIcon("detective"), CHARACTER_ICONS.detective);
      assertEqual(characterIcon("non-esiste"), CHARACTER_ICONS.person1);
      assertEqual(characterIcon(undefined), CHARACTER_ICONS.person1);
    },
  },
  {
    name: "ogni icona personaggio (incluso victim) ha un'etichetta e una stringa SVG ben formata",
    fn: () => {
      for (const [id, def] of Object.entries(CHARACTER_ICONS)) {
        assert(typeof def.label === "string" && def.label.length > 0, `${id} deve avere un'etichetta`);
        assert(def.icon.startsWith("<svg") && def.icon.endsWith("</svg>"), `${id} deve essere un tag <svg> completo`);
        assert(def.icon.includes('stroke="currentColor"'), `${id} deve poter essere colorato via currentColor`);
      }
    },
  },
  {
    name: "objectIcon restituisce la definizione giusta per un tipo noto, null per uno sconosciuto",
    fn: () => {
      assertEqual(objectIcon("chair"), OBJECT_TYPES.chair);
      assertEqual(objectIcon("non-esiste"), null);
    },
  },
  {
    name: "isObjectTypeOccupiable riflette esattamente il flag occupiable di OBJECT_TYPES",
    fn: () => {
      for (const [typeId, def] of Object.entries(OBJECT_TYPES)) {
        assertEqual(isObjectTypeOccupiable(typeId), !!def.occupiable, `discrepanza per ${typeId}`);
      }
      assertEqual(isObjectTypeOccupiable("non-esiste"), false);
    },
  },
  {
    name: "objectTypeTargetId/isObjectTypeTarget/parseObjectTypeTarget fanno un round-trip fedele",
    fn: () => {
      const targetId = objectTypeTargetId("door");
      assert(isObjectTypeTarget(targetId), "un id costruito da objectTypeTargetId deve essere riconosciuto come tale");
      assertEqual(parseObjectTypeTarget(targetId), "door");
      assert(!isObjectTypeTarget("char_abc123"), "un id personaggio/oggetto ordinario non è un bersaglio di tipo generico");
      assertEqual(parseObjectTypeTarget("char_abc123"), null);
      assertEqual(parseObjectTypeTarget(""), null, "una stringa vuota non è un bersaglio di tipo generico");
    },
  },
];
