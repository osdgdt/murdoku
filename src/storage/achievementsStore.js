import { ACHIEVEMENTS } from "../model/achievements.js";

const KEY = "murdoku:achievements";

// `solves` is keyed by a stable, caller-supplied puzzle identity (see
// gameScreen.js's `achievementKey`) so re-solving the same puzzle never
// double-counts "casi risolti" — required for exact, ambiguity-free merging
// across devices (see mergeRemote below): two devices' solve maps can just
// be unioned by key, unlike raw incrementing counters, which would
// double-count anything solved on both.
function defaultData() {
  return {
    solves: {}, // { [puzzleKey]: { firstSolvedAt, bestHintsUsed, bestElapsedSeconds } }
    unlocked: {}, // { [achievementId]: unlockedAtMs }
  };
}

// Tolerant of a missing/corrupted entry, and of the OLD raw-counter shape
// this replaces (shipped earlier the same day, no real user data to
// migrate) — anything without a `solves` field just starts fresh instead of
// attempting an impossible reconstruction (raw counters don't record WHICH
// puzzles were solved).
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed?.solves || typeof parsed.solves !== "object") return defaultData();
    return {
      solves: { ...parsed.solves },
      unlocked: parsed?.unlocked && typeof parsed.unlocked === "object" ? { ...parsed.unlocked } : {},
    };
  } catch {
    return defaultData();
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function computeStats(solves) {
  const entries = Object.values(solves);
  const times = entries.map((e) => e.bestElapsedSeconds).filter((v) => typeof v === "number");
  return {
    totalSolved: entries.length,
    totalSolvedWithoutHints: entries.filter((e) => e.bestHintsUsed === 0).length,
    fastestSolveSeconds: times.length ? Math.min(...times) : null,
  };
}

export function getStats() {
  return computeStats(read().solves);
}

export function getUnlocked() {
  return read().unlocked;
}

export function isUnlocked(id) {
  return id in read().unlocked;
}

// Scans ACHIEVEMENTS against `data`'s current stats and unlocks (mutating
// `data.unlocked`) any whose predicate now holds but didn't before this
// call — shared by recordSolve and mergeRemote, since a merge can cross a
// threshold neither side alone had reached (e.g. two devices each solved
// under 10 cases, but 6+5 distinct ones together clears "ten_solves").
function unlockNew(data) {
  const stats = computeStats(data.solves);
  const newlyUnlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (data.unlocked[achievement.id]) continue;
    if (achievement.check(stats)) {
      data.unlocked[achievement.id] = Date.now();
      newlyUnlocked.push(achievement);
    }
  }
  return newlyUnlocked;
}

// Called exactly once per successful solve (gameScreen.js's onSubmit win
// branch), for BOTH standalone puzzles and campaign cases. `key` is a
// stable per-puzzle identity supplied by the caller (gameScreen.js's
// `achievementKey` — see playerApp.js/campaignApp.js) — re-solving the same
// key updates the best hints/time seen for it (so a puzzle first solved
// with a hint, then later solved hint-free, retroactively counts toward
// "solved without hints") but never adds a second entry.
//
// Returns the achievement definitions newly unlocked BY THIS CALL only —
// empty array when none — so the caller can show a "just unlocked" banner
// exactly once per achievement.
export function recordSolve({ key, elapsedSeconds, hintsUsed }) {
  const data = read();
  const existing = data.solves[key];
  const thisHints = hintsUsed || 0;
  data.solves[key] = {
    firstSolvedAt: existing?.firstSolvedAt ?? Date.now(),
    bestHintsUsed: existing ? Math.min(existing.bestHintsUsed, thisHints) : thisHints,
    bestElapsedSeconds:
      typeof elapsedSeconds === "number"
        ? existing?.bestElapsedSeconds != null
          ? Math.min(existing.bestElapsedSeconds, elapsedSeconds)
          : elapsedSeconds
        : existing?.bestElapsedSeconds ?? null,
  };
  const newlyUnlocked = unlockNew(data);
  write(data);
  return newlyUnlocked;
}

// --- Sync support (consumed only by achievementsSyncStore.js — this module
// itself never talks to Firebase, so gameScreen.js/playerApp.js stay free
// of any Firebase dependency for solving a standalone puzzle). ---

export function getRawData() {
  return read();
}

// Unions a remote {solves, unlocked} snapshot into the local one: for a
// solve key present on both sides, keeps the best (lowest) hints/time seen
// on EITHER side and the earliest firstSolvedAt; for an unlocked
// achievement present on both sides, keeps the earliest unlock date. Then
// re-checks ACHIEVEMENTS against the merged totals (see unlockNew) — a
// union can cross a threshold neither side alone had. Returns whatever's
// newly unlocked BY THIS MERGE, same contract as recordSolve.
export function mergeRemote(remote) {
  const data = read();
  if (remote?.solves && typeof remote.solves === "object") {
    for (const [key, r] of Object.entries(remote.solves)) {
      const existing = data.solves[key];
      data.solves[key] = existing
        ? {
            firstSolvedAt: Math.min(existing.firstSolvedAt, r.firstSolvedAt),
            bestHintsUsed: Math.min(existing.bestHintsUsed, r.bestHintsUsed),
            bestElapsedSeconds:
              existing.bestElapsedSeconds != null && r.bestElapsedSeconds != null
                ? Math.min(existing.bestElapsedSeconds, r.bestElapsedSeconds)
                : existing.bestElapsedSeconds ?? r.bestElapsedSeconds ?? null,
          }
        : { ...r };
    }
  }
  if (remote?.unlocked && typeof remote.unlocked === "object") {
    for (const [id, at] of Object.entries(remote.unlocked)) {
      data.unlocked[id] = data.unlocked[id] ? Math.min(data.unlocked[id], at) : at;
    }
  }
  const newlyUnlocked = unlockNew(data);
  write(data);
  return newlyUnlocked;
}
