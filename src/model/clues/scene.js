import { t } from "../../i18n/i18n.js";
import { targetLabel, axisNoun, describeProperty, describeNestedClue, propertyParams } from "./shared.js";

// "No one [who is X] is in the room Z" and its negation ("Someone ..."), for noOneWithProperty.
function noOneWithPropertySentence(params, puzzle, negated) {
  const where = params.zoneId ? t(" nella stanza {zone}", { zone: targetLabel(puzzle, params.zoneId) }) : t(" sulla mappa");
  const gender = params.property === "male" || params.property === "female" ? params.property : params.onlyGender;
  const who = negated
    ? gender === "male"
      ? t("Un uomo")
      : gender === "female"
        ? t("Una donna")
        : t("Qualcuno")
    : gender === "male"
      ? t("Nessun uomo")
      : gender === "female"
        ? t("Nessuna donna")
        : t("Nessuno");
  if (params.property === "custom") {
    const nested = describeNestedClue(params.customClue, puzzle);
    if (nested) return t("{who}{where} verifica: {nested}.", { who, where, nested });
  }
  // The property is the gender itself, or not chosen yet: nothing more to say about the person.
  if (params.property === "male" || params.property === "female" || !params.property) return t("{who} si trova{where}.", { who, where });
  return t("{who} che è {v} si trova{where}.", { who, v: describeProperty(params, puzzle), where });
}

// "Exactly 2 people are next to a table" (+ ", always the same one" when they must all be at the same target) and its negation.
function peopleNearSentence(params, puzzle, negated) {
  const count = Number.isFinite(params.count) ? params.count : 1;
  const v = targetLabel(puzzle, params.targetId);
  const same = params.together === "same" && count > 1;
  if (negated) {
    return same
      ? t("Non ci sono esattamente {count} persone accanto a {v}, sempre lo stesso.", { count, v })
      : count === 1
        ? t("Non c'è esattamente una persona accanto a {v}.", { v })
        : t("Non ci sono esattamente {count} persone accanto a {v}.", { count, v });
  }
  if (count === 1) return t("Esattamente una persona è accanto a {v}.", { v });
  return same
    ? t("Esattamente {count} persone sono accanto a {v}, sempre lo stesso.", { count, v })
    : t("Esattamente {count} persone sono accanto a {v}.", { count, v });
}

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
  // «Due persone erano accanto a un tavolo»: any number of people (not just one), next to ANY of the targets, or always next to
  // the same one (`together: "same"`: one of the tables has exactly that many people around it).
  peopleNear: {
    scope: "generic",
    label: t("Esattamente N persone sono accanto a"),
    params: [
      { name: "count", kind: "number", min: 1, label: t("Quante persone") },
      { name: "targetId", kind: "characterOrObject", label: t("Bersaglio") },
      {
        name: "together",
        kind: "enum",
        values: ["any", "same"],
        labels: { any: t("uno qualsiasi, anche diversi"), same: t("lo stesso") },
        label: t("Accanto a"),
      },
    ],
    describe: (params, puzzle) => peopleNearSentence(params, puzzle, false),
    negatedDescribe: (params, puzzle) => peopleNearSentence(params, puzzle, true),
  },
  sameRoomTogether: {
    scope: "generic",
    label: t("Due bersagli si trovano nella stessa stanza"),
    params: [
      { name: "targetAId", kind: "character", label: t("Personaggio A") },
      { name: "targetBId", kind: "character", label: t("Personaggio B") },
    ],
    describe: (params, puzzle) =>
      t("{v} e {v2} si trovano nella stessa stanza.", {
        v: targetLabel(puzzle, params.targetAId),
        v2: targetLabel(puzzle, params.targetBId),
      }),
    negatedDescribe: (params, puzzle) =>
      t("{v} e {v2} non si trovano nella stessa stanza.", {
        v: targetLabel(puzzle, params.targetAId),
        v2: targetLabel(puzzle, params.targetBId),
      }),
  },
  roomsWithStateCount: {
    scope: "generic",
    label: t("N stanze sono piene/vuote"),
    params: [
      { name: "count", kind: "number", min: 0, label: t("Numero di stanze") },
      {
        name: "state",
        kind: "enum",
        values: ["empty", "occupied"],
        labels: { empty: t("vuote"), occupied: t("piene (almeno una persona)") },
        label: t("Stato"),
      },
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
      t("Le stanze di {v} e {v2} hanno lo stesso numero di caselle.", {
        v: targetLabel(puzzle, params.targetAId),
        v2: targetLabel(puzzle, params.targetBId),
      }),
    negatedDescribe: (params, puzzle) =>
      t("Le stanze di {v} e {v2} non hanno lo stesso numero di caselle.", {
        v: targetLabel(puzzle, params.targetAId),
        v2: targetLabel(puzzle, params.targetBId),
      }),
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
        labels: { "": t("chiunque"), male: t("solo uomini"), female: t("solo donne") },
        label: t("Genere"),
      },
      ...propertyParams,
    ],
    // A gender in `property` ("un uomo"/"una donna") already says who; the separate gender
    // filter would repeat it ("nessuna donna che è un uomo"), so `property` wins.
    describe: (params, puzzle) => noOneWithPropertySentence(params, puzzle, false),
    negatedDescribe: (params, puzzle) => noOneWithPropertySentence(params, puzzle, true),
  },
};
