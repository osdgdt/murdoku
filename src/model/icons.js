// Small inline SVG icon set: every icon is a self-contained <svg> string.
import { buildCharacterIcons } from "./avatars.js";

// Object icons carry their own fixed fill colors so they read clearly as distinct props on any
// zone color or theme — they sit on a fixed light "coaster" backdrop drawn in
// CSS (.obj-icon), so contrast never depends on the surrounding cell.
const coloredSvg = (inner, viewBox = "0 0 24 24") =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

// `article` is the Italian indefinite article for the label, used when a clue
// refers to "a <object>" generically (any instance of this type) rather than
// one specific placed instance — e.g. "è accanto a una porta".
export const OBJECT_TYPES = {
  shelf: {
    label: "Scaffale", article: "uno", icon: coloredSvg(
      '<rect x="3" y="3" width="18" height="18" rx="1" fill="#c9a06a" stroke="#6b4423" stroke-width="1"/>' +
      '<rect x="3" y="8.3" width="18" height="1.4" fill="#6b4423"/>' +
      '<rect x="3" y="14.3" width="18" height="1.4" fill="#6b4423"/>' +
      '<rect x="5" y="4.3" width="2.2" height="3.6" fill="#8a3b3b"/>' +
      '<rect x="7.6" y="4.3" width="2.2" height="3.6" fill="#3b6b8a"/>' +
      '<rect x="10.2" y="4.3" width="2.2" height="3.6" fill="#4d7a4d"/>'
    ),
  },
  plant: {
    label: "Pianta", article: "una", icon: coloredSvg(
      '<path d="M9 21h6l-1-6h-4z" fill="#9a6b3f" stroke="#5c3b20" stroke-width="1"/>' +
      '<path d="M12 15v-4" stroke="#3c6b3f" stroke-width="1.6"/>' +
      '<path d="M12 11c-3.2 0-5-2.4-5-5.4 2.6 0 5 1.6 5 5.4z" fill="#4c8a52" stroke="#345c38" stroke-width="0.8"/>' +
      '<path d="M12 11c3.2 0 5-2.4 5-5.4-2.6 0-5 1.6-5 5.4z" fill="#5c9c5f" stroke="#345c38" stroke-width="0.8"/>'
    ),
  },
  carpet: {
    label: "Tappeto", article: "un", occupiable: true, icon: coloredSvg(
      '<rect x="3" y="6" width="18" height="12" rx="1.5" fill="#a8382c" stroke="#5c1712" stroke-width="1"/>' +
      '<rect x="5.5" y="8.3" width="13" height="7.4" rx="1" fill="none" stroke="#e4c179" stroke-width="1"/>' +
      '<circle cx="12" cy="12" r="1.4" fill="#e4c179"/>'
    ),
  },
  chair: {
    label: "Sedia", article: "una", occupiable: true, icon: coloredSvg(
      '<path d="M7 4h10v8H7z" fill="#c9a06a" stroke="#6b4423" stroke-width="1"/>' +
      '<path d="M7 12v7" stroke="#6b4423" stroke-width="2"/>' +
      '<path d="M17 12v7" stroke="#6b4423" stroke-width="2"/>' +
      '<path d="M7 16h10" stroke="#6b4423" stroke-width="2"/>'
    ),
  },
  stool: {
    label: "Sgabello", article: "uno", occupiable: true, icon: coloredSvg(
      '<ellipse cx="12" cy="7" rx="6.5" ry="2.6" fill="#c9a06a" stroke="#6b4423" stroke-width="1"/>' +
      '<path d="M7 8.5L5.5 19" stroke="#6b4423" stroke-width="1.6"/>' +
      '<path d="M17 8.5L18.5 19" stroke="#6b4423" stroke-width="1.6"/>' +
      '<path d="M12 9.4v9.6" stroke="#6b4423" stroke-width="1.6"/>'
    ),
  },
  table: {
    label: "Tavolo", article: "un", icon: coloredSvg(
      '<rect x="3" y="6" width="18" height="3" rx="0.6" fill="#b98a54" stroke="#6b4423" stroke-width="1"/>' +
      '<path d="M6 9v9" stroke="#6b4423" stroke-width="2"/>' +
      '<path d="M18 9v9" stroke="#6b4423" stroke-width="2"/>'
    ),
  },
  lamp: {
    label: "Lampada", article: "una", icon: coloredSvg(
      '<circle cx="12" cy="10" r="4.5" fill="#fff3c9" opacity="0.7"/>' +
      '<path d="M8 4h8l3 6H5z" fill="#e4b455" stroke="#8f651f" stroke-width="1"/>' +
      '<path d="M12 10v9" stroke="#5c3b20" stroke-width="1.6"/>' +
      '<path d="M8 21h8" stroke="#5c3b20" stroke-width="1.6"/>'
    ),
  },
  // `edge: true` types (doors, windows) are NOT furniture filling a cell: they
  // sit on ONE side of a cell (object.side: "N"|"E"|"S"|"W"), drawn thin on
  // that edge from `edgeIcon` (viewBox 36x10, horizontal — rotated by CSS for
  // E/W), never block the cell (a person can stand in it) and several can
  // share one cell. `icon` is still used for the palette and labels.
  door: {
    label: "Porta", article: "una", edge: true,
    edgeIcon: coloredSvg(
      '<rect x="1" y="1" width="34" height="8" rx="1.5" fill="#9a6b3f" stroke="#5c3b20" stroke-width="1"/>' +
      '<rect x="4" y="3" width="11" height="4" rx="0.8" fill="#c9a06a" opacity="0.7"/>' +
      '<circle cx="29" cy="5" r="1.6" fill="#e4c179" stroke="#8f651f" stroke-width="0.6"/>',
      "0 0 36 10"
    ),
    icon: coloredSvg(
      '<rect x="6" y="3" width="12" height="18" rx="0.6" fill="#9a6b3f" stroke="#5c3b20" stroke-width="1"/>' +
      '<rect x="8" y="5" width="8" height="7" rx="0.4" fill="#c9a06a" opacity="0.6"/>' +
      '<circle cx="15" cy="12" r="1" fill="#e4c179" stroke="#8f651f" stroke-width="0.5"/>'
    ),
  },
  window: {
    label: "Finestra", article: "una", edge: true,
    edgeIcon: coloredSvg(
      '<rect x="1" y="1" width="34" height="8" rx="1" fill="#9ecbe0" stroke="#5c3b20" stroke-width="1.2"/>' +
      '<path d="M18 1v8" stroke="#5c3b20" stroke-width="1.1"/>' +
      '<path d="M3 3.2l5 0M20 6.8l5 0" stroke="#ffffff" stroke-width="0.9" opacity="0.7"/>',
      "0 0 36 10"
    ),
    icon: coloredSvg(
      '<rect x="4" y="4" width="16" height="16" rx="0.6" fill="#9ecbe0" stroke="#5c3b20" stroke-width="1.2"/>' +
      '<path d="M12 4v16" stroke="#5c3b20" stroke-width="1.2"/>' +
      '<path d="M4 12h16" stroke="#5c3b20" stroke-width="1.2"/>'
    ),
  },
  tv: {
    label: "Televisore", article: "un", icon: coloredSvg(
      '<rect x="3" y="4" width="18" height="12" rx="1" fill="#2b2f38" stroke="#181a1f" stroke-width="1"/>' +
      '<rect x="5" y="6" width="14" height="8" fill="#7ea9d6" opacity="0.55"/>' +
      '<rect x="10" y="16" width="4" height="3" fill="#5c6068"/>' +
      '<rect x="7" y="19" width="10" height="1.6" rx="0.8" fill="#5c6068"/>'
    ),
  },
};

// Full-color illustrated avatars, one per profession — composed from small
// parts in avatars.js (PROFESSIONS is the table: ids are persisted in saved
// puzzles' character.iconId, never rename/remove one). Same `{label, icon}`
// shape as before; the icons carry their own colors (no currentColor).
export const CHARACTER_ICONS = buildCharacterIcons();

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

// Doors/windows: an element on one side of a cell instead of a piece of
// furniture filling it (see OBJECT_TYPES). Such objects live in grid.objects
// with a `side`, but never set cell.objectId.
export function isEdgeObjectType(typeId) {
  return !!OBJECT_TYPES[typeId]?.edge;
}

export const EDGE_SIDES = ["N", "E", "S", "W"];

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
