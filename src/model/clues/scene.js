import { t } from "../../i18n/i18n.js";
import { targetLabel, describeProperty, describeNestedClue, propertyParams } from "./shared.js";

export const SCENE_CLUES = {

  // --- Generic clues: puzzle-wide scene facts, not owned by a character ---
  noOneInRoom: {
    scope: "generic",
    label: t("Nessuno si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => `Nessuno si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
    negatedDescribe: (params, puzzle) => `Qualcuno si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  noOneInRowOrCol: {
    scope: "generic",
    label: t("Nessuno si trova nella riga/colonna"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: t("Riga o colonna") },
      { name: "index", kind: "number", min: 1, label: t("Numero (1 = la prima)") },
    ],
    describe: (params) => `Nessuno si trova nella ${params.axis === "row" ? "riga" : "colonna"} ${params.index}.`,
    negatedDescribe: (params) => `Qualcuno si trova nella ${params.axis === "row" ? "riga" : "colonna"} ${params.index}.`,
  },
  exactlyOneInRoom: {
    scope: "generic",
    label: t("Esattamente una persona si trova nella stanza"),
    params: [{ name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) => `Esattamente una persona si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  noOneNear: {
    scope: "generic",
    label: t("Nessuno è vicino a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => `Nessuno è vicino a ${targetLabel(puzzle, params.targetId)}.`,
    negatedDescribe: (params, puzzle) => `Qualcuno è vicino a ${targetLabel(puzzle, params.targetId)}.`,
  },
  exactlyOneNear: {
    scope: "generic",
    label: t("Esattamente una persona è vicino a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => `Esattamente una persona è vicino a ${targetLabel(puzzle, params.targetId)}.`,
  },
  sameRoomTogether: {
    scope: "generic",
    label: t("Due bersagli si trovano nella stessa stanza"),
    params: [
      { name: "targetAId", kind: "character", label: t("Personaggio A") },
      { name: "targetBId", kind: "character", label: t("Personaggio B") },
    ],
    describe: (params, puzzle) =>
      `${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} si trovano nella stessa stanza.`,
    negatedDescribe: (params, puzzle) =>
      `${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} non si trovano nella stessa stanza.`,
  },
  emptyRoomsCount: {
    legacy: true,
    scope: "generic",
    label: t("N stanze sono vuote"),
    params: [{ name: "count", kind: "number", min: 0, label: t("Numero di stanze vuote") }],
    describe: (params) =>
      params.count === 1 ? `Esattamente una stanza è vuota.` : `Esattamente ${params.count} stanze sono vuote.`,
  },
  roomsWithStateCount: {
    scope: "generic",
    label: t("N stanze erano piene/vuote"),
    params: [
      { name: "count", kind: "number", min: 0, label: t("Numero di stanze") },
      { name: "state", kind: "enum", values: ["empty", "occupied"], labels: { empty: "vuote", occupied: "piene (almeno una persona)" }, label: t("Stato") },
    ],
    describe: (params) => {
      const plural = params.count !== 1;
      const noun = plural ? "stanze" : "stanza";
      const verb = plural ? "sono" : "è";
      const stateWord = params.state === "empty" ? "vuot" : "pien";
      return `Esattamente ${params.count} ${noun} ${verb} ${stateWord}${plural ? "e" : "a"}.`;
    },
  },
  emptyRoomsSameSize: {
    scope: "generic",
    label: t("N stanze erano vuote, con lo stesso numero di caselle"),
    params: [{ name: "count", kind: "number", min: 0, label: t("Numero di stanze vuote") }],
    describe: (params) => {
      const plural = params.count !== 1;
      const noun = plural ? "stanze" : "stanza";
      const verb = plural ? "sono" : "è";
      const sizeClause = params.count > 1 ? ", e hanno tutte lo stesso numero di caselle" : "";
      return `Esattamente ${params.count} ${noun} ${verb} vuot${plural ? "e" : "a"}${sizeClause}.`;
    },
  },
  sameRoomSizeAs: {
    scope: "generic",
    label: t("Le stanze di due bersagli avevano lo stesso numero di caselle"),
    params: [
      { name: "targetAId", kind: "character", label: t("Personaggio A") },
      { name: "targetBId", kind: "character", label: t("Personaggio B") },
    ],
    describe: (params, puzzle) =>
      `Le stanze di ${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} hanno lo stesso numero di caselle.`,
    negatedDescribe: (params, puzzle) =>
      `Le stanze di ${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} non hanno lo stesso numero di caselle.`,
  },
  noOneWithProperty: {
    scope: "generic",
    label: t("Nessuno era... (ovunque, o in una stanza specifica)"),
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
      const where = params.zoneId ? ` nella stanza ${targetLabel(puzzle, params.zoneId)}` : "";
      const who = params.onlyGender === "male" ? "Nessun uomo" : params.onlyGender === "female" ? "Nessuna donna" : "Nessuno";
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return `${who}${where} verifica: ${nested}.`;
      }
      return `${who} che è ${describeProperty(params, puzzle)} si trova${where}.`;
    },
    negatedDescribe: (params, puzzle) => {
      const where = params.zoneId ? ` nella stanza ${targetLabel(puzzle, params.zoneId)}` : "";
      const who = params.onlyGender === "male" ? "Un uomo" : params.onlyGender === "female" ? "Una donna" : "Qualcuno";
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return `${who}${where} verifica: ${nested}.`;
      }
      return `${who} che è ${describeProperty(params, puzzle)} si trova${where}.`;
    },
  },
};
