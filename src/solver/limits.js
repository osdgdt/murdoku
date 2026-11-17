// How much work each solver-backed action may spend.
//
// Two kinds of action:
//  - the ones a person starts and WATCHES (the editor's uniqueness check, redundant clues, computing the solution,
//    proposing clues; the player's hints and answer check): they show a progress bar and a Cancel button, so they have NO
//    limit: the search always runs to its end, and the person decides how long to wait. They run in workers, so the page
//    stays alive; the only way they end without an answer is the person pressing Cancel. (The live difficulty line under
//    the clues is one of them: it shows its bar and Cancel when it takes more than a second.)
//  - the ones that run by themselves, with nobody to press Cancel (the campaign editor's check of each case): they stay
//    bounded, in work AND time, scaled with the size of the grid, and say "limit reached" (never "no solution" or
//    "unique") when they stop.
//
// A 16x16 case has about three times the cells of a 9x9 one, more characters to place, and every search step costs more,
// so the bounded limits tuned for 9x9 would give up long before an honest answer. The factor is 1 up to 9x9 (nothing
// changes for the sizes the app already had) and grows with the square of the side after that: 16x16 -> about 3.2.
export const BASE_SIDE = 9;

export function sizeFactor(puzzle) {
  const { rows, cols } = puzzle.grid.size;
  return Math.max(1, (Math.max(rows, cols) / BASE_SIDE) ** 2);
}

const scaled = (base, factor) => Math.round(base * factor);

// No limit at all (what `maxWork: Infinity` / `timeMs: null` mean to the solver).
const NO_LIMIT = { maxNodes: Infinity, maxWork: Infinity, timeMs: null };

// The actions that settle a case to the end (uniqueness, redundancy, the player's check, deriving the solution) skip the
// forward check near the leaves: that strategy visits ~4x more nodes but costs less time. The hint search keeps its own.
export const SETTLE_MIN_REMAINING = 4;

export function limitsFor(puzzle) {
  const f = sizeFactor(puzzle);
  return {
    // "Verifica unicità" and the check before sharing/exporting a case. A hard 9x9 case whose clues exclude little
    // (mostly "global" ones that only decide once everybody is placed) can need ~15M units of work and 5-10 s.
    uniqueness: { ...NO_LIMIT, forwardCheckMinRemaining: SETTLE_MIN_REMAINING, parallel: true },
    // one step of the "redundant clues" analysis (it runs one check per clue, several at once: solverClient.laneCountFor).
    // The checks that matter are the slow ones: a clue that IS redundant leaves the case unique, so its check runs to
    // the end of the search (6-8 s on the hard 9x9 benchmark case). Each check is a single search (no slices: the
    // parallelism is across the clues).
    redundancy: { ...NO_LIMIT, forwardCheckMinRemaining: SETTLE_MIN_REMAINING },
    // a player's first look at whether the declared solution is the only one
    confirm: { ...NO_LIMIT, forwardCheckMinRemaining: SETTLE_MIN_REMAINING, parallel: true },
    // working the solution out from the clues alone
    derive: { ...NO_LIMIT, forwardCheckMinRemaining: SETTLE_MIN_REMAINING, parallel: true },

    // the editor's live difficulty line: it starts by itself on every edit, but it shows a bar and a Cancel button when it
    // takes long, and the next edit throws it away: no limit either (on its own worker, so it never blocks the page)
    preview: { ...NO_LIMIT, forwardCheckMinRemaining: SETTLE_MIN_REMAINING },

    // ---- bounded: work that runs by itself, with nobody to cancel it ----
    // the campaign editor's solution check of each case
    campaign: {
      maxWork: scaled(1_000_000_000, f),
      timeMs: scaled(60_000, f),
      forwardCheckMinRemaining: SETTLE_MIN_REMAINING,
      parallel: true,
    },
    // The hint search's own budget. The player's hints run WITHOUT it (the worker is asked for an unlimited budget,
    // hintBudget.js); these numbers are what a caller that cannot be cancelled (tests, tools) gets by default.
    hints: { maxNodes: scaled(2_000_000, f), timeMs: scaled(8_000, f) },
  };
}

// What to hand to the solver for one of the settle actions above: the budgets and the strategy. `parallel` lets the
// client cut a search that runs long into slices on several workers (solverClient.js).
export function searchBudget({ maxNodes = Infinity, maxWork = Infinity, timeMs = null, forwardCheckMinRemaining, parallel }) {
  return { maxNodes, maxWork, timeMs, forwardCheckMinRemaining, parallel };
}

// How long after its own deadline a worker is given before the page gives up on it and starts a
// fresh one (the search checks its deadline itself; this only covers a search that cannot).
export const WORKER_GRACE_MS = 10_000;
