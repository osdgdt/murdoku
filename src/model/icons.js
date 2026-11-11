import { t } from "../i18n/i18n.js";
import { OBJECT_ART, EDGE_ART, paperSvg, edgeSvg } from "../skin/paper/objects.js";
import { CHARACTER_ART } from "../skin/paper/characters.js";

// What things look like lives in src/skin/paper/ (paper-cut artwork); this
// module only says WHAT exists: ids, labels, grammar and gameplay flags.
// Character artwork uses currentColor for the body, so it can be tinted via
// CSS `color` on the wrapping element; object artwork carries its own colors.

// `article` is the Italian indefinite article for the label, used when a clue
// refers to "a <object>" generically (any instance of this type) rather than
// one specific placed instance — e.g. "è accanto a una porta".
export const OBJECT_TYPES = {
  shelf: { label: t("Scaffale"), article: "uno", icon: paperSvg(OBJECT_ART.shelf) },
  plant: { label: t("Pianta"), article: "una", icon: paperSvg(OBJECT_ART.plant) },
  carpet: { label: t("Tappeto"), article: "un", occupiable: true, icon: paperSvg(OBJECT_ART.carpet) },
  chair: { label: t("Sedia"), article: "una", occupiable: true, seat: true, icon: paperSvg(OBJECT_ART.chair) },
  stool: { label: t("Sgabello"), article: "uno", occupiable: true, seat: true, icon: paperSvg(OBJECT_ART.stool) },
  table: { label: t("Tavolo"), article: "un", icon: paperSvg(OBJECT_ART.table) },
  lamp: { label: t("Lampada"), article: "una", icon: paperSvg(OBJECT_ART.lamp) },
  // `edge: true` types (doors, windows) are NOT furniture filling a cell: they
  // sit on ONE side of a cell (object.side: "N"|"E"|"S"|"W"), are drawn thin on
  // that edge from `edgeIcon` (horizontal; rotated by CSS for E/W), never block
  // the cell (a person can stand in it) and several can share one cell.
  // `icon` is still used for the palette and the clue labels.
  door: { label: t("Porta"), article: "una", edge: true, icon: paperSvg(OBJECT_ART.door), edgeIcon: edgeSvg(EDGE_ART.door) },
  window: { label: t("Finestra"), article: "una", edge: true, icon: paperSvg(OBJECT_ART.window), edgeIcon: edgeSvg(EDGE_ART.window) },
  tv: { label: t("Televisore"), article: "un", icon: paperSvg(OBJECT_ART.tv) },
};

// Ids stay stable (referenced by saved puzzles' character.iconId): the first
// twelve are the original cast, `victim` is reserved, the rest are professions
// added later. Artwork lives in src/skin/paper/characters.js.
export const CHARACTER_ICONS = Object.fromEntries(
  [
    ["person1", t("Persona 1")],
    ["person2", t("Persona 2")],
    ["hat", t("Cronista")],
    ["glasses", t("Studioso/a")],
    ["detective", t("Detective")],
    ["butler", t("Maggiordomo")],
    ["chef", t("Cuoco/a")],
    ["maid", t("Cameriera/e")],
    ["gardener", t("Giardiniere/a")],
    ["driver", t("Autista")],
    ["professor", t("Professore/essa")],
    ["artist", t("Artista")],
    ["doctor", t("Medico")],
    ["nurse", t("Infermiere/a")],
    ["police", t("Poliziotto/a")],
    ["judge", t("Giudice")],
    ["lawyer", t("Avvocato")],
    ["pilot", t("Pilota")],
    ["sailor", t("Marinaio")],
    ["firefighter", t("Pompiere")],
    ["pharmacist", t("Farmacista")],
    ["bartender", t("Barista")],
    ["baker", t("Fornaio")],
    ["butcher", t("Macellaio")],
    ["mechanic", t("Meccanico")],
    ["musician", t("Musicista")],
    ["scientist", t("Scienziato/a")],
    ["explorer", t("Esploratore")],
    ["priest", t("Sacerdote")],
    ["farmer", t("Contadino/a")],
    ["librarian", t("Bibliotecario/a")],
    ["photographer", t("Fotografo/a")],
    ["countess", t("Contessa")],
    ["pirate", t("Pirata")],
    ["spy", t("Spia")],
    ["wizard", t("Mago")],
    ["cowboy", t("Cowboy")],
    ["king", t("Re")],
    ["queen", t("Regina")],
    ["knight", t("Cavaliere")],
    ["monk", t("Monaco")],
    ["astronaut", t("Astronauta")],
    ["ninja", t("Ninja")],
    ["clown", t("Clown")],
    ["magician", t("Illusionista")],
    ["soldier", t("Soldato")],
    ["banker", t("Banchiere")],
    ["actor", t("Attore/Attrice")],
    ["construction", t("Operaio")],
    ["tourist", t("Turista")],
    ["rockstar", t("Rockstar")],
    ["vampire", t("Vampiro/a")],
    ["nun", t("Suora")],
    ["gangster", t("Gangster")],
    ["waiter", t("Cameriere")],
    ["victim", t("Vittima")],
  ].map(([id, label]) => [id, { label, icon: CHARACTER_ART[id] }])
);

// Ordered, stable ids for round-robin auto-assignment (characterEditor.js) —
// same pattern as CHARACTER_COLORS in puzzle.js. Excludes "victim" (never
// user-selectable for a regular character).
export const SELECTABLE_CHARACTER_ICON_IDS = Object.keys(CHARACTER_ICONS).filter((id) => id !== "victim");

export const EDGE_SIDES = ["N", "E", "S", "W"];

// Human name of a side, for labels ("Porta (2,3, lato Nord)").
export function sideLabel(side) {
  return { N: t("Nord"), E: t("Est"), S: t("Sud"), W: t("Ovest") }[side] || side;
}

// Doors and windows sit on a side of a cell instead of filling it.
export function isEdgeObjectType(typeId) {
  return !!OBJECT_TYPES[typeId]?.edge;
}

// Only some of the things you can stand on are things you can SIT on: a chair
// or a stool, not a rug (`seat: true`).
export function isObjectTypeSeat(typeId) {
  return !!OBJECT_TYPES[typeId]?.seat;
}

export function objectIcon(typeId) {
  return OBJECT_TYPES[typeId] || null;
}

// Most furniture blocks the cell it's in (shelves, tables, doors...) — a
// character can't stand on top of them. Low, flat furniture (a rug, a chair)
// is the exception: it doesn't stop anyone from standing there.
export function isObjectTypeOccupiable(typeId) {
  return !!OBJECT_TYPES[typeId]?.occupiable;
}

// A clue can target "any object of this type" (e.g. "a door") instead of one
// specific placed instance. These are encoded as synthetic target ids so they
// slot into the existing character/zone/object target-id parameter shape.
const OBJECT_TYPE_TARGET_PREFIX = "objtype:";

export function objectTypeTargetId(typeId) {
  return OBJECT_TYPE_TARGET_PREFIX + typeId;
}

export function isObjectTypeTarget(targetId) {
  return typeof targetId === "string" && targetId.startsWith(OBJECT_TYPE_TARGET_PREFIX);
}

export function parseObjectTypeTarget(targetId) {
  return isObjectTypeTarget(targetId) ? targetId.slice(OBJECT_TYPE_TARGET_PREFIX.length) : null;
}

export function characterIcon(iconId) {
  return CHARACTER_ICONS[iconId] || CHARACTER_ICONS.person1;
}
