import { ACHIEVEMENTS } from "../model/achievements.js";

const KEY = "murdoku:achievements";

function defaultData() {
  return {
    stats: { totalSolved: 0, totalSolvedWithoutHints: 0, fastestSolveSeconds: null },
    unlocked: {}, // { [achievementId]: unlockedAtMs }
  };
}

// Tolerant of a missing/corrupted entry — mirrors board.js's
// deserializeBoardState fallback pattern: anything short of a clean parse
// just starts fresh instead of throwing.
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return {
      stats: {
        totalSolved: Number.isFinite(parsed?.stats?.totalSolved) ? parsed.stats.totalSolved : 0,
        totalSolvedWithoutHints: Number.isFinite(parsed?.stats?.totalSolvedWithoutHints) ? parsed.stats.totalSolvedWithoutHints : 0,
        fastestSolveSeconds: Number.isFinite(parsed?.stats?.fastestSolveSeconds) ? parsed.stats.fastestSolveSeconds : null,
      },
      unlocked: parsed?.unlocked && typeof parsed.unlocked === "object" ? { ...parsed.unlocked } : {},
    };
  } catch {
    return defaultData();
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getStats() {
  return read().stats;
}

export function getUnlocked() {
  return read().unlocked;
}

export function isUnlocked(id) {
  return id in read().unlocked;
}

// Called exactly once per successful solve (gameScreen.js's onSubmit win
// branch), for BOTH standalone puzzles and campaign cases — the one shared
// hook point both onSolved code paths already funnel through, so
// `fastestSolveSeconds`/`totalSolved` stay correct across both modes without
// either playerApp.js or campaignApp.js needing to know this system exists.
// `hintsUsed` is board.js's state.hintsUsed for THIS solve (durable across
// reloads) — 0/falsy means genuinely hint-free.
//
// Returns the achievement definitions newly unlocked BY THIS CALL only
// (never ones already unlocked before it) — empty array when none — so the
// caller can show a "just unlocked" banner exactly once per achievement.
export function recordSolve({ elapsedSeconds, hintsUsed }) {
  const data = read();
  data.stats.totalSolved += 1;
  if (!hintsUsed) data.stats.totalSolvedWithoutHints += 1;
  if (typeof elapsedSeconds === "number") {
    data.stats.fastestSolveSeconds =
      data.stats.fastestSolveSeconds == null ? elapsedSeconds : Math.min(data.stats.fastestSolveSeconds, elapsedSeconds);
  }

  const newlyUnlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (data.unlocked[achievement.id]) continue;
    if (achievement.check(data.stats)) {
      data.unlocked[achievement.id] = Date.now();
      newlyUnlocked.push(achievement);
    }
  }

  write(data);
  return newlyUnlocked;
}
