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
const { CLUE_TYPES } = await import("../../src/model/clueTypes.js");
const { buildPredicate } = await import("../../src/solver/predicates/index.js");
const { checkUniqueness, validateSolution } = await import("../../src/solver/validator.js");
const { findRedundantClues } = await import("../../src/solver/redundancy.js");
const { propagate } = await import("../../src/solver/propagation.js");
const { objectTypeTargetId } = await import("../../src/model/icons.js");

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

const SKIP_TYPES = new Set(["orClue", "victimRoomRule"]);

// --- map ------------------------------------------------------------------
// `map` rows use one letter per zone, "#" for a blocked cell, "." for no zone.
export function buildBase(spec, lang) {
  const rows = spec.map.length;
  const cols = spec.map[0].length;
  const puzzle = createPuzzle(spec.text[lang].title);
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  const zoneIds = {};
  const textures = ["hatch", "wood", "stone", "carpet", "grass", "marble", "water"];
  const colors = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2", "#c2f4e8", "#e8e8e8"];
  Object.entries(spec.zones).forEach(([letter, names], i) => {
    zoneIds[letter] = addZone(puzzle.grid, names[lang], colors[i % colors.length], spec.textures?.[letter] ?? textures[i % textures.length]).id;
  });
  spec.map.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === "#") setBlocked(puzzle.grid, r, c, true);
      else if (zoneIds[ch]) paintCellZone(puzzle.grid, r, c, zoneIds[ch]);
    });
  });
  for (const o of spec.objects || []) placeObject(puzzle.grid, o.type, o.row, o.col);
  const ids = {};
  spec.cast.forEach((member) => {
    const c = addCharacter(puzzle, member.names[lang], member.icon, !!member.victim);
    c.gender = member.gender ?? null;
    c.bio = member.bio?.[lang] ?? "";
    ids[member.key] = c.id;
  });
  for (const [key, [r, c]] of Object.entries(spec.solution)) setSolutionPlacement(puzzle, ids[key], r, c);
  return { puzzle, ids };
}

// --- candidate clues --------------------------------------------------------
function enumerateParams(def, ctx, owner) {
  const { puzzle, presentObjectTypes } = ctx;
  const targetsChar = puzzle.characters.filter((c) => c.id !== owner).map((c) => c.id);
  const targetsAny = [
    ...targetsChar,
    ...puzzle.grid.objects.map((o) => o.id),
    ...presentObjectTypes.map(objectTypeTargetId),
    ...puzzle.grid.zones.map((z) => z.id),
  ];
  const maxIndex = Math.max(puzzle.grid.size.rows, puzzle.grid.size.cols);
  const isProperty = def.params.some((p) => p.name === "property");
  const hasGender = puzzle.characters.some((c) => c.gender);

  function valuesFor(p, chosen) {
    if (p.name === "customClue") return [undefined];
    if (isProperty) {
      if (p.name === "property") return ["adjacentTo", "seated", "sittingOn", ...(hasGender ? ["male", "female"] : []), ...(p.values.includes("") ? [""] : [])];
      if (p.name === "targetId") return chosen.property === "adjacentTo" ? targetsAny : [undefined];
      if (p.name === "objectTypeId") return chosen.property === "sittingOn" ? presentObjectTypes : [undefined];
    }
    switch (p.kind) {
      case "characterOrObject": return targetsAny;
      case "character": return targetsChar;
      case "zone": return puzzle.grid.zones.map((z) => z.id);
      case "number": return [...Array.from({ length: maxIndex }, (_, i) => i + (p.min ?? 1)), ...(p.optional ? [undefined] : [])];
      case "enum": return p.values.filter((v) => v !== "" && v !== "custom");
      default: return null; // multi / clueRef: unsupported
    }
  }

  const out = [];
  (function rec(i, chosen) {
    if (i === def.params.length) { out.push({ ...chosen }); return; }
    const p = def.params[i];
    const values = valuesFor(p, chosen);
    if (values === null) return;
    for (const v of values) {
      const next = { ...chosen };
      if (v !== undefined) next[p.name] = v;
      rec(i + 1, next);
    }
  })(0, {});
  return out;
}

export function trueClues(puzzle, ids, solution) {
  const pm = new Map(Object.entries(solution).map(([key, [row, col]]) => [ids[key], { row, col }]));
  const presentObjectTypes = [...new Set(puzzle.grid.objects.map((o) => o.typeId))];
  const ctx = { puzzle, presentObjectTypes };
  const seen = new Set();
  const pool = [];
  for (const [type, def] of Object.entries(CLUE_TYPES)) {
    if (def.legacy || def.internal || SKIP_TYPES.has(type)) continue;
    const owners = def.scope === "generic" ? [null] : puzzle.characters.map((c) => c.id);
    for (const owner of owners) {
      for (const params of enumerateParams(def, ctx, owner)) {
        for (const negate of [false, true]) {
          const clue = { id: "x", type, characterId: owner, params, negate };
          let result;
          try { result = buildPredicate(clue, puzzle)(pm, true); } catch { continue; }
          if (result !== true) continue;
          const key = JSON.stringify([owner, type, params, negate]);
          if (seen.has(key)) continue;
          seen.add(key);
          pool.push({ type, characterId: owner, params, negate, generic: def.scope === "generic" });
        }
      }
    }
  }
  return pool;
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
  const order = clues.map((_, i) => i).sort(() => random() - 0.5);
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
