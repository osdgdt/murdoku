// Backs "Continua l'ultimo caso" on index.html — a single most-recently-
// opened record, overwritten every time a puzzle or campaign case is loaded
// into its game view (see playerApp.js/campaignApp.js), regardless of
// whether it ends up solved. Deliberately just one slot, not a history list.
const KEY = "murdoku:recent";

// entry shapes:
//   { kind: "puzzle", id, title, url }
//   { kind: "campaign", campaignId, campaignTitle, caseId, caseLabel, title, url }
export function recordOpened(entry) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...entry, openedAt: Date.now() }));
  } catch {
    // localStorage can throw (quota, private-mode Safari, etc.) — losing the
    // "continue" convenience silently is fine; it's not core functionality.
  }
}

// Tolerant of a missing/malformed entry, like every other *Store read here —
// returns null instead of throwing so index.html can just do
// `if (recent) { ...show banner... }`.
export function getRecent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.kind !== "puzzle" && parsed.kind !== "campaign") || !parsed.url || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRecent() {
  localStorage.removeItem(KEY);
}
