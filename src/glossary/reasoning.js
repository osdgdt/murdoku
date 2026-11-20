// The little worked examples of the reasonings in the glossary (glossary.html, «Ragionamenti»). Like the clue examples, they are
// not drawings: each is a real tiny case (src/glossary/reasoningWorlds.js, found by tools/find-reasoning-examples.mjs) and the
// figure is a step the HUMAN SOLVER really makes on it, so the glossary cannot disagree with how the game reasons.
// Pure (no DOM): glossaryPage.js draws it, test-glossary.js checks it.
import REASONING_WORLDS from "./reasoningWorlds.js";
import { buildWorld, resolveRefs, ROOM_NAMES } from "./examples.js";
import { humanSolve } from "../solver/techniques/engine.js";
import { resolveClueHoverCells } from "../solver/hoverTargets.js";
import { describeClue } from "../model/clueTypes.js";
import { isOccupiable } from "../model/grid.js";

export const hasReasoningWorld = (techniqueId) => techniqueId in REASONING_WORLDS;

// The step the figure shows: the first one of this reasoning that places somebody or rules a handful of cells out (more would
// not fit a readable picture: MAX_SHOWN_CELLS). Shared with the finder, so that what it picks is what the page draws.
export const MAX_SHOWN_CELLS = 10;
export function pickStep(steps, technique) {
  const index = steps.findIndex((step) => {
    if (step.technique !== technique) return false;
    const shown = step.placed ? 1 : (step.eliminated?.length ?? 0);
    return shown >= 1 && shown <= MAX_SHOWN_CELLS;
  });
  return index < 0 ? null : { step: steps[index], index };
}

const keyOf = ({ row, col }) => `${row},${col}`;

// -> null (no example) or {
//   puzzle, grid, objects,            the little case
//   focus,                            the character the step is about
//   placedBefore: Map id -> cell,     who is already placed when the step is made
//   remaining: Set "r,c",             where the character can still be after the step
//   eliminated: [{row,col}],          the cells this step rules out (a placement: the other cells of the character)
//   placed,                           {row,col} when the step places the character
//   clues: [{ text }],                the clues the step rests on, as written in the game
//   rings: [{row,col}],               what those clues point at
//   withNames: [name],                the other characters the step takes into account (a group, a clue between two)
//   step,
// }
export function buildReasoningExample(techniqueId) {
  const world = REASONING_WORLDS[techniqueId];
  if (!world) return null;
  const built = buildWorld({ ...world, rooms: ROOM_NAMES });
  const ctx = { characters: built.characters, objects: built.objects, zones: built.zones };
  built.puzzle.clues = world.clues.map((c, i) => ({
    id: `g${i}`,
    characterId: c.owner ? built.characters[c.owner].id : null,
    type: c.type,
    params: resolveRefs(c.params, ctx),
    negate: !!c.negate,
  }));
  const result = humanSolve(built.puzzle, { maxWork: 300000 });
  // a hand-made example may leave somebody free (the figure is one step, not the whole solution), but never a contradiction
  if (result.status !== "solved" && result.status !== "ambiguous") return null;
  const picked = pickStep(result.steps, techniqueId);
  if (!picked) return null;
  const { step, index } = picked;
  const focus = built.puzzle.characters.find((c) => c.id === step.characterId);

  // the board as it is when the step is made
  const placedBefore = new Map();
  const domain = new Set();
  for (let r = 0; r < built.grid.size.rows; r++)
    for (let c = 0; c < built.grid.size.cols; c++) if (isOccupiable(built.grid, r, c)) domain.add(`${r},${c}`);
  const clueIds = new Set(); // everything that has narrowed the character down so far, this step included
  for (const earlier of result.steps.slice(0, index)) {
    if (earlier.placed) placedBefore.set(earlier.characterId, earlier.placed);
    if (earlier.characterId === focus.id) {
      for (const cell of earlier.eliminated ?? []) domain.delete(keyOf(cell));
      for (const id of earlier.clueIds ?? []) clueIds.add(id);
    }
  }
  for (const id of step.clueIds ?? []) clueIds.add(id);
  const remaining = new Set(domain);
  let eliminated = step.eliminated ?? [];
  if (step.placed) {
    eliminated = [...domain]
      .filter((k) => k !== keyOf(step.placed))
      .map((k) => ({ row: Number(k.split(",")[0]), col: Number(k.split(",")[1]) }));
    remaining.clear();
    remaining.add(keyOf(step.placed));
  } else {
    for (const cell of eliminated) remaining.delete(keyOf(cell));
  }

  const used = [...clueIds].map((id) => built.puzzle.clues.find((c) => c.id === id)).filter(Boolean);
  const nameOf = (id) => built.puzzle.characters.find((c) => c.id === id)?.name;
  const clues = used.map((clue) => ({
    text: (clue.characterId ? `${nameOf(clue.characterId)}: ` : "") + describeClue(clue, built.puzzle),
  }));
  const withNames = (step.byCharacterIds ?? []).map(nameOf).filter(Boolean); // who else the step takes into account
  const standing = new Set([...placedBefore.values()].map(keyOf));
  const withObject = new Set(built.objects.filter(Boolean).map((o) => `${o.row},${o.col}`));
  const rings = [];
  for (const clue of used) {
    for (const cell of resolveClueHoverCells(clue, built.puzzle, placedBefore)) {
      if (standing.has(keyOf(cell)) || withObject.has(keyOf(cell))) rings.push(cell);
    }
  }
  return {
    puzzle: built.puzzle,
    grid: built.grid,
    objects: built.objects,
    focus,
    placedBefore,
    remaining,
    eliminated,
    placed: step.placed ?? null,
    clues,
    rings,
    withNames,
    step,
  };
}
