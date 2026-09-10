// Small inline SVG icon set. Every icon is a self-contained <svg> string using currentColor,
// so it can be recolored via CSS `color` on the wrapping element.
const svg = (inner, viewBox = "0 0 24 24") =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// Object icons carry their own fixed fill colors (unlike the currentColor
// character silhouettes below) so they read clearly as distinct props on any
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
  door: {
    label: "Porta", article: "una", icon: coloredSvg(
      '<rect x="6" y="3" width="12" height="18" rx="0.6" fill="#9a6b3f" stroke="#5c3b20" stroke-width="1"/>' +
      '<rect x="8" y="5" width="8" height="7" rx="0.4" fill="#c9a06a" opacity="0.6"/>' +
      '<circle cx="15" cy="12" r="1" fill="#e4c179" stroke="#8f651f" stroke-width="0.5"/>'
    ),
  },
  window: {
    label: "Finestra", article: "una", icon: coloredSvg(
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

// Every themed icon reuses this head+shoulders silhouette, topped with a
// bold, structurally distinct prop (varied overall shape — dome, brim,
// square, wedge — not just a small detail) so the roster stays readable even
// at the smallest real render size (16px toolbar chip).
const PERSON_BASE = '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>';

export const CHARACTER_ICONS = {
  person1: { label: "Persona 1", icon: svg(PERSON_BASE) },
  person2: { label: "Persona 2", icon: svg('<circle cx="12" cy="7" r="3"/><rect x="7" y="12" width="10" height="8" rx="2"/>') },
  // Ids stay stable (referenced by saved puzzles' character.iconId) even
  // though these two used to be bodyless accessory icons — now real people,
  // for a consistent "always a person" roster.
  hat: { label: "Cronista", icon: svg(PERSON_BASE + '<path d="M7.5 5C7.5 1.8 9.5 0 12 0s4.5 1.8 4.5 5" fill="none"/><ellipse cx="12" cy="5" rx="7.5" ry="1.6"/>') },
  glasses: { label: "Studioso/a", icon: svg(PERSON_BASE + '<circle cx="9.8" cy="8" r="1.5"/><circle cx="14.2" cy="8" r="1.5"/><path d="M11.3 8h1.4"/><path d="M8.3 7.6l-1.3-0.4M15.7 7.6l1.3-0.4"/>') },
  detective: { label: "Detective", icon: svg(PERSON_BASE + '<ellipse cx="12" cy="4.8" rx="5.5" ry="2.2"/><circle cx="19" cy="16" r="2.8"/><path d="M21.2 18.2L23 20"/>') },
  butler: { label: "Maggiordomo", icon: svg(PERSON_BASE + '<path d="M7.5 13.2L12 15l4.5-1.8v4l-4.5-1.8-4.5 1.8z"/>') },
  chef: { label: "Cuoco/a", icon: svg(PERSON_BASE + '<rect x="8.3" y="4.6" width="7.4" height="2.6" rx="1.3"/><circle cx="9.6" cy="2.4" r="2.1"/><circle cx="12" cy="1.6" r="2.3"/><circle cx="14.4" cy="2.4" r="2.1"/>') },
  // A bold bow perched on the crown, not a hat/brim shape — structurally
  // distinct from hat/gardener/chef/driver (all "something covering the
  // head"), and filled rather than outlined so it still reads clearly at
  // the smallest render size.
  maid: { label: "Cameriera/e", icon: svg(PERSON_BASE + '<path d="M12 3.6L9 2.2v2.8z" fill="currentColor" stroke="none"/><path d="M12 3.6L15 2.2v2.8z" fill="currentColor" stroke="none"/><circle cx="12" cy="3.6" r="0.7" fill="currentColor" stroke="none"/>') },
  gardener: { label: "Giardiniere/a", icon: svg(PERSON_BASE + '<ellipse cx="12" cy="5.6" rx="8" ry="1.8"/><path d="M9 5.6c0-2.6 1.3-4.2 3-4.2s3 1.6 3 4.2" fill="none"/>') },
  driver: { label: "Autista", icon: svg(PERSON_BASE + '<path d="M7.8 6.2c0-2.5 1.9-4.2 4.2-4.2s4.2 1.7 4.2 4.2" fill="none"/><path d="M7.3 6.2h7.4"/><path d="M14.7 6.2l3.3 0.7-0.4 1.3-3.3-0.5z" fill="currentColor" stroke="none"/>') },
  professor: { label: "Professore/essa", icon: svg(PERSON_BASE + '<path d="M6 5L12 2.5L18 5L12 7.5Z"/><path d="M18 5v3"/><path d="M12 7.5v1.6"/><circle cx="12" cy="9.7" r="0.7" fill="currentColor" stroke="none"/>') },
  artist: { label: "Artista", icon: svg(PERSON_BASE + '<path d="M7.8 5.6c0-2.6 1.8-4.2 4.2-4.2s4.2 1.6 4.2 4.2c0 .6-.3.7-.7.5-1-.6-2.1-.3-3.5-.3s-2.5-.3-3.5.3c-.4.2-.7.1-.7-.5z"/><ellipse cx="19" cy="17" rx="3" ry="2.2" transform="rotate(-20 19 17)"/><circle cx="17.7" cy="16.3" r="0.5" fill="currentColor" stroke="none"/><circle cx="19.3" cy="15.6" r="0.5" fill="currentColor" stroke="none"/><circle cx="20.6" cy="16.8" r="0.5" fill="currentColor" stroke="none"/>') },
  victim: { label: "Vittima", icon: svg('<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/><path d="M6 6l12 12"/>') },
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
