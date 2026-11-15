// Keyboard shortcuts that pick a character: the digits 1-9 pick the 1st to the
// 9th, 0 the 10th, and [ ] (or , . — [ and ] need AltGr on many keyboards) step to
// the previous/next one, which also reaches the 11th to 16th. Kept apart from
// gameScreen.js so it can be tested without a page.
export const CHARACTER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// The key that picks the character at `index` (0-based), or null when it has none
// of its own (11th and later: use [ and ]).
export function characterKey(index) {
  return CHARACTER_KEYS[index] ?? null;
}

// The 0-based index a digit key picks, or null.
export function characterIndexForKey(key) {
  const index = CHARACTER_KEYS.indexOf(key);
  return index === -1 ? null : index;
}

// -1 for [ and ',', +1 for ] and '.', 0 otherwise.
export function stepForKey(key) {
  if (key === "[" || key === ",") return -1;
  if (key === "]" || key === ".") return 1;
  return 0;
}

// The character `delta` steps from the selected one (wrapping around); from no
// selection, ] gives the first and [ the last. null with no characters.
export function steppedCharacter(characters, selectedId, delta) {
  if (characters.length === 0) return null;
  const current = characters.findIndex((c) => c.id === selectedId);
  if (current === -1) return delta > 0 ? characters[0] : characters[characters.length - 1];
  return characters[(current + delta + characters.length) % characters.length];
}
