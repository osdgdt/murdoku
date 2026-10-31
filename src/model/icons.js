import { t } from "../i18n/i18n.js";
import { OBJECT_ART, paperSvg } from "../skin/paper/objects.js";
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
  chair: { label: t("Sedia"), article: "una", occupiable: true, icon: paperSvg(OBJECT_ART.chair) },
  stool: { label: t("Sgabello"), article: "uno", occupiable: true, icon: paperSvg(OBJECT_ART.stool) },
  table: { label: t("Tavolo"), article: "un", icon: paperSvg(OBJECT_ART.table) },
  lamp: { label: t("Lampada"), article: "una", icon: paperSvg(OBJECT_ART.lamp) },
  door: { label: t("Porta"), article: "una", icon: paperSvg(OBJECT_ART.door) },
  window: { label: t("Finestra"), article: "una", icon: paperSvg(OBJECT_ART.window) },
  tv: { label: t("Televisore"), article: "un", icon: paperSvg(OBJECT_ART.tv) },
};

// Ids stay stable (referenced by saved puzzles' character.iconId).
export const CHARACTER_ICONS = {
  person1: { label: t("Persona 1"), icon: CHARACTER_ART.person1 },
  person2: { label: t("Persona 2"), icon: CHARACTER_ART.person2 },
  hat: { label: t("Cronista"), icon: CHARACTER_ART.hat },
  glasses: { label: t("Studioso/a"), icon: CHARACTER_ART.glasses },
  detective: { label: t("Detective"), icon: CHARACTER_ART.detective },
  butler: { label: t("Maggiordomo"), icon: CHARACTER_ART.butler },
  chef: { label: t("Cuoco/a"), icon: CHARACTER_ART.chef },
  maid: { label: t("Cameriera/e"), icon: CHARACTER_ART.maid },
  gardener: { label: t("Giardiniere/a"), icon: CHARACTER_ART.gardener },
  driver: { label: t("Autista"), icon: CHARACTER_ART.driver },
  professor: { label: t("Professore/essa"), icon: CHARACTER_ART.professor },
  artist: { label: t("Artista"), icon: CHARACTER_ART.artist },
  victim: { label: t("Vittima"), icon: CHARACTER_ART.victim },
};

// Ordered, stable ids for round-robin auto-assignment (characterEditor.js) —
// same pattern as CHARACTER_COLORS in puzzle.js. Excludes "victim" (never
// user-selectable for a regular character).
export const SELECTABLE_CHARACTER_ICON_IDS = Object.keys(CHARACTER_ICONS).filter((id) => id !== "victim");

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
