import { readJson, tryWriteJson } from "./storage.js";

// Backs "Continua l'ultimo caso" on index.html — a single most-recently-
// opened record, overwritten every time a puzzle or campaign case is loaded
// into its game view (see playerApp.js/campaignApp.js), regardless of
// whether it ends up solved. Deliberately just one slot, not a history list.
const KEY = "murdoku:recent";

// entry shapes:
//   { kind: "puzzle", id, title, url }
//   { kind: "campaign", campaignId, campaignTitle, caseId, caseLabel, title, url }
export function recordOpened(entry) {
  // Best-effort: losing the "continue" convenience silently (quota,
  // private-mode Safari...) is fine; it's not core functionality.
  tryWriteJson(KEY, { ...entry, openedAt: Date.now() });
}

// Tolerant of a missing/malformed entry, like every other *Store read here —
// returns null instead of throwing so index.html can just do
// `if (recent) { ...show banner... }`.
export function getRecent() {
  const parsed = readJson(KEY, null);
  if (!parsed || (parsed.kind !== "puzzle" && parsed.kind !== "campaign") || !parsed.url || !parsed.title) return null;
  return parsed;
}
