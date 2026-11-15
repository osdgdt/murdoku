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

export function limitsFor(puzzle) {
  const f = sizeFactor(puzzle);
  return {
    // "Verifica unicità" and the check before sharing/exporting a case
    uniqueness: { maxNodes: scaled(200_000, f), timeMs: scaled(10_000, f) },
    // one step of the "redundant clues" analysis (it runs one check per clue)
    redundancy: { maxNodes: scaled(200_000, f), timeMs: scaled(5_000, f) },
    // a player's first look at whether the declared solution is the only one
    confirm: { maxNodes: scaled(1_000_000, f), timeMs: scaled(15_000, f) },
    // working the solution out from the clues alone
    derive: { maxNodes: scaled(10_000_000, f), timeMs: scaled(60_000, f) },
    // one click on the hint button (the node budget is shared by all the waves of that click)
    hints: { maxNodes: scaled(2_000_000, f), timeMs: scaled(8_000, f) },
  };
}

// How long after its own deadline a worker is given before the page gives up on it and starts a
// fresh one (the search checks its deadline itself; this only covers a search that cannot).
export const WORKER_GRACE_MS = 10_000;
