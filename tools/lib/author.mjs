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
const { checkUniqueness, validateSolution } = await import("../../src/solver/validator.js");
const { findRedundantClues } = await import("../../src/solver/redundancy.js");
const { propagate } = await import("../../src/solver/propagation.js");
const { suggestClues } = await import("../../src/solver/suggestions.js");

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

// --- victim-free view and the clue search ---------------------------------------
// The core (withoutVictim, holdsIn, victimCellOptions, composeClues, rng) lives in
// src/solver/composer.js: the editor's "Propose a set of clues" uses the same code.
const composer = await import("../../src/solver/composer.js");
export const { rng, withoutVictim, holdsIn, victimCellOptions } = composer;
export async function composeClues(puzzle, pool, options) {
  return composer.composeClues(puzzle, pool, options);
}

export function measure(puzzle, clues, ids) {
  const p = composer.withClues(puzzle, clues);
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
