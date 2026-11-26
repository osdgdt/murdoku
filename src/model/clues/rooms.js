import { t } from "../../i18n/i18n.js";
import {
  targetLabel,
  propertyClause,
  propertyParams,
  objectTypePhrase,
  describeNestedClue,
  OBJECT_TYPE_IDS,
  OBJECT_TYPE_LABELS,
} from "./shared.js";

export const ROOMS_CLUES = {
  inRoom: {
    label: t("Si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => t("Si trova nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
  },
  // «Nella sua stanza c'è un tavolo»: the room the person stands in has at least one object of that type.
  objectInRoom: {
    label: t("Nella sua stanza c'è un oggetto"),
    params: [{ name: "objectTypeId", kind: "enum", values: OBJECT_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: t("Tipo di oggetto") }],
    describe: (params) => t("Nella sua stanza c'è {object}.", { object: objectTypePhrase(params.objectTypeId) }),
    negatedDescribe: (params) => t("Nella sua stanza non c'è {object}.", { object: objectTypePhrase(params.objectTypeId) }),
  },
  zoneAdjacentTo: {
    label: t("Si trova in una stanza adiacente a"),
    // Target can be a specific room, but also a character/object (or object
    // type) — "adiacente a" then means adjacent to whichever room THEY end
    // up in, resolved dynamically like every other characterOrObject target.
    params: [{ name: "zoneId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("Si trova in una stanza adiacente a {v}.", { v: targetLabel(puzzle, params.zoneId) }),
  },
  sameRoomAs: {
    label: t("Si trova nella stessa stanza di"),
    params: [{ name: "targetId", kind: "character", label: t("Personaggio") }],
    describe: (params, puzzle) => t("Si trova nella stessa stanza di {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  onlyPersonNear: {
    label: t("È l'unica persona accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("È l'unica persona accanto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  // Not a real clue type — never offered in any "+ Indizio" dropdown
  // (`internal: true`, checked by characterClueTypeIds/genericClueTypeIds). Registered here only so buildPredicates()'s
  // always-on base-rule entry (predicates.js) has a describe() to show in
  // "Valida soluzione" violation messages, without a whole separate
  // description path just for one hardcoded string.
  victimRoomRule: {
    internal: true,
    scope: "generic",
    label: t("La vittima è sola con l'assassino nella sua stanza"),
    params: [],
    describe: () => t("La vittima deve trovarsi in una stanza con esattamente un'altra persona: l'assassino."),
  },
  // Built-in rule of the maps with seals, like victimRoomRule: not offered anywhere, it only has a text for messages.
  sealRule: {
    internal: true,
    scope: "generic",
    label: t("Sigilli: Anubi vuole la solitudine, Ra la compagnia"),
    params: [],
    describe: () => t("Chi sta sul sigillo di Anubi è solo nella sua stanza; chi sta sul sigillo di Ra non è solo."),
  },
  aloneWithPerson: {
    label: t("È nella stanza solo con (un personaggio)"),
    params: [{ name: "targetId", kind: "character", label: t("Personaggio") }],
    describe: (params, puzzle) => t("È nella stanza solo con {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  aloneWithPersonProperty: {
    label: t("È nella stanza solo con qualcuno che è..."),
    params: propertyParams,
    describe: (params, puzzle) => t("È nella stanza solo con qualcuno{v}.", { v: propertyClause(params, puzzle, "che è") }),
  },
  // «È l'unica persona seduta su una sedia»: the owner has the property and nobody else on the whole map does.
  onlyOneWithProperty: {
    label: t("È l'unica persona che..."),
    params: propertyParams,
    describe: (params, puzzle) => {
      switch (params.property) {
        case "male":
          return t("È l'unico uomo.");
        case "female":
          return t("È l'unica donna.");
        case "seated":
          return t("È l'unica persona seduta.");
        case "sittingOn":
          return t("È l'unica persona seduta su {object}.", { object: objectTypePhrase(params.objectTypeId) });
        case "adjacentTo":
          return t("È l'unica persona accanto a {target}.", { target: targetLabel(puzzle, params.targetId) });
        case "custom": {
          const nested = describeNestedClue(params.customClue, puzzle);
          return nested ? t("È l'unica persona per cui vale: {condition}.", { condition: nested }) : t("È l'unica persona che ?.");
        }
        default:
          return t("È l'unica persona che ?.");
      }
    },
  },
  aloneInRoom: {
    label: t("È l'unica persona nella stanza"),
    params: [{ name: "zoneId", kind: "zone", optional: true, label: t("Stanza specifica (vuoto = quella in cui si trova)") }],
    describe: (params, puzzle) =>
      params.zoneId
        ? t("È l'unica persona nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) })
        : t("È l'unica persona nella stanza in cui si trova."),
  },
  inRoomCorner: {
    label: t("Si trova in un angolo della sua stanza"),
    // Diverso da "si trova in un angolo": quello vale solo per i 4 angoli
    // dell'intera mappa; questo vale per gli angoli della stanza in cui si
    // trova il personaggio, qualunque forma abbia (anche irregolare) e
    // ovunque sia sulla mappa.
    params: [],
    describe: () => t("Si trova in un angolo della sua stanza."),
  },
  someoneInRoomWithProperty: {
    label: t("Qualcun altro nella sua stanza è..."),
    params: propertyParams,
    describe: (params, puzzle) => t("Qualcun altro nella sua stanza{v}.", { v: propertyClause(params, puzzle, "è") }),
    negatedDescribe: (params, puzzle) => t("Nessun altro nella sua stanza{v}.", { v: propertyClause(params, puzzle, "è") }),
  },
};
