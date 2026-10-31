import { t } from "../../i18n/i18n.js";
import { targetLabel, axisNoun, distancePhrase, objectTypePhrase, OBJECT_TYPE_IDS, OBJECT_TYPE_LABELS, SHORT_DIRECTION_LABELS, SUPERLATIVE_DIRECTION_LABELS, describeProperty, describeNestedClue, optionalPropertyParams } from "./shared.js";
import { DIRECTIONS, DIRECTION_LABELS } from "../../util/geometry.js";

export const PLACEMENT_CLUES = {
  adjacent: {
    label: t("È accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("È accanto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  notAdjacent: {
    legacy: true,
    label: t("Non è accanto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("Non è accanto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  diagonal: {
    label: t("È in diagonale rispetto a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("È in diagonale rispetto a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  eitherAdjacent: {
    legacy: true,
    label: t("È accanto a uno tra due bersagli"),
    params: [
      { name: "targetAId", kind: "characterOrObject", label: t("Bersaglio A") },
      { name: "targetBId", kind: "characterOrObject", label: t("Bersaglio B") },
    ],
    describe: (params, puzzle) =>
      t("È accanto a {v} oppure a {v2}.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
  },
  onObjectType: {
    label: t("Si trova su un oggetto di un certo tipo"),
    params: [{ name: "objectTypeId", kind: "enum", values: OBJECT_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: t("Tipo di oggetto") }],
    describe: (params) => t("Si trova su {v}.", { v: objectTypePhrase(params.objectTypeId) }),
  },
  seated: {
    label: t("Era seduto/a (su una sedia, uno sgabello, o altro oggetto simile)"),
    // Nessun parametro: a differenza di "si trova su un oggetto di un certo
    // tipo" (che richiede di sceglierne uno), questo vale per qualunque
    // oggetto occupabile — sedia, sgabello, e ogni futuro tipo di seduta,
    // senza doverli elencare uno per uno o combinarli con "o uno o l'altro".
    params: [],
    describe: () => t("Era seduto/a."),
  },
  between: {
    label: t("Si trova tra due bersagli"),
    params: [
      { name: "targetAId", kind: "characterOrObject", label: t("Bersaglio A") },
      { name: "targetBId", kind: "characterOrObject", label: t("Bersaglio B") },
    ],
    describe: (params, puzzle) =>
      t("Si trova tra {v} e {v2}.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
  },
  direction: {
    legacy: true,
    label: t("È a nord/sud/est/ovest di"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) =>
      t("È {dir} {target}.", { dir: DIRECTION_LABELS[params.direction] || params.direction, target: targetLabel(puzzle, params.targetId) }),
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
      const target = targetLabel(puzzle, params.targetId);
      if (!params.distance) return t("È {dir} {target}.", { dir: dirLabel, target });
      return t("È {where} {target}.", { where: distancePhrase(params.direction, params.distance, dirLabel), target });
    },
  },
  inRowOrCol: {
    label: t("Si trova nella riga/colonna"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: t("Riga"), col: t("Colonna") }, label: t("Riga o colonna") },
      { name: "index", kind: "number", min: 1, label: t("Numero (1 = la prima)") },
    ],
    describe: (params) => t("Si trova nella {axis} {index}.", { axis: axisNoun(params.axis), index: params.index }),
  },
  rowOrColParity: {
    label: t("Si trova in una riga/colonna pari/dispari"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: t("Riga"), col: t("Colonna") }, label: t("Riga o colonna") },
      { name: "parity", kind: "enum", values: ["odd", "even"], labels: { odd: t("Dispari"), even: t("Pari") }, label: t("Parità") },
    ],
    describe: (params) =>
      t("Si trova in una {axis} {parity} (contando da 1, come le etichette {labels}).", { axis: axisNoun(params.axis), parity: params.parity === "odd" ? t("dispari") : t("pari"), labels: params.axis === "row" ? "R1, R2..." : "C1, C2..." }),
  },
  rowOrColWith: {
    label: t("Condivide riga/colonna con"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: t("Riga"), col: t("Colonna") }, label: t("Asse") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) =>
      t("Condivide la {axis} con {target}.", { axis: axisNoun(params.axis), target: targetLabel(puzzle, params.targetId) }),
  },
  inRowOrColWithAny: {
    label: t("Condivide riga/colonna con uno tra più bersagli"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: t("Riga"), col: t("Colonna") }, label: t("Asse") },
      { name: "targetIds", kind: "characterOrObjectMulti", label: t("Bersagli (Ctrl/Cmd-click per sceglierne più di uno)") },
    ],
    describe: (params, puzzle) => {
      const names = (params.targetIds || []).map((id) => targetLabel(puzzle, id));
      return t("Condivide la {axis} con uno tra: {names}.", { axis: axisNoun(params.axis), names: names.length ? names.join(", ") : "?" });
    },
  },
  rowOrColAdjacentTo: {
    label: t("Si trova in una riga/colonna adiacente a"),
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: t("Riga"), col: t("Colonna") }, label: t("Asse") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
    ],
    describe: (params, puzzle) =>
      t("Si trova nella {axis} subito accanto a quella di {target}.", { axis: axisNoun(params.axis), target: targetLabel(puzzle, params.targetId) }),
  },
  inCorner: {
    label: t("Si trova in un angolo"),
    params: [],
    describe: () => t("Si trova in un angolo della mappa."),
  },
  facing: {
    label: t("È di fronte a"),
    params: [{ name: "targetId", kind: "characterOrObject", label: t("Bersaglio") }],
    describe: (params, puzzle) => t("È di fronte a {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  closerTo: {
    label: t("È più vicino a un bersaglio che a un altro"),
    params: [
      { name: "targetAId", kind: "characterOrObject", label: t("Bersaglio più vicino") },
      { name: "targetBId", kind: "characterOrObject", label: t("Bersaglio più lontano") },
    ],
    describe: (params, puzzle) =>
      t("È più vicino a {v} che a {v2}.", { v: targetLabel(puzzle, params.targetAId), v2: targetLabel(puzzle, params.targetBId) }),
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
      const where = params.distance ? distancePhrase(params.direction, params.distance, dirLabel) : dirLabel;
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        return nested ? t("C'è qualcuno {where} lui/lei che verificava: {nested}.", { where, nested }) : t("C'è qualcuno {where} lui/lei.", { where });
      }
      const who = params.property ? (params.property === "male" ? t("un uomo") : params.property === "female" ? t("una donna") : t("qualcuno {property}", { property: describeProperty(params, puzzle) })) : t("qualcuno");
      return t("C'è {who} {where} lui/lei.", { who, where });
    },
    negatedDescribe: (params, puzzle) => {
      const dirLabel = DIRECTION_LABELS[params.direction] || params.direction;
      const where = params.distance ? distancePhrase(params.direction, params.distance, dirLabel) : dirLabel;
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        return nested ? t("Nessuno {where} lui/lei verificava: {nested}.", { where, nested }) : t("Nessuno si trova {where} lui/lei.", { where });
      }
      if (params.property === "male") return t("Nessun uomo si trova {where} lui/lei.", { where });
      if (params.property === "female") return t("Nessuna donna si trova {where} lui/lei.", { where });
      if (params.property) return t("Nessuno {property} si trova {where} lui/lei.", { property: describeProperty(params, puzzle), where });
      return t("Nessuno si trova {where} lui/lei.", { where });
    },
  },
  extremeInDirection: {
    label: t("È la persona più a nord/sud/est/ovest"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      { name: "scope", kind: "enum", values: ["map", "room"], labels: { map: t("su tutta la mappa"), room: t("nella sua stanza") }, label: t("Tra chi") },
      ...optionalPropertyParams,
    ],
    describe: (params, puzzle) => {
      const where = params.scope === "room" ? t(" nella sua stanza") : "";
      const superlative = SUPERLATIVE_DIRECTION_LABELS[params.direction] || params.direction;
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return t("È la persona più {superlative}{where} tra chi verificava: {nested}.", { superlative, where, nested });
      }
      const who = params.property ? t("la persona {property}", { property: describeProperty(params, puzzle) }) : t("la persona");
      return t("È {who} più {superlative}{where}.", { who, superlative, where });
    },
  },
};
