import { t } from "../../i18n/i18n.js";
import { targetLabel, axisNoun, describeProperty, describeNestedClue, propertyParams } from "./shared.js";

export const SCENE_CLUES = {

  // --- Generic clues: puzzle-wide scene facts, not owned by a character ---
  noOneInRoom: {
    scope: "generic",
    label: t("Nessuno si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => t("Nessuno si trova nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
    negatedDescribe: (params, puzzle) => t("Qualcuno si trova nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
  },
  noOneInRowOrCol: {
    scope: "generic",
    label: t("Nessuno si trova nella riga/colonna"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: t("Riga"), col: t("Colonna") }, label: t("Riga o colonna") },
      { name: "index", kind: "number", min: 1, label: t("Numero (1 = la prima)") },
    ],
    describe: (params) => t("Nessuno si trova nella {axis} {index}.", { axis: axisNoun(params.axis), index: params.index }),
    negatedDescribe: (params) => t("Qualcuno si trova nella {axis} {index}.", { axis: axisNoun(params.axis), index: params.index }),
  },
  exactlyOneInRoom: {
    scope: "generic",
    label: t("Esattamente una persona si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => t("Esattamente una persona si trova nella stanza {v}.", { v: targetLabel(puzzle, params.zoneId) }),
  },
  noOneNear: {
    scope: "generic",
    label: t("Nessuno è accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("Nessuno è accanto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
    negatedDescribe: (params, puzzle) => t("Qualcuno è accanto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  exactlyOneNear: {
    scope: "generic",
    label: t("Esattamente una persona è accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("Esattamente una persona è accanto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  sameRoomTogether: {
    scope: "generic",
    label: t("Due bersagli si trovano nella stessa stanza"),
    params: [
      { name: "targetAId", kind: "character", label: t("Personaggio A") },
      { name: "targetBId", kind: "character", label: t("Personaggio B") },
    ],
    describe: (params, puzzle) =>
      t("{v} e {v2} si trovano nella stessa stanza.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
    negatedDescribe: (params, puzzle) =>
      t("{v} e {v2} non si trovano nella stessa stanza.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
  },
  roomsWithStateCount: {
    scope: "generic",
    label: t("N stanze sono piene/vuote"),
    params: [
      { name: "count", kind: "number", min: 0, label: t("Numero di stanze") },
      { name: "state", kind: "enum", values: ["empty", "occupied"], labels: { empty: "vuote", occupied: t("piene (almeno una persona)") }, label: t("Stato") },
    ],
    describe: (params) => {
      const count = params.count;
      if (params.state === "empty") {
        return count === 1 ? t("Esattamente {count} stanza è vuota.", { count }) : t("Esattamente {count} stanze sono vuote.", { count });
      }
      return count === 1 ? t("Esattamente {count} stanza è piena.", { count }) : t("Esattamente {count} stanze sono piene.", { count });
    },
  },
  emptyRoomsSameSize: {
    scope: "generic",
    label: t("N stanze sono vuote, con lo stesso numero di caselle"),
    params: [{ name: "count", kind: "number", min: 0, label: t("Numero di stanze vuote") }],
    describe: (params) => {
      const count = params.count;
      if (count === 1) return t("Esattamente {count} stanza è vuota.", { count });
      return t("Esattamente {count} stanze sono vuote, e hanno tutte lo stesso numero di caselle.", { count });
    },
  },
  sameRoomSizeAs: {
    scope: "generic",
    label: t("Le stanze di due bersagli hanno lo stesso numero di caselle"),
    params: [
      { name: "targetAId", kind: "character", label: t("Personaggio A") },
      { name: "targetBId", kind: "character", label: t("Personaggio B") },
    ],
    describe: (params, puzzle) =>
      t("Le stanze di {v} e {v2} hanno lo stesso numero di caselle.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
    negatedDescribe: (params, puzzle) =>
      t("Le stanze di {v} e {v2} non hanno lo stesso numero di caselle.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
  },
  noOneWithProperty: {
    scope: "generic",
    label: t("Nessuno è... (ovunque, o in una stanza specifica)"),
    params: [
      { name: "zoneId", kind: "zone", optional: true, label: t("Solo in questa stanza (vuoto = ovunque)") },
      {
        name: "onlyGender",
        kind: "enum",
        values: ["", "male", "female"],
        labels: { "": "chiunque", male: "solo uomini", female: "solo donne" },
        label: t("Genere"),
      },
      ...propertyParams,
    ],
    describe: (params, puzzle) => {
      const where = params.zoneId ? t(" nella stanza {zone}", { zone: targetLabel(puzzle, params.zoneId) }) : "";
      const who = params.onlyGender === "male" ? t("Nessun uomo") : params.onlyGender === "female" ? t("Nessuna donna") : t("Nessuno");
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return t("{who}{where} verifica: {nested}.", { who, where, nested });
      }
      return t("{who} che è {v} si trova{where}.", { who, v: describeProperty(params, puzzle), where });
    },
    negatedDescribe: (params, puzzle) => {
      const where = params.zoneId ? t(" nella stanza {zone}", { zone: targetLabel(puzzle, params.zoneId) }) : "";
      const who = params.onlyGender === "male" ? t("Un uomo") : params.onlyGender === "female" ? t("Una donna") : t("Qualcuno");
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return t("{who}{where} verifica: {nested}.", { who, where, nested });
      }
      return t("{who} che è {v} si trova{where}.", { who, v: describeProperty(params, puzzle), where });
    },
  },
};
