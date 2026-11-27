// Random puzzles for the solver tests (seeded, so every failure is reproducible): a small grid with two
// rooms, three objects, 2-5 characters (the last is the victim) and 0-5 random clues of any ordinary type.
import { createPuzzle, addCharacter, addClue } from "../../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone, placeObject, setBlocked } from "../../src/model/grid.js";
import { CLUE_TYPES } from "../../src/model/clueTypes.js";

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

// Clue types added after the seeded cases and the benchmark baseline were fixed: drawing them too would shift every random choice
// (and so change every case), so they stay out of the random pool and have a test of their own (test-nature.js...).
export const NEWER_TYPE_IDS = new Set([
  "everyObjectTypeNear",
  "onSeal",
  "nextToWall",
  "onlyOneWithProperty",
  "exactlyNWithProperty",
  "objectInRoom",
  "andClue",
  "orGeneral",
  "andGeneral",
  "hasRole",
  "roleDirection",
  "roleAllInRoom",
  "roleOnObjectType",
  "inSea",
  "onShip",
  "inPlaceNamed",
  "sameFloor",
  "floorOrder",
  "onFloor",
]);
// Same for object types added later (the horse and the mud puddle are standable, so they join every "on an object of type" enum).
export const NEWER_OBJECT_TYPE_IDS = new Set([
  "horse",
  "mud",
  "raft",
  "sand",
  "crate",
  "pig",
  "shark",
  "rock",
  "rope",
  "hammock",
  "cannon",
  "elevator",
  "stairs",
]);
export const isNewerClue = (clue) => NEWER_TYPE_IDS.has(clue.type) || NEWER_OBJECT_TYPE_IDS.has(clue.params?.objectTypeId);

// Types that need a nested clue are left out (their sub-clue would need its own generation).
export const TYPE_IDS = Object.entries(CLUE_TYPES)
  .filter(
    ([id, def]) => !NEWER_TYPE_IDS.has(id) && !def.internal && !def.combinator && !(def.params || []).some((p) => p.kind === "clueRef")
  )
  .map(([id]) => id);

export function randomParam(p, random, ctx) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  switch (p.kind) {
    case "enum":
      return pick(p.values.filter((v) => v !== "custom" && !NEWER_OBJECT_TYPE_IDS.has(v)));
    case "number":
      return 1 + Math.floor(random() * 3);
    case "character":
      return pick(ctx.characters);
    case "zone":
      return pick(ctx.zones);
    case "characterOrObject":
      return pick(p.noZone ? [...ctx.characters, ...ctx.objects] : [...ctx.characters, ...ctx.zones, ...ctx.objects]);
    case "characterOrObjectMulti":
      return [pick([...ctx.characters, ...ctx.objects])];
    default:
      return undefined;
  }
}

// A random clue of `type` (or of any ordinary type): { type, owner, params, negate }.
export function randomClueSpec(random, ctx, type = TYPE_IDS[Math.floor(random() * TYPE_IDS.length)]) {
  const def = CLUE_TYPES[type];
  const params = {};
  for (const p of def.params || []) {
    const v = randomParam(p, random, ctx);
    if (v !== undefined) params[p.name] = v;
  }
  const owner = def.scope === "generic" ? null : ctx.characters[Math.floor(random() * ctx.characters.length)];
  return { type, owner, params, negate: random() < 0.3 };
}

// What randomPuzzle built, for tests that need the ids: puzzle.__ctx is not stored, so rebuild it.
export function contextOf(puzzle) {
  return {
    characters: puzzle.characters.map((c) => c.id),
    zones: puzzle.grid.zones.map((z) => z.id),
    objects: puzzle.grid.objects.map((o) => o.id),
  };
}

export function randomPuzzle(seed, { maxClues = 5, extraClue = null } = {}) {
  const random = rng(seed);
  const rows = 3 + Math.floor(random() * 3);
  const cols = rows;
  const puzzle = createPuzzle(`diff ${seed}`);
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  const zones = [addZone(puzzle.grid, "A", "#fdd"), addZone(puzzle.grid, "B", "#dfd")];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (random() < 0.7) paintCellZone(puzzle.grid, r, c, zones[random() < 0.5 ? 0 : 1].id);
  if (random() < 0.4) setBlocked(puzzle.grid, Math.floor(random() * rows), Math.floor(random() * cols), true);
  const objects = [];
  for (let i = 0; i < 3; i++) {
    const o = placeObject(puzzle.grid, ["chair", "plant", "table"][i], Math.floor(random() * rows), Math.floor(random() * cols));
    if (o) objects.push(o.id);
  }
  const count = 2 + Math.floor(random() * (rows - 1));
  const characters = [];
  for (let i = 0; i < count; i++) {
    const c = addCharacter(puzzle, `P${i}`, undefined, i === count - 1);
    c.gender = i % 2 ? "male" : "female";
    characters.push(c.id);
  }
  const ctx = { characters, zones: zones.map((z) => z.id), objects };
  const clueCount = Math.floor(random() * (maxClues + 1));
  for (let i = 0; i < clueCount; i++) {
    const spec = randomClueSpec(random, ctx);
    const clue = addClue(puzzle, spec.owner, spec.type, spec.params);
    if (spec.negate) clue.negate = true;
  }
  if (extraClue) extraClue(puzzle, random, ctx);
  return puzzle;
}
