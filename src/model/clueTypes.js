import { DIRECTIONS, DIRECTION_LABELS } from "../util/geometry.js";
import { OBJECT_TYPES, objectIcon, isObjectTypeTarget, parseObjectTypeTarget } from "./icons.js";

// Each clue type declares its label, the shape of its params (for the builder UI),
// and a describe() function for human-readable text. Predicate logic lives in
// solver/predicates.js (kept separate so the solver module has no DOM/UI concerns).
//
// `scope` says who can hold this clue type:
// - "character" (default, omitted): attached to one character's card, describes
//   that character's own position ("È accanto a...").
// - "generic": a puzzle-wide scene fact, not owned by any character
//   (clue.characterId is null) — e.g. "Nessuno si trova in questa stanza."
//
// Every clue — whatever its type — can also be flipped to its negation via
// `clue.negate` (a checkbox in the builder UI, not a param), instead of
// registering a mirror-image type for each one; see describeClue() below and
// buildPredicate() in predicates.js. A few older types (`notAdjacent`,
// `notInRoom`, `notSameRoomAs`, `direction`, `onlyPersonInRoom`,
// `aloneWithVictim`) predate that and are kept working for puzzles that
// already use them, but are marked `legacy: true` so new clues use the
// unified form instead (e.g. `adjacent` + negate, or `directionDistance`
// with an empty distance).

function targetLabel(puzzle, targetId) {
  if (isObjectTypeTarget(targetId)) {
    const def = objectIcon(parseObjectTypeTarget(targetId));
    return def ? `${def.article} ${def.label.toLowerCase()}` : "un oggetto";
  }
  const character = puzzle.characters.find((c) => c.id === targetId);
  if (character) return character.name;
  const zone = puzzle.grid.zones.find((z) => z.id === targetId);
  if (zone) return `"${zone.name}"`;
  const object = puzzle.grid.objects.find((o) => o.id === targetId);
  if (object) return objectTypePhrase(object.typeId);
  return "?";
}

function objectTypePhrase(typeId) {
  const def = OBJECT_TYPES[typeId];
  return def ? `${def.article} ${def.label.toLowerCase()}` : "un oggetto";
}

// Shared "property a person can have", reused by `someoneInRoomWithProperty`
// ("qualcun altro nella stanza era..."), `extremeInDirection`,
// `aloneWithPersonProperty`, `noOneWithProperty`, and `someoneAtDirectionDistance`
// instead of duplicating adjacency/gender/posture logic across every one of
// them. `custom` is the escape hatch for anything the fixed choices don't
// cover: instead of a simple adjective, it nests a WHOLE other clue (any
// type, with its own params) to test against the person in question — e.g.
// "qualcuno due righe a nord di lei [che era] in una stanza adiacente al
// bagno" nests a `zoneAdjacentTo` clue inside `someoneAtDirectionDistance`.
const PERSON_PROPERTIES = ["adjacentTo", "male", "female", "sittingOn", "seated", "custom"];
const PERSON_PROPERTY_LABELS = {
  adjacentTo: "accanto a...",
  male: "un uomo",
  female: "una donna",
  sittingOn: "seduto su...",
  // Distinct from "seduto su..." (un tipo di oggetto specifico): questa vale
  // per qualunque oggetto su cui ci si può sedere (sedia, sgabello, ecc.),
  // senza doverne scegliere uno.
  seated: "seduto/a (su una sedia, uno sgabello, o simili)",
  custom: "che soddisfaceva un'altra condizione...",
};
const OBJECT_TYPE_IDS = Object.keys(OBJECT_TYPES);
const OBJECT_TYPE_LABELS = Object.fromEntries(OBJECT_TYPE_IDS.map((id) => [id, OBJECT_TYPES[id].label]));
const SHORT_DIRECTION_LABELS = { north: "Nord", south: "Sud", east: "Est", west: "Ovest" };
const SUPERLATIVE_DIRECTION_LABELS = { north: "a nord", south: "a sud", east: "a est", west: "a ovest" };

function describeProperty(params, puzzle) {
  switch (params.property) {
    case "adjacentTo": return `accanto a ${targetLabel(puzzle, params.targetId)}`;
    case "male": return "un uomo";
    case "female": return "una donna";
    // Agrees with `onlyGender` when the clue sets it (currently only
    // noOneWithProperty) — e.g. "nessuna donna... seduta su uno sgabello"
    // instead of the ungrammatical "...seduto...". Every other caller of
    // describeProperty simply never sets onlyGender, so this stays "seduto".
    case "sittingOn": return `${params.onlyGender === "female" ? "seduta" : "seduto"} su ${objectTypePhrase(params.objectTypeId)}`;
    case "seated": return params.onlyGender === "female" ? "seduta" : "seduto";
    default: return "presente";
  }
}

// Strips a nested clue spec down to its own full sentence, for embedding
// after a colon (used only by the `custom` property case, since an arbitrary
// nested clue's own verb can't be grafted onto "...era X" the way the fixed
// properties above can).
function describeNestedClue(spec, puzzle) {
  if (!spec?.type) return null;
  return describeClue({ type: spec.type, params: spec.params, negate: spec.negate }, puzzle).replace(/\.\s*$/, "");
}

// Builds the "<verb> <property>" fragment shared by every clue type built on
// propertyParams/optionalPropertyParams — e.g. propertyClause(params, puzzle,
// " era") yields " era un uomo". For `custom`, there's no adjective to embed,
// so it switches to a colon-introduced clause instead: ": <condition>".
function propertyClause(params, puzzle, verb) {
  if (params.property === "custom") {
    const nested = describeNestedClue(params.customClue, puzzle);
    return nested ? `: ${nested}` : `${verb} presente`;
  }
  return `${verb} ${describeProperty(params, puzzle)}`;
}

const propertyParams = [
  { name: "property", kind: "enum", values: PERSON_PROPERTIES, labels: PERSON_PROPERTY_LABELS, label: "Proprietà" },
  { name: "targetId", kind: "characterOrObject", label: "Bersaglio (se 'accanto a')" },
  { name: "objectTypeId", kind: "enum", values: OBJECT_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: "Tipo di oggetto (se 'seduto su')" },
  { name: "customClue", kind: "clueRef", label: "Condizione (se 'un'altra condizione')" },
];
// Same, but the property filter itself is optional ("chiunque") — for clue
// types where a plain, unfiltered "someone" is the natural default.
const optionalPropertyParams = [
  { name: "property", kind: "enum", values: ["", ...PERSON_PROPERTIES], labels: { "": "chiunque", ...PERSON_PROPERTY_LABELS }, label: "Che era..." },
  ...propertyParams.slice(1),
];

export const CLUE_TYPES = {
  adjacent: {
    label: "È accanto a",
    params: [{ name: "targetId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `È accanto a ${targetLabel(puzzle, params.targetId)}.`,
  },
  notAdjacent: {
    legacy: true,
    label: "Non è accanto a",
    params: [{ name: "targetId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `Non è accanto a ${targetLabel(puzzle, params.targetId)}.`,
  },
  diagonal: {
    label: "È in diagonale rispetto a",
    params: [{ name: "targetId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `È in diagonale rispetto a ${targetLabel(puzzle, params.targetId)}.`,
  },
  eitherAdjacent: {
    legacy: true,
    label: "È accanto a uno tra due bersagli",
    params: [
      { name: "targetAId", kind: "characterOrObject", label: "Bersaglio A" },
      { name: "targetBId", kind: "characterOrObject", label: "Bersaglio B" },
    ],
    describe: (params, puzzle) =>
      `È accanto a ${targetLabel(puzzle, params.targetAId)} oppure a ${targetLabel(puzzle, params.targetBId)}.`,
  },
  onObjectType: {
    label: "Si trova su un oggetto di un certo tipo",
    params: [{ name: "objectTypeId", kind: "enum", values: OBJECT_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: "Tipo di oggetto" }],
    describe: (params) => `Si trova su ${objectTypePhrase(params.objectTypeId)}.`,
  },
  seated: {
    label: "Era seduto/a (su una sedia, uno sgabello, o altro oggetto simile)",
    // Nessun parametro: a differenza di "si trova su un oggetto di un certo
    // tipo" (che richiede di sceglierne uno), questo vale per qualunque
    // oggetto occupabile — sedia, sgabello, e ogni futuro tipo di seduta,
    // senza doverli elencare uno per uno o combinarli con "o uno o l'altro".
    params: [],
    describe: () => "Era seduto/a.",
  },
  between: {
    label: "Si trova tra due bersagli",
    params: [
      { name: "targetAId", kind: "characterOrObject", label: "Bersaglio A" },
      { name: "targetBId", kind: "characterOrObject", label: "Bersaglio B" },
    ],
    describe: (params, puzzle) =>
      `Si trova tra ${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)}.`,
  },
  direction: {
    legacy: true,
    label: "È a nord/sud/est/ovest di",
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: "Direzione" },
      { name: "targetId", kind: "characterOrObject", label: "Bersaglio" },
    ],
    describe: (params, puzzle) =>
      `È ${DIRECTION_LABELS[params.direction] || params.direction} ${targetLabel(puzzle, params.targetId)}.`,
  },
  directionDistance: {
    label: "È a nord/sud/est/ovest di (a distanza precisa o generica)",
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: "Direzione" },
      { name: "distance", kind: "number", min: 1, optional: true, label: "Distanza esatta (vuoto = una qualsiasi)" },
      { name: "targetId", kind: "characterOrObject", label: "Bersaglio" },
    ],
    describe: (params, puzzle) => {
      const dirLabel = DIRECTION_LABELS[params.direction] || params.direction;
      if (!params.distance) return `È ${dirLabel} ${targetLabel(puzzle, params.targetId)}.`;
      const isRowAxis = params.direction === "north" || params.direction === "south";
      const unit = params.distance === 1 ? (isRowAxis ? "riga" : "colonna") : (isRowAxis ? "righe" : "colonne");
      return `È a ${params.distance} ${unit} ${dirLabel} ${targetLabel(puzzle, params.targetId)}.`;
    },
  },
  inRoom: {
    label: "Si trova nella stanza",
    params: [{ name: "zoneId", kind: "zone", label: "Stanza" }],
    describe: (params, puzzle) => `Si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  notInRoom: {
    legacy: true,
    label: "Non si trova nella stanza",
    params: [{ name: "zoneId", kind: "zone", label: "Stanza" }],
    describe: (params, puzzle) => `Non si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  zoneAdjacentTo: {
    label: "Si trova in una stanza adiacente a",
    // Target can be a specific room, but also a character/object (or object
    // type) — "adiacente a" then means adjacent to whichever room THEY end
    // up in, resolved dynamically like every other characterOrObject target.
    params: [{ name: "zoneId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `Si trova in una stanza adiacente a ${targetLabel(puzzle, params.zoneId)}.`,
  },
  inRowOrCol: {
    label: "Si trova nella riga/colonna",
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: "Riga o colonna" },
      { name: "index", kind: "number", min: 1, label: "Numero (1 = la prima)" },
    ],
    describe: (params) => `Si trova nella ${params.axis === "row" ? "riga" : "colonna"} ${params.index}.`,
  },
  rowOrColParity: {
    label: "Si trova in una riga/colonna pari/dispari",
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: "Riga o colonna" },
      { name: "parity", kind: "enum", values: ["odd", "even"], labels: { odd: "Dispari", even: "Pari" }, label: "Parità" },
    ],
    describe: (params) =>
      `Si trova in una ${params.axis === "row" ? "riga" : "colonna"} ${params.parity === "odd" ? "dispari" : "pari"} (contando da 1, come le etichette ${params.axis === "row" ? "R1, R2..." : "C1, C2..."}).`,
  },
  sameRoomAs: {
    label: "Si trova nella stessa stanza di",
    params: [{ name: "targetId", kind: "character", label: "Personaggio" }],
    describe: (params, puzzle) => `Si trova nella stessa stanza di ${targetLabel(puzzle, params.targetId)}.`,
  },
  notSameRoomAs: {
    legacy: true,
    label: "Non si trova nella stessa stanza di",
    params: [{ name: "targetId", kind: "character", label: "Personaggio" }],
    describe: (params, puzzle) => `Non si trova nella stessa stanza di ${targetLabel(puzzle, params.targetId)}.`,
  },
  onlyPersonNear: {
    label: "È l'unica persona vicino a",
    params: [{ name: "targetId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `È l'unica persona vicino a ${targetLabel(puzzle, params.targetId)}.`,
  },
  aloneWithVictim: {
    legacy: true,
    label: "È sola con la vittima nella stanza",
    params: [],
    describe: () => `È sola con la vittima nella stanza.`,
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
    label: "La vittima è sola con l'assassino nella sua stanza",
    params: [],
    describe: () => "La vittima deve trovarsi in una stanza con esattamente un'altra persona: l'assassino.",
  },
  aloneWithPerson: {
    label: "È sola con (un personaggio)",
    params: [{ name: "targetId", kind: "character", label: "Personaggio" }],
    describe: (params, puzzle) => `È sola con ${targetLabel(puzzle, params.targetId)} nella stanza.`,
  },
  aloneWithPersonProperty: {
    label: "È sola con qualcuno che era...",
    params: propertyParams,
    describe: (params, puzzle) => `È sola nella stanza con qualcuno${propertyClause(params, puzzle, " che era")}.`,
  },
  rowOrColWith: {
    label: "Condivide riga/colonna con",
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: "Asse" },
      { name: "targetId", kind: "characterOrObject", label: "Bersaglio" },
    ],
    describe: (params, puzzle) =>
      `Condivide la ${params.axis === "row" ? "riga" : "colonna"} con ${targetLabel(puzzle, params.targetId)}.`,
  },
  inRowOrColWithAny: {
    label: "Condivide riga/colonna con uno tra più bersagli",
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: "Asse" },
      { name: "targetIds", kind: "characterOrObjectMulti", label: "Bersagli (Ctrl/Cmd-click per sceglierne più di uno)" },
    ],
    describe: (params, puzzle) => {
      const axisLabel = params.axis === "row" ? "la riga" : "la colonna";
      const names = (params.targetIds || []).map((id) => targetLabel(puzzle, id));
      return `Condivide ${axisLabel} con uno tra: ${names.length ? names.join(", ") : "?"}.`;
    },
  },
  rowOrColAdjacentTo: {
    label: "Si trova in una riga/colonna adiacente a",
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: "Asse" },
      { name: "targetId", kind: "characterOrObject", label: "Bersaglio" },
    ],
    describe: (params, puzzle) =>
      `Si trova nella ${params.axis === "row" ? "riga" : "colonna"} subito accanto a quella di ${targetLabel(puzzle, params.targetId)}.`,
  },
  aloneInRoom: {
    label: "È sola nella stanza",
    params: [{ name: "zoneId", kind: "zone", optional: true, label: "Stanza specifica (vuoto = quella in cui si trova)" }],
    describe: (params, puzzle) =>
      params.zoneId
        ? `È l'unica persona nella stanza ${targetLabel(puzzle, params.zoneId)}.`
        : `È sola nella stanza in cui si trova.`,
  },
  onlyPersonInRoom: {
    legacy: true,
    label: "È l'unica persona nella stanza",
    params: [{ name: "zoneId", kind: "zone", label: "Stanza" }],
    describe: (params, puzzle) => `È l'unica persona nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  inCorner: {
    label: "Si trova in un angolo",
    params: [],
    describe: () => `Si trova in un angolo della mappa.`,
  },
  inRoomCorner: {
    label: "Si trova in un angolo della sua stanza",
    // Diverso da "si trova in un angolo": quello vale solo per i 4 angoli
    // dell'intera mappa; questo vale per gli angoli della stanza in cui si
    // trova il personaggio, qualunque forma abbia (anche irregolare) e
    // ovunque sia sulla mappa.
    params: [],
    describe: () => "Si trova in un angolo della sua stanza.",
  },
  facing: {
    label: "È di fronte a",
    params: [{ name: "targetId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `È di fronte a ${targetLabel(puzzle, params.targetId)}.`,
  },
  closerTo: {
    label: "È più vicino a un bersaglio che a un altro",
    params: [
      { name: "targetAId", kind: "characterOrObject", label: "Bersaglio più vicino" },
      { name: "targetBId", kind: "characterOrObject", label: "Bersaglio più lontano" },
    ],
    describe: (params, puzzle) =>
      `È più vicino a ${targetLabel(puzzle, params.targetAId)} che a ${targetLabel(puzzle, params.targetBId)}.`,
  },
  someoneAtDirectionDistance: {
    label: "C'è qualcuno a N righe/colonne a nord/sud/est/ovest di lui/lei",
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: "Direzione" },
      { name: "distance", kind: "number", min: 1, optional: true, label: "Distanza esatta (vuoto = una qualsiasi)" },
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
  orClue: {
    // A general "A or B" combinator over two whole sub-clues (each its own
    // type + params), instead of a dedicated "eitherX" type for every pair
    // of clue kinds that might need combining — e.g. "was on the rug OR next
    // to the plant" mixes onObjectType with adjacent, which no single fixed
    // pair-type could cover. `params.a`/`params.b` hold the sub-clue specs
    // ({type, params}); clueBuilder.js renders each as a nested mini clue
    // row instead of the normal flat param list (see `combinator: true`).
    combinator: true,
    label: "O uno o l'altro (indizio composto)",
    params: [],
    describe: (params, puzzle) => {
      const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      const descA = describeNestedClue(params.a, puzzle) ?? "?";
      const descB = params.b?.type ? lower(describeNestedClue(params.b, puzzle)) : "?";
      return `${descA}, oppure ${descB}.`;
    },
  },
  someoneInRoomWithProperty: {
    label: "Qualcun altro nella sua stanza era...",
    params: propertyParams,
    describe: (params, puzzle) => `Qualcun altro nella sua stanza${propertyClause(params, puzzle, " era")}.`,
    negatedDescribe: (params, puzzle) => `Nessun altro nella sua stanza${propertyClause(params, puzzle, " era")}.`,
  },
  extremeInDirection: {
    label: "È la persona più a nord/sud/est/ovest",
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: "Direzione" },
      { name: "scope", kind: "enum", values: ["map", "room"], labels: { map: "su tutta la mappa", room: "nella sua stanza" }, label: "Tra chi" },
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

  // --- Generic clues: puzzle-wide scene facts, not owned by a character ---
  noOneInRoom: {
    scope: "generic",
    label: "Nessuno si trova nella stanza",
    params: [{ name: "zoneId", kind: "zone", label: "Stanza" }],
    describe: (params, puzzle) => `Nessuno si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
    negatedDescribe: (params, puzzle) => `Qualcuno si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  noOneInRowOrCol: {
    scope: "generic",
    label: "Nessuno si trova nella riga/colonna",
    params: [
      { name: "axis", kind: "enum", values: ["row", "col"], labels: { row: "Riga", col: "Colonna" }, label: "Riga o colonna" },
      { name: "index", kind: "number", min: 1, label: "Numero (1 = la prima)" },
    ],
    describe: (params) => `Nessuno si trova nella ${params.axis === "row" ? "riga" : "colonna"} ${params.index}.`,
    negatedDescribe: (params) => `Qualcuno si trova nella ${params.axis === "row" ? "riga" : "colonna"} ${params.index}.`,
  },
  exactlyOneInRoom: {
    scope: "generic",
    label: "Esattamente una persona si trova nella stanza",
    params: [{ name: "zoneId", kind: "zone", label: "Stanza" }],
    describe: (params, puzzle) => `Esattamente una persona si trova nella stanza ${targetLabel(puzzle, params.zoneId)}.`,
  },
  noOneNear: {
    scope: "generic",
    label: "Nessuno è vicino a",
    params: [{ name: "targetId", kind: "characterOrObject", label: "Bersaglio" }],
    describe: (params, puzzle) => `Nessuno è vicino a ${targetLabel(puzzle, params.targetId)}.`,
    negatedDescribe: (params, puzzle) => `Qualcuno è vicino a ${targetLabel(puzzle, params.targetId)}.`,
  },
  sameRoomTogether: {
    scope: "generic",
    label: "Due bersagli si trovano nella stessa stanza",
    params: [
      { name: "targetAId", kind: "character", label: "Personaggio A" },
      { name: "targetBId", kind: "character", label: "Personaggio B" },
    ],
    describe: (params, puzzle) =>
      `${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} si trovano nella stessa stanza.`,
    negatedDescribe: (params, puzzle) =>
      `${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} non si trovano nella stessa stanza.`,
  },
  emptyRoomsCount: {
    legacy: true,
    scope: "generic",
    label: "N stanze sono vuote",
    params: [{ name: "count", kind: "number", min: 0, label: "Numero di stanze vuote" }],
    describe: (params) =>
      params.count === 1 ? `Esattamente una stanza è vuota.` : `Esattamente ${params.count} stanze sono vuote.`,
  },
  roomsWithStateCount: {
    scope: "generic",
    label: "N stanze erano piene/vuote",
    params: [
      { name: "count", kind: "number", min: 0, label: "Numero di stanze" },
      { name: "state", kind: "enum", values: ["empty", "occupied"], labels: { empty: "vuote", occupied: "piene (almeno una persona)" }, label: "Stato" },
    ],
    describe: (params) => {
      const plural = params.count !== 1;
      const noun = plural ? "stanze" : "stanza";
      const verb = plural ? "erano" : "era";
      const stateWord = params.state === "empty" ? "vuot" : "pien";
      return `Esattamente ${params.count} ${noun} ${verb} ${stateWord}${plural ? "e" : "a"}.`;
    },
  },
  emptyRoomsSameSize: {
    scope: "generic",
    label: "N stanze erano vuote, con lo stesso numero di caselle",
    params: [{ name: "count", kind: "number", min: 0, label: "Numero di stanze vuote" }],
    describe: (params) => {
      const plural = params.count !== 1;
      const noun = plural ? "stanze" : "stanza";
      const verb = plural ? "erano" : "era";
      const sizeClause = params.count > 1 ? ", e avevano tutte lo stesso numero di caselle" : "";
      return `Esattamente ${params.count} ${noun} ${verb} vuot${plural ? "e" : "a"}${sizeClause}.`;
    },
  },
  sameRoomSizeAs: {
    scope: "generic",
    label: "Le stanze di due bersagli avevano lo stesso numero di caselle",
    params: [
      { name: "targetAId", kind: "character", label: "Personaggio A" },
      { name: "targetBId", kind: "character", label: "Personaggio B" },
    ],
    describe: (params, puzzle) =>
      `Le stanze di ${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} avevano lo stesso numero di caselle.`,
    negatedDescribe: (params, puzzle) =>
      `Le stanze di ${targetLabel(puzzle, params.targetAId)} e ${targetLabel(puzzle, params.targetBId)} non avevano lo stesso numero di caselle.`,
  },
  noOneWithProperty: {
    scope: "generic",
    label: "Nessuno era... (ovunque, o in una stanza specifica)",
    params: [
      { name: "zoneId", kind: "zone", optional: true, label: "Solo in questa stanza (vuoto = ovunque)" },
      {
        name: "onlyGender",
        kind: "enum",
        values: ["", "male", "female"],
        labels: { "": "chiunque", male: "solo uomini", female: "solo donne" },
        label: "Genere",
      },
      ...propertyParams,
    ],
    describe: (params, puzzle) => {
      const where = params.zoneId ? ` nella stanza ${targetLabel(puzzle, params.zoneId)}` : "";
      const who = params.onlyGender === "male" ? "Nessun uomo" : params.onlyGender === "female" ? "Nessuna donna" : "Nessuno";
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return `${who}${where} verificava: ${nested}.`;
      }
      return `${who} che era ${describeProperty(params, puzzle)} si trovava${where}.`;
    },
    negatedDescribe: (params, puzzle) => {
      const where = params.zoneId ? ` nella stanza ${targetLabel(puzzle, params.zoneId)}` : "";
      const who = params.onlyGender === "male" ? "Un uomo" : params.onlyGender === "female" ? "Una donna" : "Qualcuno";
      if (params.property === "custom") {
        const nested = describeNestedClue(params.customClue, puzzle);
        if (nested) return `${who}${where} verificava: ${nested}.`;
      }
      return `${who} che era ${describeProperty(params, puzzle)} si trovava${where}.`;
    },
  },
};

export function clueTypeIds() {
  return Object.keys(CLUE_TYPES);
}

export function characterClueTypeIds() {
  return Object.keys(CLUE_TYPES).filter((id) => CLUE_TYPES[id].scope !== "generic" && !CLUE_TYPES[id].legacy && !CLUE_TYPES[id].internal);
}

export function genericClueTypeIds() {
  return Object.keys(CLUE_TYPES).filter((id) => CLUE_TYPES[id].scope === "generic" && !CLUE_TYPES[id].legacy && !CLUE_TYPES[id].internal);
}

// Turns "È accanto a X." into "Non è accanto a X." — a plain "Non " prefix
// (lowercasing the first letter) reads correctly for the vast majority of
// phrasings, which all open with a verb (È.../Si trova.../Condivide...). The
// few built around a quantifier or a subject ("Nessuno...", "A e B...")
// override this with their own `negatedDescribe` instead, since a blind
// prefix would misplace the negation or double it up ("non nessuno...").
function negateText(text) {
  return text ? "Non " + text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function describeClue(clue, puzzle) {
  const def = CLUE_TYPES[clue.type];
  if (!def) return "Indizio sconosciuto.";
  try {
    if (clue.negate) {
      if (def.negatedDescribe) return def.negatedDescribe(clue.params || {}, puzzle);
      return negateText(def.describe(clue.params || {}, puzzle));
    }
    return def.describe(clue.params || {}, puzzle);
  } catch {
    return "Indizio incompleto.";
  }
}
