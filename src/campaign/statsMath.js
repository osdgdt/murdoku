// Statistics of a campaign case across all the players who signed in (the aggregate kept in
// Firestore, see statsStore.js): what a player may send, and what is shown before starting a case.
// Pure and Firebase-free, so it is testable.

// A case's figures are shown only from this many players (fewer would be anecdotes, and a single
// player's numbers would be exposed as "the average").
export const MIN_PLAYERS_TO_SHOW = 3;

// Bounds of what one player can add to a case's totals. The Firestore rules enforce the same
// bounds (firestore.rules): keep the two in step.
export const LIMITS = { maxSeconds: 86400, maxHints: 50, maxChecks: 200 };

// The key of a case in `caseStats/{key}` and in `users/{uid}/caseStats/{key}`.
export const caseStatsKey = (campaignId, caseId) => `${campaignId}__${caseId}`;

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

// What one solve adds to the totals, forced inside the bounds.
export function solveContribution({ seconds, hints, checks }) {
  return {
    seconds: clampInt(seconds, 1, LIMITS.maxSeconds),
    hints: clampInt(hints, 0, LIMITS.maxHints),
    checks: clampInt(checks, 0, LIMITS.maxChecks),
  };
}

// The figures to show for a case, or null when there is nothing to show yet (no document, or
// fewer than MIN_PLAYERS_TO_SHOW players). `doc`: { starts, solves, totalSeconds, totalHints, totalChecks }.
export function summarizeCaseStats(doc) {
  if (!doc) return null;
  const starts = Number(doc.starts) || 0;
  const solves = Number(doc.solves) || 0;
  if (starts < MIN_PLAYERS_TO_SHOW || solves < 1) return null;
  return {
    players: starts,
    solves,
    avgSeconds: Math.round((Number(doc.totalSeconds) || 0) / solves),
    avgHints: (Number(doc.totalHints) || 0) / solves,
    avgChecks: (Number(doc.totalChecks) || 0) / solves,
    // Of those who started it, how many solved it (those still playing count as not yet).
    completionRate: Math.min(1, solves / starts),
  };
}
