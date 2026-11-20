// `node tools/find-reasoning-examples.mjs [--tries=N] [--seed=N] > src/glossary/reasoningWorlds.js`
//
// Finds, for each reasoning of the catalogue (src/solver/techniques/catalog.js), a tiny case in which the human solver really
// uses it, and prints them as the data the glossary draws (src/glossary/reasoningWorlds.js). The worlds are made up of the
// glossary's own cast (Anna, Bruno, Carla and the victim Dario) on a 4x4 or 5x5 map; the choice is the SMALLEST case (fewest
// clues, then fewest steps) whose first step of that reasoning rules out a handful of cells, so each figure is easy to read.
// Run it again only to change the examples on purpose: the data is committed, and test-glossary.js checks that every
// world still shows its reasoning.
globalThis.__MURDOKU_LANG__ = "it";

import { createPuzzle, addCharacter } from "../src/model/puzzle.js";
import { createGrid, addZone, paintCellZone, placeObject } from "../src/model/grid.js";
import { suggestClues } from "../src/solver/suggestions.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { TECHNIQUES } from "../src/solver/techniques/catalog.js";
import { isObjectTypeTarget, parseObjectTypeTarget } from "../src/model/icons.js";
import { rng } from "../test/helpers/random-puzzle.js";
import { MAX_SHOWN_CELLS } from "../src/glossary/reasoning.js";

const args = process.argv.slice(2);
const flag = (name, fallback) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const TRIES = flag("tries", 6000);
const SEED = flag("seed", 1);
// `--only=id --bias=type,type`: look for one reasoning only, with the clues of those types tried first (a rare one needs a nudge)
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? null;
const BIAS = new Set((args.find((a) => a.startsWith("--bias="))?.split("=")[1] ?? "").split(",").filter(Boolean));
const AS_JSON = args.includes("--json");
const MAX_SHOWN = flag("max-shown", MAX_SHOWN_CELLS);
const KEYS = ["a", "b", "c", "d"];
const LETTERS = ["A", "B", "C", "D"];
const OBJECT_TYPES = ["plant", "chair", "table", "lamp", "carpet", "shelf"];

// A random little world: rooms grown from a few seeds, a few objects, four characters (the last one is the victim).
function randomWorld(random) {
  const n = random() < 0.8 ? 4 : 5;
  const puzzle = createPuzzle("esempio");
  puzzle.grid = createGrid(n, n);
  const roomCount = 2 + Math.floor(random() * 3);
  const zones = LETTERS.slice(0, roomCount).map((letter) => addZone(puzzle.grid, letter, "#f4c2c2"));
  const owner = Array.from({ length: n }, () => Array(n).fill(-1));
  const frontier = [];
  zones.forEach((_, i) => {
    for (let k = 0; k < 20; k++) {
      const r = Math.floor(random() * n);
      const c = Math.floor(random() * n);
      if (owner[r][c] === -1) {
        owner[r][c] = i;
        frontier.push([r, c]);
        break;
      }
    }
  });
  while (frontier.length) {
    const k = Math.floor(random() * frontier.length);
    const [r, c] = frontier[k];
    const free = [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && owner[a][b] === -1);
    if (!free.length) {
      frontier.splice(k, 1);
      continue;
    }
    const [a, b] = free[Math.floor(random() * free.length)];
    owner[a][b] = owner[r][c];
    frontier.push([a, b]);
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (owner[r][c] >= 0) paintCellZone(puzzle.grid, r, c, zones[owner[r][c]].id);
  const objectCount = 1 + Math.floor(random() * 3);
  const used = new Set();
  for (let i = 0; i < objectCount; i++) {
    const r = Math.floor(random() * n);
    const c = Math.floor(random() * n);
    if (used.has(`${r},${c}`)) continue;
    used.add(`${r},${c}`);
    placeObject(puzzle.grid, OBJECT_TYPES[Math.floor(random() * OBJECT_TYPES.length)], r, c);
  }
  KEYS.forEach((key, i) => {
    const character = addCharacter(puzzle, key, "person1", i === KEYS.length - 1);
    character.gender = i % 2 ? "male" : "female"; // Anna, Clara: female; Ben, David: male
  });
  return puzzle;
}

// every complete arrangement (the victim's room rule included), by the exact search
function solutionsOf(puzzle) {
  return solvePuzzle({ ...puzzle, clues: [] }, { maxSolutions: 5000 });
}

// a case with exactly one solution made of TRUE clues (none about the victim), then pruned to the clues that are needed
function uniqueCase(puzzle, random) {
  const options = solutionsOf(puzzle);
  if (options.length === 0) return null;
  const chosen = new Map(options[Math.floor(random() * options.length)].map((p) => [p.characterId, { row: p.row, col: p.col }]));
  const victim = puzzle.characters.find((c) => c.isVictim).id;
  const pool = suggestClues(puzzle, chosen, { limit: 6000, maxEvaluations: 900000 }).clues.filter(
    (c) => c.type !== "closerTo" && c.characterId !== victim && !JSON.stringify(c.params ?? {}).includes(victim)
  );
  // «A oppure B»: two clues of the same character put together (both true here, which is enough for the reasoning to be used)
  for (let k = 0; k < 40; k++) {
    const x = pool[Math.floor(random() * pool.length)];
    const y = pool[Math.floor(random() * pool.length)];
    if (!x.characterId || x.characterId !== y.characterId || x === y || x.type === "orClue" || y.type === "orClue") continue;
    pool.push({
      type: "orClue",
      characterId: x.characterId,
      negate: false,
      params: { a: { type: x.type, params: x.params }, b: { type: y.type, params: y.params } },
    });
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  pool.sort((x, y) => (BIAS.has(y.type) ? 1 : 0) - (BIAS.has(x.type) ? 1 : 0));
  const clues = [];
  const isUnique = (list) =>
    solvePuzzle({ ...puzzle, clues: list.map((c, i) => ({ id: `g${i}`, ...c })) }, { maxSolutions: 2 }).length === 1;
  for (const entry of pool) {
    if (isUnique(clues)) break;
    clues.push({ ...entry });
    clues.forEach((c) => delete c.generic);
  }
  if (!isUnique(clues)) return null;
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.filter((_, k) => k !== i);
    if (isUnique(without)) clues.splice(i, 1);
  }
  return clues;
}

// puzzle + clues -> the world as the glossary stores it (refs instead of ids)
function toWorld(puzzle, clues) {
  const grid = puzzle.grid;
  const zoneLetter = new Map(grid.zones.map((z, i) => [z.id, LETTERS[i]]));
  const charKey = new Map(puzzle.characters.map((c, i) => [c.id, KEYS[i]]));
  const objects = grid.objects.map((o) => ({ type: o.typeId, at: [o.row, o.col] }));
  const objectIndex = new Map(grid.objects.map((o, i) => [o.id, i]));
  const ref = (v) => {
    if (Array.isArray(v)) return v.map(ref);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ref(x)]));
    if (typeof v !== "string") return v;
    if (charKey.has(v)) return `@c:${charKey.get(v)}`;
    if (zoneLetter.has(v)) return `@z:${zoneLetter.get(v)}`;
    if (objectIndex.has(v)) return `@o:${objectIndex.get(v)}`;
    if (isObjectTypeTarget(v)) return `@t:${parseObjectTypeTarget(v)}`;
    return v;
  };
  const map = [];
  for (let r = 0; r < grid.size.rows; r++) {
    let line = "";
    for (let c = 0; c < grid.size.cols; c++) {
      if (grid.cells[r][c].blocked) line += "#";
      else line += zoneLetter.get(grid.cells[r][c].zoneId) ?? ".";
    }
    map.push(line);
  }
  return {
    map,
    objects,
    cast: Object.fromEntries(
      puzzle.characters.map((c, i) => [KEYS[i], c.isVictim ? { victim: true, gender: c.gender } : { gender: c.gender }])
    ),
    clues: clues.map((c) => ({
      owner: c.characterId ? charKey.get(c.characterId) : null,
      type: c.type,
      params: ref(c.params ?? {}),
      negate: !!c.negate,
    })),
  };
}

const best = new Map(); // technique -> { score, world, focus }
const random = rng(SEED);
for (let i = 0; i < TRIES; i++) {
  const puzzle = randomWorld(random);
  const clues = uniqueCase(puzzle, random);
  if (!clues || clues.length === 0 || clues.length > 7) continue;
  const solved = { ...puzzle, clues: clues.map((c, k) => ({ id: `g${k}`, ...c })) };
  const result = humanSolve(solved, { maxWork: 200000 });
  if (result.status !== "solved") continue;
  const seen = new Set();
  result.steps.forEach((step, index) => {
    if (seen.has(step.technique) || (ONLY && step.technique !== ONLY)) return;
    // the figure shows a step that rules cells out (or places somebody), a handful of cells at most
    const shown = step.placed ? 1 : (step.eliminated?.length ?? 0);
    if (shown === 0 || shown > MAX_SHOWN) return;
    seen.add(step.technique);
    const score = clues.length * 100 + result.steps.length * 3 + shown;
    const current = best.get(step.technique);
    if (!current || score < current.score) {
      best.set(step.technique, {
        score,
        world: toWorld(puzzle, clues),
        focus: KEYS[puzzle.characters.findIndex((c) => c.id === step.characterId)],
        index,
      });
    }
  });
}

const out = {};
for (const tech of TECHNIQUES) {
  const found = best.get(tech.id);
  console.error(
    `${tech.id.padEnd(18)} ${found ? `ok · ${found.world.clues.length} indizi, passo ${found.index + 1}, ${found.world.map.length}x${found.world.map.length}` : "NESSUN ESEMPIO"}`
  );
  if (found) out[tech.id] = { ...found.world, focus: found.focus };
}
if (AS_JSON) {
  console.log(JSON.stringify(out));
  process.exit(0);
}
console.log(`// Generated by tools/find-reasoning-examples.mjs: a tiny case for each reasoning of the catalogue, in the glossary's world format
// (src/glossary/examples.js). The glossary runs the human solver on each one and draws the first step that uses the reasoning.
export default ${JSON.stringify(out, null, 2)};`);
