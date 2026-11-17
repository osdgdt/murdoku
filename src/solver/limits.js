// How much work each solver-backed action may spend, scaled with the size of the grid.
//
// A 16x16 case has about three times the cells of a 9x9 one, more characters to place, and every
// search step costs more, so limits tuned for 9x9 would give up long before an honest answer.
// The factor is 1 up to 9x9 (nothing changes for the sizes the app already had) and grows with
// the square of the side after that: 16x16 -> about 3.2.
//
// Two kinds of limit, always together: a NODE budget (reproducible, independent of the machine)
// and a TIME budget (what the person actually waits). Whichever comes first ends the search, and
// the result says which one it was, so the screens can tell "no solution" from "gave up".
export const BASE_SIDE = 9;

export function sizeFactor(puzzle) {
  const { rows, cols } = puzzle.grid.size;
  return Math.max(1, (Math.max(rows, cols) / BASE_SIDE) ** 2);
}

const scaled = (base, factor) => Math.round(base * factor);

// The actions that settle a case to the end (uniqueness, redundancy, the player's check, deriving the solution) search
// with a WORK budget (clue evaluations plus a charge per node, see solver.js) instead of a node budget, and skip the
// forward check near the leaves: that strategy visits ~4x more nodes but costs less time, so a node count would say
// the opposite of what the person waits. Their `maxNodes` is kept only for callers that still use it (the clue composer).
// The hint search keeps its node budget and its strategy.
export const SETTLE_MIN_REMAINING = 4;

export function limitsFor(puzzle) {
  const f = sizeFactor(puzzle);
  return {
    // "Verifica unicità" and the check before sharing/exporting a case. A hard 9x9 case whose clues exclude little
    // (mostly "global" ones that only decide once everybody is placed) can need ~15M units of work and 5-10 s: the
    // budget has to cover that with room to spare, or the author is told "limit reached" about a case that is
    // perfectly fine. The screen shows progress and a Cancel button.
    uniqueness: {
      maxNodes: scaled(600_000, f),
      maxWork: scaled(60_000_000, f),
      timeMs: scaled(30_000, f),
      forwardCheckMinRemaining: SETTLE_MIN_REMAINING,
      parallel: true,
    },
    // one step of the "redundant clues" analysis (it runs one check per clue, several at once: solverClient.laneCountFor).
    // The checks that matter are the slow ones: a clue that IS redundant leaves the case unique, so its check runs to
    // the end of the search (6-8 s on the hard 9x9 benchmark case) and one that gave up at the limit is reported as
    // "not proven needed". Each check is a single search (no slices: the parallelism is across the clues).
    redundancy: {
      maxNodes: scaled(200_000, f),
      maxWork: scaled(80_000_000, f),
      timeMs: scaled(20_000, f),
      forwardCheckMinRemaining: SETTLE_MIN_REMAINING,
    },
    // a player's first look at whether the declared solution is the only one
    confirm: {
      maxNodes: scaled(1_000_000, f),
      maxWork: scaled(100_000_000, f),
      timeMs: scaled(15_000, f),
      forwardCheckMinRemaining: SETTLE_MIN_REMAINING,
      parallel: true,
    },
    // working the solution out from the clues alone
    derive: {
      maxNodes: scaled(10_000_000, f),
      maxWork: scaled(1_000_000_000, f),
      timeMs: scaled(60_000, f),
      forwardCheckMinRemaining: SETTLE_MIN_REMAINING,
      parallel: true,
    },
    // one click on the hint button (the node budget is shared by all the waves of that click)
    hints: { maxNodes: scaled(2_000_000, f), timeMs: scaled(8_000, f) },
  };
}

// What to hand to the solver for one of the settle actions above: the work and time budgets and the strategy.
// `parallel` lets the client cut a search that runs long into slices on several workers (solverClient.js).
export function searchBudget({ maxWork, timeMs, forwardCheckMinRemaining, parallel }) {
  return { maxWork, timeMs, forwardCheckMinRemaining, parallel };
}

// How long after its own deadline a worker is given before the page gives up on it and starts a
// fresh one (the search checks its deadline itself; this only covers a search that cannot).
export const WORKER_GRACE_MS = 10_000;
