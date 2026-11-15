// Authoring aid for the bundled case library. A case spec fixes the map, the
// cast and the TRUE solution; this module then proposes clues (only ones that
// are true under that solution), adds them greedily until the case has exactly
// one solution, prunes the ones that aren't needed, and checks the result
// against a difficulty gate. Everything is seeded, so a run is reproducible.
//
// The output is ordinary puzzle data — the same format the editor produces —
// and every case is re-verified with the real solver before being written.
globalThis.__MURDOKU_LANG__ = "it"; // clue text isn't generated here; keep module-level labels deterministic

const { createPuzzle, addCharacter, addClue, setSolutionPlacement } = await import("../../src/model/puzzle.js");
const { resizeGrid, addZone, paintCellZone, placeObject, setBlocked } = await import("../../src/model/grid.js");
const { buildPredicate } = await import("../../src/solver/predicates/index.js");
const { checkUniqueness, validateSolution } = await import("../../src/solver/validator.js");
const { solvePuzzle } = await import("../../src/solver/solver.js");
const { findRedundantClues } = await import("../../src/solver/redundancy.js");
const { propagate } = await import("../../src/solver/propagation.js");
const { suggestClues } = await import("../../src/solver/suggestions.js");

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

// --- map ------------------------------------------------------------------
// `map` rows use one letter per zone, "#" for a blocked cell, "." for no zone.
export function buildBase(spec, lang) {
  const rows = spec.map.length;
  const cols = spec.map[0].length;
  const puzzle = createPuzzle(spec.text[lang].title);
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  const zoneIds = {};
  const textures = ["hatch", "wood", "stone", "carpet", "grass", "marble", "water"];
  const colors = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2", "#c2f4e8", "#e8e8e8", "#d6e8a4"];
  Object.entries(spec.zones).forEach(([letter, names], i) => {
    zoneIds[letter] = addZone(puzzle.grid, names[lang], colors[i % colors.length], spec.textures?.[letter] ?? textures[i % textures.length]).id;
  });
  spec.map.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === "#") setBlocked(puzzle.grid, r, c, true);
      else if (zoneIds[ch]) paintCellZone(puzzle.grid, r, c, zoneIds[ch]);
    });
  });
  for (const o of spec.objects || []) placeObject(puzzle.grid, o.type, o.row, o.col, o.side);
  const ids = {};
  // House rule: the victim is always the LAST character (placed last, in the
  // last cell that remains), whatever order the spec lists the cast in.
  const cast = [...spec.cast.filter((m) => !m.victim), ...spec.cast.filter((m) => m.victim)];
  cast.forEach((member) => {
    const c = addCharacter(puzzle, member.names[lang], member.icon, !!member.victim);
    c.gender = member.gender ?? null;
    c.bio = member.bio?.[lang] ?? "";
    ids[member.key] = c.id;
  });
  for (const [key, [r, c]] of Object.entries(spec.solution)) setSolutionPlacement(puzzle, ids[key], r, c);
  return { puzzle, ids };
}

// --- candidate clues --------------------------------------------------------
// The enumeration and the "is it true here" filter live in src/solver/suggestions.js (the
// editor's "suggested clues" use the same code).
export function trueClues(puzzle, ids, solution) {
  const pm = new Map(Object.entries(solution).map(([key, [row, col]]) => [ids[key], { row, col }]));
  const { clues } = suggestClues(puzzle, pm, { limit: Infinity, maxEvaluations: Infinity });
  return clues;
}

// --- victim-free view ---------------------------------------------------------
// Generated cases never put a clue on the victim and solve the suspects WITHOUT
// her: she is placed last, in the one cell that is left. So the clue search runs
// on a copy of the puzzle in which the victim does not exist.
export function withoutVictim(puzzle) {
  const victim = puzzle.characters.find((c) => c.isVictim);
  const copy = JSON.parse(JSON.stringify(puzzle));
  copy.characters = copy.characters.filter((c) => !c.isVictim);
  copy.solution = { ...copy.solution, placements: copy.solution.placements.filter((p) => p.characterId !== victim.id) };
  return copy;
}

// Does this clue hold for `placements` (Map characterId -> {row,col}) on `puzzle`?
export function holdsIn(clue, puzzle, placements) {
  try { return buildPredicate({ id: "x", ...clue }, puzzle)(placements, true) === true; } catch { return false; }
}

// How many cells can the victim take once every suspect sits in its true cell?
export function victimCellOptions(puzzle, suspectPlacements) {
  return solvePuzzle(puzzle, { maxSolutions: 5, fixedPlacements: suspectPlacements }).length;
}

// --- search -------------------------------------------------------------------
function domainTotal(puzzle) {
  const result = propagate(puzzle, new Map());
  if (result.contradiction) return Infinity;
  let total = 0;
  for (const cells of result.domains.values()) total += cells.length;
  return total - result.forced.length * 1000; // forced placements are worth a lot
}

function withClues(puzzle, clues) {
  const copy = { ...puzzle, clues: clues.map((c, i) => ({ id: `c${i}`, ...c })) };
  return copy;
}

function isUnique(puzzle, clues) {
  const report = checkUniqueness(withClues(puzzle, clues), { maxSolutions: 2, forwardCheck: true, maxNodes: 3_000_000 });
  return report.solutionCount === 1 && !report.truncated;
}

export async function composeClues(puzzle, pool, { random, allowType, negateChance, sample = 36, maxClues = 40, pruneChance = 1 }) {
  const usable = pool.filter((c) => allowType(c) && (!c.negate || random() < negateChance));
  const clues = [];
  const base = { ...puzzle };
  while (!isUnique(base, clues)) {
    if (clues.length >= maxClues) return null;
    let best = null;
    let bestScore = Infinity;
    for (let k = 0; k < sample; k++) {
      const cand = usable[Math.floor(random() * usable.length)];
      if (clues.some((c) => JSON.stringify([c.characterId, c.type, c.params, c.negate]) === JSON.stringify([cand.characterId, cand.type, cand.params, cand.negate]))) continue;
      const score = domainTotal(withClues(base, [...clues, cand])) + random() * 0.5;
      if (score < bestScore) { bestScore = score; best = cand; }
    }
    if (!best) return null;
    clues.push(best);
  }
  // Prune clues that aren't needed (in random order; `pruneChance` < 1 keeps some
  // redundancy on purpose, for easier cases).
  // Fisher-Yates, not sort(() => random() - 0.5): an inconsistent comparator has an
  // engine-dependent result, and a seed must give the same case under Node and in a browser.
  const order = clues.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let current = clues.slice();
  for (const idx of order) {
    const target = clues[idx];
    if (random() > pruneChance) continue;
    const without = current.filter((c) => c !== target);
    if (without.length && isUnique(base, without)) current = without;
  }
  return current;
}

export function measure(puzzle, clues, ids) {
  const p = withClues(puzzle, clues);
  const prop = propagate(p, new Map());
  const perChar = Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, clues.filter((c) => c.characterId === id).length]));
  return { nClues: clues.length, forcedByPropagation: prop.forced.length, nChars: puzzle.characters.length, perChar, generic: clues.filter((c) => c.generic).length, types: new Set(clues.map((c) => c.type)).size };
}

export async function verify(puzzle) {
  const report = checkUniqueness(puzzle, { maxSolutions: 3, forwardCheck: true });
  if (report.solutionCount !== 1) throw new Error(`not unique (${report.solutionCount})`);
  const check = validateSolution(puzzle);
  if (!check.valid) throw new Error("declared solution violates: " + check.violations.map((v) => v.message).join("; "));
  const redundancy = await findRedundantClues(puzzle, async (candidate) => checkUniqueness(candidate, { maxSolutions: 2, forwardCheck: true }));
  return { redundant: redundancy.redundant.length };
}

export { addClue };
