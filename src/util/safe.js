// Small, dependency-free helpers for treating imported/shared puzzle data as
// untrusted input. A puzzle can arrive from a file, from `?import=<url>`, or
// from a campaign, so every string that later ends up in an attribute, a
// `style` declaration or a URL must be proven harmless at the validation
// boundary (see validatePuzzleShape in model/puzzle.js) — never trusted
// because "our own editor would never produce it".

// Hard cap for any imported puzzle document (file or URL). Real puzzles are a
// few tens of KB; anything past this is either a mistake or an attack.
export const MAX_IMPORT_BYTES = 1024 * 1024;

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SAFE_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Ids end up in href query strings, data-* attributes and DOM lookups.
export function isSafeId(value) {
  return typeof value === "string" && SAFE_ID.test(value);
}

// Colors end up in inline `style` strings (`background:${color}`), where an
// arbitrary string could smuggle extra declarations (`red;background:url(…)`).
// Only plain hex colors are ever produced by the editor, so only those pass.
export function isSafeColor(value) {
  return typeof value === "string" && SAFE_COLOR.test(value);
}

// Escapes text for the (few) places that still build markup from strings.
export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
