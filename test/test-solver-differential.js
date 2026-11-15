// The optimised solver (unary domains, dynamic most-constrained ordering, optional forward
// checking) must find EXACTLY the solutions of the plain reference search, on cases of every
// kind: no clue, a few, contradictory, with rooms, objects and a victim. Seeded, so reproducible.
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone, placeObject, setBlocked } from "../src/model/grid.js";
import { CLUE_TYPES } from "../src/model/clueTypes.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { referenceSolutions } from "./reference-solver.js";
import { assert, assertEqual } from "./assert.js";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Types that need a nested clue are left out (their sub-clue would need its own generation).
const TYPE_IDS = Object.entries(CLUE_TYPES)
  .filter(([, def]) => !def.internal && !def.combinator && !(def.params || []).some((p) => p.kind === "clueRef"))
  .map(([id]) => id);

function randomParam(p, random, ctx) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  switch (p.kind) {
    case "enum":
      return pick(p.values.filter((v) => v !== "custom"));
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

function randomPuzzle(seed) {
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
  const clueCount = Math.floor(random() * 6);
  for (let i = 0; i < clueCount; i++) {
    const type = TYPE_IDS[Math.floor(random() * TYPE_IDS.length)];
    const def = CLUE_TYPES[type];
    const params = {};
    for (const p of def.params || []) {
      const v = randomParam(p, random, ctx);
      if (v !== undefined) params[p.name] = v;
    }
    const owner = def.scope === "generic" ? null : characters[Math.floor(random() * characters.length)];
    const clue = addClue(puzzle, owner, type, params);
    if (random() < 0.3) clue.negate = true;
  }
  return puzzle;
}

const keyOf = (solution) =>
  solution
    .map((p) => `${p.characterId}:${p.row},${p.col}`)
    .sort()
    .join("|");

export const tests = [
  {
    name: "solver differenziale: stesso insieme di soluzioni della ricerca di riferimento (80 casi casuali, con e senza forward-check)",
    fn: () => {
      let withSolutions = 0;
      let withoutSolutions = 0;
      for (let seed = 1; seed <= 80; seed++) {
        const puzzle = randomPuzzle(seed);
        const expected = referenceSolutions(puzzle).sort();
        for (const forwardCheck of [false, true]) {
          const actual = solvePuzzle(puzzle, { maxSolutions: 100000, forwardCheck }).map(keyOf).sort();
          assertEqual(actual.length, expected.length, `caso ${seed} (forwardCheck=${forwardCheck}): numero di soluzioni`);
          for (let i = 0; i < expected.length; i++)
            assertEqual(actual[i], expected[i], `caso ${seed} (forwardCheck=${forwardCheck}): soluzione ${i}`);
        }
        if (expected.length > 0) withSolutions++;
        else withoutSolutions++;
      }
      assert(withSolutions >= 10 && withoutSolutions >= 10, `serve un mix di casi risolvibili e no (${withSolutions}/${withoutSolutions})`);
    },
  },
  {
    name: "solver: con le soluzioni limitate a 2 trova comunque soluzioni vere del caso di riferimento",
    fn: () => {
      for (let seed = 100; seed < 130; seed++) {
        const puzzle = randomPuzzle(seed);
        const all = new Set(referenceSolutions(puzzle));
        for (const sol of solvePuzzle(puzzle, { maxSolutions: 2 })) assert(all.has(keyOf(sol)), `caso ${seed}: soluzione non valida`);
      }
    },
  },
];
