// The author's own words for a clue (`clue.text`): they replace the automatic sentence wherever the clue is shown.
// Kept in a module of its own so the puzzle model and the clue types can both use it without importing each other.
export const MAX_CLUE_TEXT = 300;

// The custom words of a clue, trimmed and capped ("" when it has none).
export function customClueText(clue) {
  return typeof clue?.text === "string" ? clue.text.trim().slice(0, MAX_CLUE_TEXT) : "";
}
