import { t } from "../../i18n/i18n.js";
import { targetLabel, objectTypePhrase, OBJECT_TYPE_IDS, OBJECT_TYPE_LABELS, SHORT_DIRECTION_LABELS, SUPERLATIVE_DIRECTION_LABELS, describeProperty, describeNestedClue, optionalPropertyParams } from "./shared.js";
import { DIRECTIONS, DIRECTION_LABELS } from "../../util/geometry.js";

export const PLACEMENT_CLUES = {
  adjacent: {
    label: t("È accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => `È accanto a ${targetLabel(puzzle, params.targetId)}.`,
  },
  notAdjacent: {
    legacy: true,
    label: t("Non è accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => `Non è accanto a ${targetLabel(puzzle, params.targetId)}.`,
  },
  diagonal: {
    label: t("È in diagonale rispetto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => `È in diagonale rispetto a ${targetLabel(puzzle, params.targetId)}.`,
  },
  eitherAdjacent: {
    legacy: true,
    label: t("È accanto a uno tra due bersagli"),
    params: [
      { name: "targetAId", kind: "characterOrObject", label: t("Bersaglio A") },
      { name: "targetBId", kind: "characterOrObject", label: t("Bersaglio B") },
    ],
    describe: (params, puzzle) =>
      `È accanto a ${targetLabel(puzzle, params.targetAId)} oppure a ${targetLabel(puzzle, params.targetBId)}.`,
  },
  onObjectType: {
    label: t("Si trova su un oggetto di un certo tipo"),
    params: [{ name: "objectTypeId", kind: "enum", values: OBJECT_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: t("Tipo di oggetto") }],
    describe: (params) => `Si trova su ${objectTypePhrase(params.objectTypeId)}.`,
  },
  seated: {
    label: t("Era seduto/a (su una sedia, uno sgabello, o altro oggetto simile)"),
    // Nessun parametro: a differenza di "si trova su un oggetto di un certo
    // tipo" (che richiede di sceglierne uno), questo vale per qualunque
    // oggetto occupabile — sedia, sgabello, e ogni futuro tipo di seduta,
    // senza doverli elencare uno per uno o combinarli con "o uno o l'altro".
    params: [],
    describe: () => "Era seduto/a.",
  },
  between: {
    label: t("Si trova tra due bersagli"),
    params: [
      { name: "targetAId", kind: "characterOrObject", label: t("Bersaglio A") },
      { name: "targetBId", kind: "characterOrObject", label: t("Bersaglio B") },
    ],
    describe: (params, puzzle) =>
      `Si trova tra ${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)}.`,
  },
  direction: {
    legacy: true,
    label: t("È a nord/sud/est/ovest di"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) =>
      `È ${DIRECTION_LABELS[params.direction] || params.direction} ${targetLabel(puzzle, params.targetId)}.`,
  },
  directionDistance: {
    label: t("È a nord/sud/est/ovest di (a distanza precisa o generica)"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      { name: "distance", kind: "number", min: 1, optional: true, label: t("Distanza esatta (vuoto = una qualsiasi)") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) => {
      const dirLabel = DIRECTION_LABELS[params.direction] || params.direction;
      if (!params.distance) return `È ${dirLabel} ${targetLabel(puzzle, params.targetId)}.`;
      const isRowAxis = params.direction === "north" || params.direction === "south";
      const unit = params.distance === 1 ? (isRowAxis ? "riga" : "colonna") : (isRowAxis ? "righe" : "colonne");
      return `È a ${params.distance} ${unit} ${dirLabel} ${targetLabel(puzzle, params.targetId)}.`;
    },
  },
  inRowOrCol: {
    label: t("Si trova nella riga/colonna"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: t("Riga o colonna") },
      { name: "index", kind: "number", min: 1, label: t("Numero (1 = la prima)") },
    ],
    describe: (params) => `Si trova nella ${params.axis === "row" ? "riga" : "colonna"} ${params.index}.`,
  },
  rowOrColParity: {
    label: t("Si trova in una riga/colonna pari/dispari"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: t("Riga o colonna") },
      { name: "parity", kind: "enum", values: ["odd", "even"], labels: { odd: "Dispari", even: "Pari" }, label: t("Parità") },
    ],
    describe: (params) =>
      `Si trova in una ${params.axis === "row" ? "riga" : "colonna"} ${params.parity === "odd" ? "dispari" : "pari"} (contando da 1, come le etichette ${params.axis === "row" ? "R1, R2..." : "C1, C2..."}).`,
  },
  rowOrColWith: {
    label: t("Condivide riga/colonna con"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: t("Asse") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) =>
      `Condivide la ${params.axis === "row" ? "riga" : "colonna"} con ${targetLabel(puzzle, params.targetId)}.`,
  },
  inRowOrColWithAny: {
    label: t("Condivide riga/colonna con uno tra più bersagli"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: t("Asse") },
      { name: "targetIds", kind: "characterOrObjectMulti", label: t("Bersagli (Ctrl/Cmd-click per sceglierne più di uno)") },
    ],
    describe: (params, puzzle) => {
      const axisLabel = params.axis === "row" ? "la riga" : "la colonna";
      const names = (params.targetIds || []).map((id) => targetLabel(puzzle, id));
      return `Condivide ${axisLabel} con uno tra: ${names.length ? names.join(", ") : "?"}.`;
    },
  },
  rowOrColAdjacentTo: {
    label: t("Si trova in una riga/colonna adiacente a"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: t("Asse") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) =>
      `Si trova nella ${params.axis === "row" ? "riga" : "colonna"} subito accanto a quella di ${targetLabel(puzzle, params.targetId)}.`,
  },
  inCorner: {
    label: t("Si trova in un angolo"),
    params: [],
    describe: () => `Si trova in un angolo della mappa.`,
  },
  facing: {
    label: t("È di fronte a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => `È di fronte a ${targetLabel(puzzle, params.targetId)}.`,
  },
  closerTo: {
    label: t("È più vicino a un bersaglio che a un altro"),
    params: [
      { name: "targetAId", kind: "characterOrObject", label: t("Bersaglio più vicino") },
      { name: "targetBId", kind: "characterOrObject", label: t("Bersaglio più lontano") },
    ],
    describe: (params, puzzle) =>
      `È più vicino a ${targetLabel(puzzle, params.targetAId)} che a ${targetLabel(puzzle, params.targetBId)}.`,
  },
  someoneAtDirectionDistance: {
    label: t("C'è qualcuno a N righe/colonne a nord/sud/est/ovest di lui/lei"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      { name: "distance", kind: "number", min: 1, optional: true, label: t("Distanza esatta (vuoto = una qualsiasi)") },
      ...optionalPropertyParams,
    ],
    describe: (params, puzzle) => {
      const dirLabel = DIRECTION_LABELS[params.direction] || params.direction;
      const isRowAxis = params.direction === "north" || params.direction === "south";
      const unit = params.distance === 1 ? (isRowAxis ? "riga" : "colonna") : (isRowAxis ? "righe" : "colonne");
      const where = params.distance ? `a ${params.distance} ${unit} ${dirLabel}` : dirLabel;
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        return nested ? `C'è qualcuno ${where} lui/lei che verificava: ${nested}.` : `C'è qualcuno ${where} lui/lei.`;
      }
      const who = params.property ? `${params.property === "male" ? "un uomo" : params.property === "female" ? "una donna" : `qualcuno ${describeProperty(params, puzzle)}`}` : "qualcuno";
      return `C'è ${who} ${where} lui/lei.`;
    },
    negatedDescribe: (params, puzzle) => {
      const dirLabel = DIRECTION_LABELS[params.direction] || params.direction;
      const isRowAxis = params.direction === "north" || params.direction === "south";
      const unit = params.distance === 1 ? (isRowAxis ? "riga" : "colonna") : (isRowAxis ? "righe" : "colonne");
      const where = params.distance ? `a ${params.distance} ${unit} ${dirLabel}` : dirLabel;
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        return nested ? `Nessuno ${where} lui/lei verificava: ${nested}.` : `Nessuno si trova ${where} lui/lei.`;
      }
      const who = params.property === "male" ? "nessun uomo" : params.property === "female" ? "nessuna donna" : "nessuno";
      const rest = params.property && params.property !== "male" && params.property !== "female" ? ` ${describeProperty(params, puzzle)}` : "";
      return `${who[0].toUpperCase()}${who.slice(1)}${rest} si trova ${where} lui/lei.`;
    },
  },
  extremeInDirection: {
    label: t("È la persona più a nord/sud/est/ovest"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      { name: "scope", kind: "enum", values: ["map", "room"], labels: { map: "su tutta la mappa", room: "nella sua stanza" }, label: t("Tra chi") },
      ...optionalPropertyParams,
    ],
    describe: (params, puzzle) => {
      const where = params.scope === "room" ? " nella sua stanza" : "";
      const superlative = SUPERLATIVE_DIRECTION_LABELS[params.direction] || params.direction;
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return `È la persona più ${superlative}${where} tra chi verificava: ${nested}.`;
      }
      const who = params.property ? `la persona ${describeProperty(params, puzzle)}` : "la persona";
      return `È ${who} più ${superlative}${where}.`;
    },
  },
};
