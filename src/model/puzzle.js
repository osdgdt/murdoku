import { makeId } from "../util/id.js";
import { createGrid, isOccupiable } from "./grid.js";
import { isObjectTypeTarget } from "./icons.js";

export const SCHEMA_VERSION = 1;

export const DIFFICULTY_LEVELS = [
  { value: "", label: "Non specificata" },
  { value: "very-easy", label: "Molto facile" },
  { value: "easy", label: "Facile" },
  { value: "medium", label: "Media" },
  { value: "hard", label: "Difficile" },
  { value: "expert", label: "Esperto" },
];

export function difficultyLabel(value) {
  return DIFFICULTY_LEVELS.find((d) => d.value === value)?.label || DIFFICULTY_LEVELS[0].label;
}

// Rough, informational-only proxy for the editor's "estimate difficulty"
// button — never overwrites the author's own manual rating. Nodes visited
// by the plain backtracking search (see solvePuzzle's `stats.nodesVisited`)
// isn't a precise measure of how hard a human would find the puzzle (search
// order affects it independently of clue quality), but a well-clued puzzle
// prunes dead branches fast while an underconstrained one takes many nodes
// to pin down, so it's a reasonable at-a-glance signal at zero extra
// computation cost (the search already runs for "Verifica unicità").
export function estimateDifficultyFromNodes(nodesVisited) {
  if (nodesVisited < 30) return "very-easy";
  if (nodesVisited < 150) return "easy";
  if (nodesVisited < 800) return "medium";
  if (nodesVisited < 4000) return "hard";
  return "expert";
}

// Distinct, saturated per-character colors (token backgrounds, clue-card
// accents) — kept separate from the pale ZONE_COLORS palette in mapEditor.js,
// which needs to stay soft since it fills whole cell backgrounds.
export const CHARACTER_COLORS = [
  "#8a1f2d", "#2b6b4a", "#1f4e79", "#b0813a", "#6b3f8a",
  "#1f7a7a", "#b3541e", "#4a4a63", "#a8456b", "#5c6b1f",
];

// Puzzles saved before this field existed lack `character.color` — fall back
// to the palette instead of sprinkling `|| CHARACTER_COLORS[0]` everywhere.
export function characterColor(character) {
  return character.color || CHARACTER_COLORS[0];
}

export function createPuzzle(title = "Nuovo caso") {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: makeId("puzzle"),
    title,
    author: "",
    difficulty: "",
    completed: false,
    bestTimeSeconds: null,
    briefing: "",
    resolutionNote: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    grid: createGrid(6, 6),
    characters: [],
    clues: [],
    solution: { placements: [] },
  };
}

export function touch(puzzle) {
  puzzle.updatedAt = Date.now();
  return puzzle;
}

export function addCharacter(puzzle, name, iconId, isVictim = false) {
  if (isVictim) {
    for (const c of puzzle.characters) c.isVictim = false;
  }
  const color = CHARACTER_COLORS[puzzle.characters.length % CHARACTER_COLORS.length];
  // gender is null ("non specificato") unless set — clues that filter by it
  // (e.g. "qualcun altro nella stanza era un uomo") simply never match a
  // character whose gender was left unspecified.
  const character = { id: makeId("char"), name, iconId, isVictim, bio: "", color, gender: null };
  puzzle.characters.push(character);
  touch(puzzle);
  return character;
}

export function setVictim(puzzle, characterId) {
  for (const c of puzzle.characters) c.isVictim = c.id === characterId;
  touch(puzzle);
}

export function removeCharacter(puzzle, characterId) {
  puzzle.characters = puzzle.characters.filter((c) => c.id !== characterId);
  puzzle.clues = puzzle.clues.filter(
    (cl) =>
      cl.characterId !== characterId &&
      cl.params?.targetId !== characterId &&
      cl.params?.targetAId !== characterId &&
      cl.params?.targetBId !== characterId
  );
  puzzle.solution.placements = puzzle.solution.placements.filter((p) => p.characterId !== characterId);
  touch(puzzle);
}

export function addClue(puzzle, characterId, type, params = {}) {
  const clue = { id: makeId("clue"), characterId, type, params };
  puzzle.clues.push(clue);
  touch(puzzle);
  return clue;
}

export function updateClue(puzzle, clueId, params) {
  const clue = puzzle.clues.find((c) => c.id === clueId);
  if (!clue) return;
  clue.params = { ...clue.params, ...params };
  touch(puzzle);
}

// A clue can be flipped to its negation without needing a separate registered
// type for every "not X" — see buildPredicate()/describeClue() for how the
// flag is applied. Kept as a top-level clue field (not a param) since it
// applies uniformly to every clue type, positive or already-negative.
export function setClueNegate(puzzle, clueId, negate) {
  const clue = puzzle.clues.find((c) => c.id === clueId);
  if (!clue) return;
  clue.negate = negate;
  touch(puzzle);
}

export function removeClue(puzzle, clueId) {
  puzzle.clues = puzzle.clues.filter((c) => c.id !== clueId);
  touch(puzzle);
}

export function cluesForCharacter(puzzle, characterId) {
  return puzzle.clues.filter((c) => c.characterId === characterId);
}

// Puzzle-wide clues not owned by any character (scene facts like "no one is
// in this room"), as opposed to per-character clues shown on a suspect's card.
export function genericClues(puzzle) {
  return puzzle.clues.filter((c) => c.characterId === null);
}

export function setSolutionPlacement(puzzle, characterId, row, col) {
  const placements = puzzle.solution.placements.filter((p) => p.characterId !== characterId);
  if (row !== null && col !== null) placements.push({ characterId, row, col });
  puzzle.solution.placements = placements;
  touch(puzzle);
}

export function placementFor(puzzle, characterId) {
  return puzzle.solution.placements.find((p) => p.characterId === characterId) || null;
}

// --- Shape validation -------------------------------------------------

// Same bound the editor's own grid-size inputs already clamp to
// (src/editor/mapEditor.js) — enforced here too because that clamp is UI-only
// and never runs on an imported/shared puzzle (editor "Importa", player.html
// ?import=, campaign editor's "aggiungi caso"). Outside this range,
// renderBoard (src/util/boardRender.js) builds one real DOM node per cell
// with no virtualization, so an oversized grid can hang or crash the tab
// well before the solver ever runs.
const MIN_GRID_SIZE = 3;
const MAX_GRID_SIZE = 9;

export function validatePuzzleShape(puzzle) {
  const errors = [];
  if (!puzzle || typeof puzzle !== "object") return { valid: false, errors: ["Il puzzle non è un oggetto valido."] };
  if (!puzzle.grid || !puzzle.grid.size) {
    errors.push("Manca la griglia.");
  } else {
    const { rows, cols } = puzzle.grid.size;
    if (!(rows >= MIN_GRID_SIZE && rows <= MAX_GRID_SIZE) || !(cols >= MIN_GRID_SIZE && cols <= MAX_GRID_SIZE)) {
      errors.push(`Le dimensioni della griglia devono essere comprese tra ${MIN_GRID_SIZE} e ${MAX_GRID_SIZE} (trovato ${rows}×${cols}).`);
    }
  }
  if (!Array.isArray(puzzle.characters)) errors.push("Manca l'elenco personaggi.");
  if (!Array.isArray(puzzle.clues)) errors.push("Manca l'elenco indizi.");
  if (!puzzle.solution || !Array.isArray(puzzle.solution.placements)) errors.push("Manca la soluzione.");

  if (Array.isArray(puzzle.characters)) {
    const ids = new Set();
    let victims = 0;
    for (const c of puzzle.characters) {
      if (ids.has(c.id)) errors.push(`ID personaggio duplicato: ${c.id}`);
      ids.add(c.id);
      if (c.isVictim) victims++;
    }
    if (puzzle.characters.length > 0 && victims !== 1) {
      errors.push(`Deve esserci esattamente una vittima (trovate: ${victims}).`);
    }
    // Mirrors solvePuzzle's own guard (src/solver/solver.js) — one character
    // per row AND per column means more characters than rows/cols can never
    // have a valid solution. Also closes a real bug: board.js's candidate-note
    // grid has exactly 9 fixed slots and silently drops any character past
    // the 9th with no warning, so this keeps that invariant true at the
    // validation boundary instead of relying on the editor's own 3-9 UI
    // clamp (which never runs on an imported puzzle).
    if (puzzle.grid?.size) {
      const { rows, cols } = puzzle.grid.size;
      if (puzzle.characters.length > rows || puzzle.characters.length > cols) {
        errors.push(`Troppi personaggi (${puzzle.characters.length}) per una griglia ${rows}×${cols}: al massimo uno per riga e uno per colonna.`);
      }
    }
  }

  if (puzzle.grid && Array.isArray(puzzle.solution?.placements)) {
    for (const p of puzzle.solution.placements) {
      const inBounds =
        p.row >= 0 && p.row < puzzle.grid.size.rows && p.col >= 0 && p.col < puzzle.grid.size.cols;
      if (!inBounds) {
        errors.push(`Piazzamento fuori griglia per il personaggio ${p.characterId}.`);
      } else if (puzzle.grid.cells[p.row][p.col]?.blocked) {
        errors.push(`Piazzamento su una cella bloccata per il personaggio ${p.characterId}.`);
      } else if (!isOccupiable(puzzle.grid, p.row, p.col)) {
        errors.push(`Piazzamento su una cella con un oggetto non occupabile per il personaggio ${p.characterId}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function clonePuzzle(puzzle) {
  return JSON.parse(JSON.stringify(puzzle));
}

// Deep, independent copy under a new id — for "duplicate this puzzle as a
// starting point for a new one." The original is left completely untouched.
export function duplicatePuzzle(puzzle) {
  const copy = clonePuzzle(puzzle);
  copy.id = makeId("puzzle");
  copy.title = `${puzzle.title} (copia)`;
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  return copy;
}

// Drops any clue whose param references (targetId/targetAId/targetBId/zoneId)
// point at a character/zone/object that no longer exists — e.g. after
// deleting a zone or an object instance a clue was pointing at. Generic
// `objtype:` references are always structurally valid (they name a type, not
// an instance) and are never pruned, even with zero matching instances on the
// map — that's a solver/validator concern (an unsatisfiable clue), not a
// dangling reference. Mirrors the cleanup `removeCharacter` already does for
// its own case, generalized to cover zone/object removal too.
export function pruneDanglingClueReferences(puzzle) {
  const characterIds = new Set(puzzle.characters.map((c) => c.id));
  const zoneIds = new Set(puzzle.grid.zones.map((z) => z.id));
  const objectIds = new Set(puzzle.grid.objects.map((o) => o.id));

  function isKnownReference(id) {
    if (id === undefined || id === null) return true;
    if (isObjectTypeTarget(id)) return true;
    return characterIds.has(id) || zoneIds.has(id) || objectIds.has(id);
  }

  const before = puzzle.clues.length;
  puzzle.clues = puzzle.clues.filter((clue) => {
    const p = clue.params || {};
    return (
      isKnownReference(p.targetId) &&
      isKnownReference(p.targetAId) &&
      isKnownReference(p.targetBId) &&
      isKnownReference(p.zoneId)
    );
  });
  if (puzzle.clues.length !== before) touch(puzzle);
  return puzzle;
}

// Removes any solution placement whose row/col fell outside the grid after a
// shrink (resizeGrid, src/model/grid.js — it has no puzzle reference, so it
// can't clean this up itself). Left unpruned, solutionEditor.js's conflict
// check treats the stale row/col as still occupied, silently blocking that
// whole row/column with no on-board way to clear it (the cell doesn't exist
// anymore to click).
export function pruneDanglingSolutionPlacements(puzzle) {
  const { rows, cols } = puzzle.grid.size;
  const before = puzzle.solution.placements.length;
  puzzle.solution.placements = puzzle.solution.placements.filter(
    (p) => p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols
  );
  if (puzzle.solution.placements.length !== before) touch(puzzle);
  return puzzle;
}
