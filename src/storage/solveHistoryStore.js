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
  return read()
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

// One row per case, most recently solved first: how often, best time, fewest hints.
export function summaryByCase() {
  const byKey = new Map();
  for (const e of read()) {
    const s = byKey.get(e.key) ?? {
      key: e.key,
      title: e.title,
      solves: 0,
      bestElapsedSeconds: null,
      bestHintsUsed: Infinity,
      lastSolvedAt: 0,
    };
    s.solves++;
    if (e.at >= s.lastSolvedAt) {
      s.lastSolvedAt = e.at;
      s.title = e.title || s.title;
    }
    if (typeof e.elapsedSeconds === "number")
      s.bestElapsedSeconds = s.bestElapsedSeconds == null ? e.elapsedSeconds : Math.min(s.bestElapsedSeconds, e.elapsedSeconds);
    s.bestHintsUsed = Math.min(s.bestHintsUsed, e.hintsUsed);
    byKey.set(e.key, s);
  }
  return [...byKey.values()].sort((a, b) => b.lastSolvedAt - a.lastSolvedAt);
}

// The local calendar day of a timestamp, as an integer (consecutive days differ by 1).
const dayNumber = (ms) => {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};

// Days in a row with at least one solve. `current` is still alive when the last
// solve was today or yesterday (you have until the end of today to continue it);
// `best` is the longest run ever recorded in this device's log.
export function solveStreak(now = Date.now()) {
  const days = [...new Set(read().map((e) => dayNumber(e.at)))].sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let current = 0;
  if (days[days.length - 1] >= dayNumber(now) - 1) {
    current = 1;
    for (let i = days.length - 2; i >= 0 && days[i] === days[i + 1] - 1; i--) current++;
  }
  return { current, best };
}

// How many solves fall in the last `days` calendar days (today included).
export function solvesInLastDays(days, now = Date.now()) {
  const from = dayNumber(now) - (days - 1);
  return read().filter((e) => dayNumber(e.at) >= from).length;
}

// Average over the solves that recorded a time, or null.
export function averageSolveSeconds() {
  const times = read()
    .map((e) => e.elapsedSeconds)
    .filter((v) => typeof v === "number");
  return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
}
