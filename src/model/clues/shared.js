import { isObjectTypeTarget, parseObjectTypeTarget, objectIcon, OBJECT_TYPES } from "./../icons.js";
import { describeClue } from "../clueTypes.js";

export function targetLabel(puzzle, targetId) {
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

export function objectTypePhrase(typeId) {
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
export const PERSON_PROPERTIES = ["adjacentTo", "male", "female", "sittingOn", "seated", "custom"];
export const PERSON_PROPERTY_LABELS = {
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
export const OBJECT_TYPE_IDS = Object.keys(OBJECT_TYPES);
export const OBJECT_TYPE_LABELS = Object.fromEntries(OBJECT_TYPE_IDS.map((id) => [id, OBJECT_TYPES[id].label]));
export const SHORT_DIRECTION_LABELS = { north: "Nord", south: "Sud", east: "Est", west: "Ovest" };
export const SUPERLATIVE_DIRECTION_LABELS = { north: "a nord", south: "a sud", east: "a est", west: "a ovest" };

export function describeProperty(params, puzzle) {
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
export function describeNestedClue(spec, puzzle) {
  if (!spec?.type) return null;
  return describeClue({ type: spec.type, params: spec.params, negate: spec.negate }, puzzle).replace(/\.\s*$/, "");
}

// Builds the "<verb> <property>" fragment shared by every clue type built on
// propertyParams/optionalPropertyParams — e.g. propertyClause(params, puzzle,
// " era") yields " era un uomo". For `custom`, there's no adjective to embed,
// so it switches to a colon-introduced clause instead: ": <condition>".
export function propertyClause(params, puzzle, verb) {
  if (params.property === "custom") {
    const nested = describeNestedClue(params.customClue, puzzle);
    return nested ? `: ${nested}` : `${verb} presente`;
  }
  return `${verb} ${describeProperty(params, puzzle)}`;
}

export const propertyParams = [
  { name: "property", kind: "enum", values: PERSON_PROPERTIES, labels: PERSON_PROPERTY_LABELS, label: "Proprietà" },
  { name: "targetId", kind: "characterOrObject", label: "Bersaglio (se 'accanto a')" },
  { name: "objectTypeId", kind: "enum", values: OBJECT_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: "Tipo di oggetto (se 'seduto su')" },
  { name: "customClue", kind: "clueRef", label: "Condizione (se 'un'altra condizione')" },
];
// Same, but the property filter itself is optional ("chiunque") — for clue
// types where a plain, unfiltered "someone" is the natural default.
export const optionalPropertyParams = [
  { name: "property", kind: "enum", values: ["", ...PERSON_PROPERTIES], labels: { "": "chiunque", ...PERSON_PROPERTY_LABELS }, label: "Che era..." },
  ...propertyParams.slice(1),
];
