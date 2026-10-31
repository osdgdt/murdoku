// Per-device log of every solve: which case, when, how fast, how many hints.
// Deliberately separate from achievementsStore (whose data is merged across
// devices by key) — this is a plain local diary, never synced, so it needs no
// merge rules and can't corrupt the synced achievement data.
import { readJson, tryWriteJson } from "./storage.js";

const KEY = "murdoku:solve-history";
export const MAX_HISTORY_ENTRIES = 200;

function read() {
  const data = readJson(KEY, []);
  return Array.isArray(data) ? data.filter((e) => e && typeof e.key === "string" && typeof e.at === "number") : [];
}

// `key` is the same stable identity achievementsStore uses (`puzzle:<id>` /
// `campaign:<campaignId>:<caseId>`); `title` is stored too so the history
// stays readable after the case itself is deleted.
export function recordSolveEntry({ key, title, elapsedSeconds, hintsUsed, at = Date.now() }) {
  const entries = read();
  entries.push({
    key,
    title: String(title ?? ""),
    at,
    elapsedSeconds: typeof elapsedSeconds === "number" ? elapsedSeconds : null,
    hintsUsed: hintsUsed || 0,
  });
  tryWriteJson(KEY, entries.slice(-MAX_HISTORY_ENTRIES));
}

// Newest first.
export function recentSolves(limit = 15) {
  return read().sort((a, b) => b.at - a.at).slice(0, limit);
}

// One row per case, most recently solved first: how often, best time, fewest hints.
export function summaryByCase() {
  const byKey = new Map();
  for (const e of read()) {
    const s = byKey.get(e.key) ?? { key: e.key, title: e.title, solves: 0, bestElapsedSeconds: null, bestHintsUsed: Infinity, lastSolvedAt: 0 };
    s.solves++;
    if (e.at >= s.lastSolvedAt) { s.lastSolvedAt = e.at; s.title = e.title || s.title; }
    if (typeof e.elapsedSeconds === "number") s.bestElapsedSeconds = s.bestElapsedSeconds == null ? e.elapsedSeconds : Math.min(s.bestElapsedSeconds, e.elapsedSeconds);
    s.bestHintsUsed = Math.min(s.bestHintsUsed, e.hintsUsed);
    byKey.set(e.key, s);
  }
  return [...byKey.values()].sort((a, b) => b.lastSolvedAt - a.lastSolvedAt);
}

// Average over the solves that recorded a time, or null.
export function averageSolveSeconds() {
  const times = read().map((e) => e.elapsedSeconds).filter((v) => typeof v === "number");
  return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
}
