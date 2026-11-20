// Composing a set of clues for a case whose solution is known: pick TRUE clues, add them one by one (the
// candidate that narrows the search most) until the solution is the only one, then drop the ones that turned
// out not to be needed. Seeded, so the same inputs give the same clues.
//
// Used by the case-library builder (tools/lib/*, in Node) and by the editor's "Propose a set of clues" (in a
// worker in the page): nothing here touches the page, the file system or the language.
//
// House rules (the generated cases of the library follow them, and the editor offers them by default):
//  - no clue ever concerns the victim: the search runs on a copy of the case in which she does not exist
//    (`withoutVictim`) and she is placed last, in the one cell that remains;
//  - "is closer to X than to Y" is not used.
import { buildPredicate } from "./predicates/index.js";
import { humanSolve } from "./techniques/engine.js";
import { levelIndex } from "./techniques/catalog.js";
import { checkUniqueness } from "./validator.js";
import { solvePuzzle } from "./solver.js";
import { propagate } from "./propagation.js";
import { suggestClues, declaredPlacementMap } from "./suggestions.js";
import { staged } from "./progress.js";

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BANNED_TYPES = new Set(["closerTo"]);

// A copy of the case without the victim (and her place in the solution).
export function withoutVictim(puzzle) {
  const victim = puzzle.characters.find((c) => c.isVictim);
  const copy = JSON.parse(JSON.stringify(puzzle));
  if (!victim) return copy;
  copy.characters = copy.characters.filter((c) => c.id !== victim.id);
  copy.solution = { ...copy.solution, placements: copy.solution.placements.filter((p) => p.characterId !== victim.id) };
  return copy;
}

// Does this clue hold for `placements` (Map characterId -> {row,col}) on `puzzle`?
export function holdsIn(clue, puzzle, placements) {
  try {
    return buildPredicate({ id: "x", ...clue }, puzzle)(placements, true) === true;
  } catch {
    return false;
  }
}

// How many cells can the victim take once every suspect sits in its true cell?
export function victimCellOptions(puzzle, suspectPlacements) {
  return solvePuzzle(puzzle, { maxSolutions: 5, fixedPlacements: suspectPlacements }).length;
}

// How much room the clues still leave (smaller is better; each forced placement is worth a lot).
function domainTotal(puzzle) {
  const result = propagate(puzzle, new Map());
  if (result.contradiction) return Infinity;
  let total = 0;
  for (const cells of result.domains.values()) total += cells.length;
  return total - result.forced.length * 1000;
}

export function withClues(puzzle, clues) {
  return { ...puzzle, clues: clues.map((c, i) => ({ id: `c${i}`, ...c })) };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const sameClue = (a, b) =>
  JSON.stringify([a.characterId, a.type, a.params, a.negate]) === JSON.stringify([b.characterId, b.type, b.params, b.negate]);

// Adds clues from `pool` until the case has exactly one solution, then prunes. Returns the clues that were
// ADDED (not `fixed`), or null; with `report`, says why in `report.reason`: "too-many" (maxClues reached),
// "no-candidate", "time" (the deadline passed). Options:
//   random, allowType(clue), negateChance, sample, maxClues, pruneChance  as in the library builder;
//   fixed: clues already in the case, kept as they are and counted when checking uniqueness;
//   maxNodes: node budget of each uniqueness check; deadline: a performance.now() time to stop at (null: none);
//   onProgress(fraction): how far this attempt has got, 0..1 (adding clues is about half of it, then the clues are tried
//   out one by one: how many are still to try is known; how many clues will be added is not, so that part is a curve).
export function composeClues(
  puzzle,
  pool,
  {
    random,
    allowType,
    negateChance,
    sample = 36,
    maxClues = 40,
    pruneChance = 1,
    fixed = [],
    maxNodes = 3_000_000,
    deadline = null,
    report = null,
    onProgress = null,
  }
) {
  const isUnique = (base, clues) => {
    const timeMs = deadline === null ? null : Math.max(1, deadline - now());
    const result = checkUniqueness(withClues(base, [...fixed, ...clues]), { maxSolutions: 2, forwardCheck: true, maxNodes, timeMs });
    return result.solutionCount === 1 && !result.truncated;
  };
  const late = () => deadline !== null && now() >= deadline;
  const fail = (reason) => {
    if (report) report.reason = reason;
    return null;
  };

  const usable = pool.filter((c) => allowType(c) && (!c.negate || random() < negateChance));
  const clues = [];
  const base = { ...puzzle };
  const GROWTH_SHARE = 0.5; // of the attempt: adding clues; the rest is trying them out
  // clues added so far -> how far growth is: half way after about as many clues as there are characters
  const growth = () => 1 - 1 / (1 + clues.length / Math.max(1, puzzle.characters.length));
  onProgress?.(0);
  while (!isUnique(base, clues)) {
    onProgress?.(GROWTH_SHARE * growth());
    if (late()) return fail("time");
    if (clues.length >= maxClues) return fail("too-many");
    let best = null;
    let bestScore = Infinity;
    for (let k = 0; k < sample; k++) {
      const cand = usable[Math.floor(random() * usable.length)];
      if (!cand) break;
      if (clues.some((c) => sameClue(c, cand)) || fixed.some((c) => sameClue(c, cand))) continue;
      const score = domainTotal(withClues(base, [...fixed, ...clues, cand])) + random() * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (!best) return fail("no-candidate");
    clues.push(best);
  }
  // Prune clues that aren't needed (in random order; `pruneChance` < 1 keeps some redundancy on purpose, for
  // easier cases). Fisher-Yates, not sort(() => random() - 0.5): an inconsistent comparator has an
  // engine-dependent result, and a seed must give the same case under Node and in a browser.
  const order = clues.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let current = clues.slice();
  let tried = 0;
  for (const idx of order) {
    onProgress?.(GROWTH_SHARE + (1 - GROWTH_SHARE) * (tried++ / order.length));
    if (late()) break; // out of time: keep what is already proved sufficient
    const target = clues[idx];
    if (random() > pruneChance) continue;
    const without = current.filter((c) => c !== target);
    if (without.length && isUnique(base, without)) current = without;
  }
  onProgress?.(1);
  return current;
}

// ---- difficulty presets --------------------------------------------------------------------
const SIMPLE = new Set([
  "inRoom",
  "inRowOrCol",
  "adjacent",
  "diagonal",
  "sameRoomAs",
  "onObjectType",
  "rowOrColWith",
  "inCorner",
  "aloneInRoom",
  "facing",
  "seated",
  "inFrontOfWindow",
]);
const RELATIONAL = new Set([
  ...SIMPLE,
  "between",
  "zoneAdjacentTo",
  "rowOrColAdjacentTo",
  "directionDistance",
  "onlyPersonNear",
  "inRoomCorner",
  "aloneWithPerson",
  "rowOrColParity",
  "someoneInRoomWithProperty",
]);

// What each level allows (`gate` is the library's extra acceptance test on the finished set; the editor does not use it).
export const MODES = {
  easy: {
    allowType: (c) => SIMPLE.has(c.type) && !c.negate && !c.generic,
    negateChance: 0,
    pruneChance: 0.5,
    gate: (m) => m.forcedByPropagation === m.nChars && m.types >= 3 && m.nClues >= m.nChars + 1,
  },
  medium: {
    allowType: (c) => RELATIONAL.has(c.type) && !c.generic,
    negateChance: 0.25,
    pruneChance: 1,
    gate: (m) => m.forcedByPropagation >= 1 && m.forcedByPropagation < m.nChars && m.types >= 4,
  },
  hard: {
    allowType: () => true,
    negateChance: 0.4,
    pruneChance: 1,
    gate: (m) => m.forcedByPropagation <= 1 && m.generic >= 1 && m.types >= 5,
  },
  expert: {
    allowType: () => true,
    negateChance: 0.5,
    pruneChance: 1,
    gate: (m) => m.forcedByPropagation === 0 && m.generic >= 1 && m.types >= 5,
  },
};

// ---- for the editor ----------------------------------------------------------------------------
// Proposes clues that make the declared solution the only one. Does not touch `puzzle`.
//   mode: "easy" | "medium" | "hard"; seed: any integer (another seed, another set);
//   victimFree (default true): no clue about the victim; keepExisting (default true): the clues already in
//   the case stay and the proposal completes them; maxNodes / timeMs: the limits (`timeMs: null` and `maxNodes: Infinity`:
//   none: it only ends when it has an answer, or runs out of attempts, and the person can cancel);
//   onProgress(fraction): how far it has got, 0..1, never going back.
// Returns { status: "ok", clues: [{ type, characterId, params, negate }], nodes }
//       | { status: "failed", reason: "no-solution" | "time" | "too-many" | "no-candidate" | "not-unique" | "limit" }
export function proposeClueSet(
  puzzle,
  { mode = "medium", seed = 1, victimFree = true, keepExisting = true, maxNodes = 3_000_000, timeMs = 20_000, onProgress = null } = {}
) {
  const fullMap = declaredPlacementMap(puzzle);
  if (!fullMap) return { status: "failed", reason: "no-solution" };
  const deadline = timeMs == null ? null : now() + timeMs;
  const timeIsUp = () => deadline !== null && now() >= deadline;
  const settings = MODES[mode] ?? MODES.medium;
  const level = MODES[mode] ? mode : "medium"; // the level the set is judged against
  const hasVictim = puzzle.characters.some((c) => c.isVictim);
  const dropVictim = victimFree && hasVictim;
  const view = dropVictim ? withoutVictim(puzzle) : JSON.parse(JSON.stringify(puzzle));
  const viewMap = dropVictim ? new Map([...fullMap].filter(([id]) => view.characters.some((c) => c.id === id))) : fullMap;

  // clues already in the case: kept (those about the victim are left out of the search view: it has no victim)
  const victimId = puzzle.characters.find((c) => c.isVictim)?.id;
  const mentionsVictim = (clue) => dropVictim && (clue.characterId === victimId || JSON.stringify(clue.params ?? {}).includes(victimId));
  const existing = keepExisting
    ? puzzle.clues
        .filter((c) => !mentionsVictim(c))
        .map(({ characterId, type, params, negate }) => ({ characterId, type, params, negate: !!negate }))
    : [];
  view.clues = [];

  // candidates: true for the suspects alone AND for the whole solution (a general clue like "nobody in the
  // kitchen" can change once the victim is back), never about the victim, never a banned type
  const { clues: candidates } = suggestClues(view, viewMap, { limit: 60000, maxEvaluations: 600000 });
  const pool = candidates.filter((c) => !BANNED_TYPES.has(c.type) && holdsIn(c, puzzle, fullMap));

  // The victim is not in the search (see the house rules), so a set that settles the suspects can still leave her
  // more than one place; then another draw is tried, until one works or the time is up.
  // A set that works is then judged by the HUMAN solver (techniques/engine.js): it counts only if the case needs the
  // reasonings of exactly the level asked for (none harder, at least one of that level). A set of another level is kept as
  // the fallback, and the next attempt leans the other way: when the case came out too hard, the clues are pruned less (more
  // of them stay, so each step is easier); when too easy, every clue is pruned and every type is allowed.
  const attempts = 12;
  let lastFailure = { status: "failed", reason: timeIsUp() ? "time" : "no-candidate" };
  let pruneChance = settings.pruneChance;
  let allowType = settings.allowType;
  let tooEasyInARow = 0;
  let fallback = null; // the closest set found so far: { clues, nodes, rank }
  // an attempt that fails starts another one: the bar is shared out between an unknown number of attempts
  // (progress.js), and the last twentieth of the attempt is the proof on the whole case
  for (let attempt = 0; attempt < attempts && !timeIsUp(); attempt++) {
    const report = {};
    const inAttempt = onProgress ? (fraction) => onProgress(staged(attempt, fraction)) : null;
    const added = composeClues(view, pool, {
      random: rng(seed + attempt * 7919),
      allowType,
      negateChance: settings.negateChance,
      sample: 24,
      maxClues: Math.max(12, puzzle.characters.length * 4),
      pruneChance,
      fixed: existing,
      maxNodes,
      deadline,
      report,
      onProgress: inAttempt ? (fraction) => inAttempt(0.95 * fraction) : null,
    });
    if (!added) {
      lastFailure = { status: "failed", reason: report.reason ?? "no-candidate" };
      if (report.reason === "time") break;
      continue;
    }
    // the proof that counts: on the WHOLE case, the victim back in, with every clue (the ones already there too)
    const kept = puzzle.clues.map(({ characterId, type, params, negate }) => ({ characterId, type, params, negate: !!negate }));
    const finalClues = dropVictim && keepExisting ? [...kept, ...added] : [...(keepExisting ? existing : []), ...added];
    const check = checkUniqueness(withClues(puzzle, finalClues), {
      maxSolutions: 2,
      forwardCheck: true,
      maxNodes,
      timeMs: deadline === null ? null : Math.max(1000, deadline - now()),
      onProgress: inAttempt ? (fraction) => inAttempt(0.95 + 0.05 * fraction) : null,
    });
    if (!check.exhausted) {
      lastFailure = { status: "failed", reason: "limit" };
      continue;
    }
    if (check.solutionCount !== 1) {
      lastFailure = { status: "failed", reason: "not-unique" };
      continue;
    }
    const plain = added.map(({ type, characterId, params, negate }) => ({ type, characterId, params, negate: !!negate }));
    const verdict = judgeLevel(withClues(puzzle, finalClues), level, deadline);
    const found = { clues: plain, nodes: check.nodesVisited };
    if (verdict.rank === 0) {
      onProgress?.(1);
      return { status: "ok", ...found, level: verdict.level, hardest: verdict.hardest, requested: level, exact: true };
    }
    if (!fallback || Math.abs(verdict.rank) < Math.abs(fallback.rank)) fallback = { ...found, rank: verdict.rank };
    if (verdict.rank > 0) {
      pruneChance = Math.max(0, pruneChance * 0.5);
      tooEasyInARow = 0;
    } else {
      pruneChance = 1;
      if (++tooEasyInARow >= 2) allowType = MODES.hard.allowType;
    }
  }
  if (fallback) {
    // not the level asked for: say which one it is
    const real = humanSolve(withClues(puzzle, [...(keepExisting ? existing : []), ...fallback.clues]), {
      maxWork: HUMAN_JUDGE_WORK,
      deadline,
    });
    onProgress?.(1);
    return {
      status: "ok",
      clues: fallback.clues,
      nodes: fallback.nodes,
      level: real.status === "solved" ? real.level : null,
      hardest: real.status === "solved" ? real.hardest : null,
      requested: level,
      exact: false,
    };
  }
  return lastFailure;
}

// Work the human solver may spend judging one set of clues (about a second at most on a 9x9 case).
const HUMAN_JUDGE_WORK = 3_000_000;

// How does a finished case compare with the level asked for? rank: 0 it is exactly that level (everything solved with
// reasonings up to it, at least one of its own level), -1 easier, 1 harder (or too heavy to tell). `level`/`hardest` as
// found when it was solved within the level.
function judgeLevel(finalPuzzle, mode, deadline) {
  const result = humanSolve(finalPuzzle, { maxLevel: mode, maxWork: HUMAN_JUDGE_WORK, deadline });
  if (result.status !== "solved") return { rank: 1, level: null, hardest: null };
  const rank = levelIndex(result.level) - levelIndex(mode);
  return { rank: rank === 0 ? 0 : -1, level: result.level, hardest: result.hardest };
}
