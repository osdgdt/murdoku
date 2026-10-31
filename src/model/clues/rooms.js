import { t } from "../../i18n/i18n.js";
import { targetLabel, propertyClause, propertyParams } from "./shared.js";

export const ROOMS_CLUES = {
  inRoom: {
    label: t("Si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => t("Si trova nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
  },
  notInRoom: {
    legacy: true,
    label: t("Non si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => t("Non si trova nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
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
  notSameRoomAs: {
    legacy: true,
    label: t("Non si trova nella stessa stanza di"),
    params: [{ name: "targetId", kind: "character", label: t("Personaggio") }],
    describe: (params, puzzle) => t("Non si trova nella stessa stanza di {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  onlyPersonNear: {
    label: t("È l'unica persona vicino a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("È l'unica persona vicino a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  aloneWithVictim: {
    legacy: true,
    label: t("È sola con la vittima nella stanza"),
    params: [],
    describe: () => t(`È sola con la vittima nella stanza.`),
  },
  // Not a real clue type — never offered in any "+ Indizio" dropdown
  // (`internal: true`, checked by characterClueTypeIds/genericClueTypeIds
  // alongside `legacy`). Registered here only so buildPredicates()'s
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
  aloneWithPerson: {
    label: t("È sola con (un personaggio)"),
    params: [{ name: "targetId", kind: "character", label: t("Personaggio") }],
    describe: (params, puzzle) => t("È sola con {v} nella stanza.", { v: targetLabel(puzzle, params.targetId) }),
  },
  aloneWithPersonProperty: {
    label: t("È sola con qualcuno che era..."),
    params: propertyParams,
    describe: (params, puzzle) => t("È sola nella stanza con qualcuno{v}.", { v: propertyClause(params, puzzle, "che era") }),
  },
  aloneInRoom: {
    label: t("È sola nella stanza"),
    params: [{ name: "zoneId", kind: "zone", optional: true, label: t("Stanza specifica (vuoto = quella in cui si trova)") }],
    describe: (params, puzzle) =>
      params.zoneId
        ? t("È l'unica persona nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) })
        : t(`È sola nella stanza in cui si trova.`),
  },
  onlyPersonInRoom: {
    legacy: true,
    label: t("È l'unica persona nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => t("È l'unica persona nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
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
    label: t("Qualcun altro nella sua stanza era..."),
    params: propertyParams,
    describe: (params, puzzle) => t("Qualcun altro nella sua stanza{v}.", { v: propertyClause(params, puzzle, "era") }),
    negatedDescribe: (params, puzzle) => t("Nessun altro nella sua stanza{v}.", { v: propertyClause(params, puzzle, "era") }),
  },
};
