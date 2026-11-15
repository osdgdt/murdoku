import { makeId } from "../util/id.js";
import { createGrid, isOccupiable } from "./grid.js";
import { isObjectTypeTarget } from "./icons.js";
import { dropUnknownFromLists } from "./clueRefs.js";
import { isSafeId, isSafeColor } from "../util/safe.js";

import { CURRENT_SCHEMA_VERSION, schemaVersionOf } from "./migrations.js";
import { t } from "../i18n/i18n.js";
import { TENSES, DEFAULT_TENSE, isTense } from "../i18n/tense.js";

export const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

export const DIFFICULTY_LEVELS = [
  { value: "", label: t("Non specificata") },
  { value: "very-easy", label: t("Molto facile") },
  { value: "easy", label: t("Facile") },
  { value: "medium", label: t("Media") },
  { value: "hard", label: t("Difficile") },
  { value: "expert", label: t("Esperto") },
];

// The verb tense every clue of a case is written in (one choice for the whole
// case, so the wording never mixes "è" and "era"). See i18n/tense.js.
export const TENSE_OPTIONS = [
  { value: "present", label: t("Presente (è accanto a…)") },
  { value: "past", label: t("Passato (era accanto a…)") },
  { value: "future", label: t("Futuro (sarà accanto a…)") },
];

export function setTense(puzzle, tense) {
  puzzle.tense = isTense(tense) ? tense : DEFAULT_TENSE;
  touch(puzzle);
}

export function difficultyLabel(value) {
  return DIFFICULTY_LEVELS.find((d) => d.value === value)?.label || DIFFICULTY_LEVELS[0].label;
}

// Rough, informational-only estimate of how hard a case is — never overwrites the author's own rating.
//
// It starts from how many characters plain deduction pins down by itself (`forced` of `total`, from
// solver/propagation.js), the yardstick the library's difficulty levels are built on (solver/composer.js MODES), with
// rounder cut-offs: all of them = easy, at least half = medium, some = hard, none = expert (a small cast that is fully
// forced is "very easy"). It is a rough signal, not a measurement: generated cases of one level spread over
// neighbouring estimates.
// The cost of the search (`nodes`) can only RAISE the level: since the solver prunes with unary domains and
// forward checking, a hard case is typically settled in a handful of nodes, so the node count alone says almost
// nothing (measured on generated cases: 49 of 55 looked "very easy", hard ones included). A heavy search still
// means a hard case, whatever propagation says.
const LEVEL_ORDER = ["very-easy", "easy", "medium", "hard", "expert"];
export function estimateDifficulty({ forced, total, nodes = 0 }) {
  let level;
  if (!(total > 0)) level = "very-easy";
  else if (forced >= total) level = total <= 5 ? "very-easy" : "easy";
  else if (forced * 2 >= total) level = "medium";
  else if (forced > 0) level = "hard";
  else level = "expert";
  const byNodes = nodes >= 4000 ? "expert" : nodes >= 800 ? "hard" : level;
  return LEVEL_ORDER[Math.max(LEVEL_ORDER.indexOf(level), LEVEL_ORDER.indexOf(byNodes))];
}

// Distinct, saturated per-character colors (token backgrounds, clue-card
// accents) — kept separate from the pale ZONE_COLORS palette in mapEditor.js,
// which needs to stay soft since it fills whole cell backgrounds.
//
// Chosen to stay tellable-apart under the common kinds of colour-blindness
// (protanopia, deuteranopia, tritanopia): the palette was searched for the
// largest minimum CIEDE2000 distance — also against the victim's danger red —
// inside a luminance band that keeps >=3:1 contrast with white token text and
// with both the light and dark cell backgrounds (tools/find-palette.mjs,
// checked by test/test-palette.js). The order matters: any prefix of it is
// also well separated, so small casts (the common case) get the most distinct
// colours. The first 10 are the original palette (minimum ΔE ≥ 8, never
// changed: saved cases keep their colours); the last 6, for the 11th to 16th
// character of a big grid, are the most distinct ones that still fit the band
// (minimum ΔE ≈ 5.7, a lower bar the test states). Colour is never the ONLY cue
// anyway — tokens carry a distinct icon, and candidate marks sit in a fixed
// slot per character (and carry the initial where the cell is big enough).
export const CHARACTER_COLORS = [
  "#608aea",
  "#ea558a",
  "#158060",
  "#9f5595",
  "#bf8020",
  "#4a6aca",
  "#9f80b5",
  "#6a9560",
  "#2b9f95",
  "#9f6a0b",
  // 11th to 16th (found with `node tools/find-palette.mjs --extend 16`)
  "#cc3c4d",
  "#b35e6f",
  "#5e7744",
  "#8077c4",
  "#809944",
  "#448877",
];

// Puzzles saved before this field existed lack `character.color` — fall back
// to the palette instead of sprinkling `|| CHARACTER_COLORS[0]` everywhere.
export function characterColor(character) {
  return character.color || CHARACTER_COLORS[0];
}

export function createPuzzle(title = t("Nuovo caso")) {
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
    tense: DEFAULT_TENSE,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    grid: createGrid(6, 6),
    characters: [],
    clues: [],
    solution: { placements: [] },
    manualHints: [],
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

// Longest character name the editor accepts (it is shown on chips, in clues and on the board).
export const MAX_CHARACTER_NAME = 40;

export function cleanCharacterName(name) {
  return String(name ?? "")
    .trim()
    .slice(0, MAX_CHARACTER_NAME)
    .trim();
}

// Whether another character (not `exceptId`) already has this name, ignoring case.
export function characterNameTaken(puzzle, name, exceptId = null) {
  const wanted = cleanCharacterName(name).toLowerCase();
  return puzzle.characters.some((c) => c.id !== exceptId && String(c.name).trim().toLowerCase() === wanted);
}

// Gives a character a new name. Only the name changes: the id (which clues, the solution
// and the players' notes refer to), colour, icon and role stay as they are, and every
// sentence is written from the name when it is shown. Free text written by the author
// (briefing, notes, bios) does not follow a rename. Returns "ok", or why nothing changed:
// "unknown" (no such character), "blank", "duplicate" (another character has that name).
export function renameCharacter(puzzle, characterId, name) {
  const character = puzzle.characters.find((c) => c.id === characterId);
  if (!character) return "unknown";
  const clean = cleanCharacterName(name);
  if (!clean) return "blank";
  if (characterNameTaken(puzzle, clean, characterId)) return "duplicate";
  character.name = clean;
  touch(puzzle);
  return "ok";
}

export function setVictim(puzzle, characterId) {
  for (const c of puzzle.characters) c.isVictim = c.id === characterId;
  touch(puzzle);
}

export function removeCharacter(puzzle, characterId) {
  puzzle.characters = puzzle.characters.filter((c) => c.id !== characterId);
  // The clues OF this character go, and those that point at them (a target, in a list of targets, or in a
  // nested "either/or" / "who also…" clue); the others only lose them from their lists where one remains.
  puzzle.clues = puzzle.clues.filter((cl) => {
    if (cl.characterId === characterId) return false;
    cl.params = cl.params || {};
    return !dropUnknownFromLists(cl.params, (id) => id !== characterId);
  });
  puzzle.solution.placements = puzzle.solution.placements.filter((p) => p.characterId !== characterId);
  // Un passo di suggerimento manuale che evidenziava questo personaggio perde
  // solo l'evidenziazione (characterId/row/col), non l'intero passo: il testo
  // scritto dall'autore resta prezioso anche orfano di bersaglio.
  for (const step of puzzle.manualHints || []) {
    if (step.characterId === characterId) {
      step.characterId = null;
      step.row = null;
      step.col = null;
    }
  }
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

// Replaces the type, parameters and negation of a clue, keeping its id and its owner and its
// place in the list (what editing a clue in the clue wizard does).
export function replaceClue(puzzle, clueId, { type, params, negate }) {
  const clue = puzzle.clues.find((c) => c.id === clueId);
  if (!clue) return false;
  clue.type = type;
  clue.params = JSON.parse(JSON.stringify(params || {}));
  if (negate) clue.negate = true;
  else delete clue.negate;
  touch(puzzle);
  return true;
}

// A copy of a clue, right after it, with a new id. Returns the copy (or null).
export function duplicateClue(puzzle, clueId) {
  const index = puzzle.clues.findIndex((c) => c.id === clueId);
  if (index === -1) return null;
  const copy = JSON.parse(JSON.stringify(puzzle.clues[index]));
  copy.id = makeId("clue");
  puzzle.clues.splice(index + 1, 0, copy);
  touch(puzzle);
  return copy;
}

// Moves a clue one place up (-1) or down (+1) among the clues of the same owner (a character, or
// the general ones). Returns whether it moved.
export function moveClue(puzzle, clueId, delta) {
  const index = puzzle.clues.findIndex((c) => c.id === clueId);
  if (index === -1) return false;
  const owner = puzzle.clues[index].characterId;
  const step = delta < 0 ? -1 : 1;
  for (let i = index + step; i >= 0 && i < puzzle.clues.length; i += step) {
    if (puzzle.clues[i].characterId === owner) {
      [puzzle.clues[index], puzzle.clues[i]] = [puzzle.clues[i], puzzle.clues[index]];
      touch(puzzle);
      return true;
    }
  }
  return false;
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

// Clues a campaign still keeps hidden from the player (see applyClueLocks in
// campaign/campaignModel.js): runtime-only placeholders { id, characterId, byLabel }
// in `puzzle.lockedClues` — never part of a saved or exported case.
export function lockedCluesFor(puzzle, characterId) {
  return (puzzle.lockedClues || []).filter((l) => l.characterId === characterId);
}

export function setSolutionPlacement(puzzle, characterId, row, col) {
  const placements = puzzle.solution.placements.filter((p) => p.characterId !== characterId);
  if (row !== null && col !== null) placements.push({ characterId, row, col });
  puzzle.solution.placements = placements;
  touch(puzzle);
}

// Takes a character out of the declared solution (the author may leave it incomplete and
// let the clues derive it). Returns whether the character was placed.
export function removeSolutionPlacement(puzzle, characterId) {
  if (!puzzle.solution.placements.some((p) => p.characterId === characterId)) return false;
  setSolutionPlacement(puzzle, characterId, null, null);
  return true;
}

export function placementFor(puzzle, characterId) {
  return puzzle.solution.placements.find((p) => p.characterId === characterId) || null;
}

// --- Shape validation -------------------------------------------------

// Same bound the editor's own grid-size inputs already clamp to
// (src/editor/mapEditor.js; 16 is also the most characters a case can have:
// one per row and column, and the player's note grid has 16 slots) — enforced
// here too because that clamp is UI-only
// and never runs on an imported/shared puzzle (editor "Importa", player.html
// ?import=, campaign editor's "aggiungi caso"). Outside this range,
// renderBoard (src/util/boardRender.js) builds one real DOM node per cell
// with no virtualization, so an oversized grid can hang or crash the tab
// well before the solver ever runs.
const MIN_GRID_SIZE = 3;
const MAX_GRID_SIZE = 16;

// Everything below is about *safety*, not game rules: ids and colors from an
// imported puzzle flow into attributes, URLs and inline styles, so anything
// that isn't a plain id / hex color is rejected here, once, instead of
// trusting every render site to escape. Absent optional fields stay valid.
function validateUntrustedStrings(puzzle, errors) {
  const badId = (what, value) => {
    if (value !== undefined && value !== null && !isSafeId(value)) errors.push(t("ID non valido ({what}).", { what }));
  };
  const badColor = (what, value) => {
    if (value !== undefined && value !== null && !isSafeColor(value)) errors.push(t("Colore non valido ({what}).", { what }));
  };
  badId("puzzle", puzzle.id);
  if (puzzle.tense !== undefined && !TENSES.includes(puzzle.tense)) errors.push(t("Il tempo verbale degli indizi non è valido."));
  for (const field of ["title", "author", "briefing", "resolutionNote"]) {
    if (puzzle[field] !== undefined && typeof puzzle[field] !== "string")
      errors.push(t('Il campo "{field}" deve essere testo.', { field }));
  }
  for (const c of Array.isArray(puzzle.characters) ? puzzle.characters : []) {
    if (!c || typeof c !== "object") {
      errors.push(t("Personaggio non valido."));
      continue;
    }
    badId("personaggio", c.id);
    badColor("personaggio", c.color);
    if (typeof c.name !== "string") errors.push(t("Il nome di un personaggio deve essere testo."));
  }
  for (const z of Array.isArray(puzzle.grid?.zones) ? puzzle.grid.zones : []) {
    if (!z || typeof z !== "object") {
      errors.push(t("Zona non valida."));
      continue;
    }
    badId("zona", z.id);
    badColor("zona", z.color);
  }
  for (const o of Array.isArray(puzzle.grid?.objects) ? puzzle.grid.objects : []) {
    if (!o || typeof o !== "object") {
      errors.push(t("Oggetto non valido."));
      continue;
    }
    badId("oggetto", o.id);
  }
  for (const cl of Array.isArray(puzzle.clues) ? puzzle.clues : []) {
    if (!cl || typeof cl !== "object") {
      errors.push(t("Indizio non valido."));
      continue;
    }
    badId("indizio", cl.id);
  }
  const cells = puzzle.grid?.cells;
  const size = puzzle.grid?.size;
  if (
    size &&
    (!Array.isArray(cells) ||
      cells.length !== size.rows ||
      cells.some((row) => !Array.isArray(row) || row.length !== size.cols || row.some((cell) => !cell || typeof cell !== "object")))
  ) {
    errors.push(t("Le celle della griglia non corrispondono alle sue dimensioni."));
  }
}

export function validatePuzzleShape(puzzle) {
  const errors = [];
  if (!puzzle || typeof puzzle !== "object") return { valid: false, errors: [t("Il puzzle non è un oggetto valido.")] };
  if (!puzzle.grid || !puzzle.grid.size) {
    errors.push(t("Manca la griglia."));
  } else {
    const { rows, cols } = puzzle.grid.size;
    if (!(rows >= MIN_GRID_SIZE && rows <= MAX_GRID_SIZE) || !(cols >= MIN_GRID_SIZE && cols <= MAX_GRID_SIZE)) {
      errors.push(
        t("Le dimensioni della griglia devono essere comprese tra {MIN_GRID_SIZE} e {MAX_GRID_SIZE} (trovato {rows}×{cols}).", {
          MIN_GRID_SIZE,
          MAX_GRID_SIZE,
          rows,
          cols,
        })
      );
    }
  }
  if (schemaVersionOf(puzzle) > SCHEMA_VERSION) {
    errors.push(
      t("Questo caso è stato creato con una versione più recente di Murdoku (formato {schemaVersion}): aggiorna la pagina e riprova.", {
        schemaVersion: puzzle.schemaVersion,
      })
    );
  }
  validateUntrustedStrings(puzzle, errors);
  if (!Array.isArray(puzzle.characters)) errors.push(t("Manca l'elenco personaggi."));
  if (!Array.isArray(puzzle.clues)) errors.push(t("Manca l'elenco indizi."));
  if (!puzzle.solution || !Array.isArray(puzzle.solution.placements)) errors.push(t("Manca la soluzione."));

  if (Array.isArray(puzzle.characters)) {
    const ids = new Set();
    let victims = 0;
    for (const c of puzzle.characters) {
      if (ids.has(c.id)) errors.push(t("ID personaggio duplicato: {id}", { id: c.id }));
      ids.add(c.id);
      if (c.isVictim) victims++;
    }
    if (puzzle.characters.length > 0 && victims !== 1) {
      errors.push(t("Deve esserci esattamente una vittima (trovate: {victims}).", { victims }));
    }
    // Mirrors solvePuzzle's own guard (src/solver/solver.js) — one character
    // per row AND per column means more characters than rows/cols can never
    // have a valid solution. It also keeps the player's note grid (a 3x3 or
    // 4x4 box of fixed slots, see player/boardView.js) able to show every
    // character, at the validation boundary instead of relying on the editor's
    // own 3-16 UI clamp (which never runs on an imported puzzle).
    if (puzzle.grid?.size) {
      const { rows, cols } = puzzle.grid.size;
      if (puzzle.characters.length > rows || puzzle.characters.length > cols) {
        errors.push(
          t("Troppi personaggi ({length}) per una griglia {rows}×{cols}: al massimo uno per riga e uno per colonna.", {
            length: puzzle.characters.length,
            rows,
            cols,
          })
        );
      }
    }
  }

  if (puzzle.grid && Array.isArray(puzzle.solution?.placements)) {
    for (const p of puzzle.solution.placements) {
      const inBounds = p.row >= 0 && p.row < puzzle.grid.size.rows && p.col >= 0 && p.col < puzzle.grid.size.cols;
      if (!inBounds) {
        errors.push(t("Piazzamento fuori griglia per il personaggio {characterId}.", { characterId: p.characterId }));
      } else if (puzzle.grid.cells[p.row][p.col]?.blocked) {
        errors.push(t("Piazzamento su una cella bloccata per il personaggio {characterId}.", { characterId: p.characterId }));
      } else if (!isOccupiable(puzzle.grid, p.row, p.col)) {
        errors.push(
          t("Piazzamento su una cella con un oggetto non occupabile per il personaggio {characterId}.", { characterId: p.characterId })
        );
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
  copy.title = t("{title} (copia)", { title: puzzle.title });
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
    if (isObjectTypeTarget(id)) return true;
    return characterIds.has(id) || zoneIds.has(id) || objectIds.has(id);
  }

  // A parameter that was never chosen ("") is an incomplete clue (flagged in the editor), not a
  // dangling one, so only ids that are SET are checked. The walk goes into nested clues and into
  // lists of targets (a list just loses the ids that are gone; a clue whose list ends up empty, or
  // that still names something unknown, is dropped).
  const before = puzzle.clues.length;
  puzzle.clues = puzzle.clues.filter((clue) => {
    clue.params = clue.params || {};
    return !dropUnknownFromLists(clue.params, (id) => id === undefined || id === null || id === "" || isKnownReference(id));
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
  puzzle.solution.placements = puzzle.solution.placements.filter((p) => p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols);
  if (puzzle.solution.placements.length !== before) touch(puzzle);
  return puzzle;
}

// --- Suggerimenti scritti a mano -------------------------------------

// Un passo = un messaggio dell'autore + un'evidenziazione opzionale
// (characterId+row+col, sempre impostati insieme o tutti null: mai a metà).
// Quando puzzle.manualHints ha almeno un passo, il gioco mostra SOLO questa
// sequenza al posto del motore automatico (vedi gameScreen.js's onHint()).
export function addManualHintStep(puzzle, message = "") {
  const step = { id: makeId("hint"), message, characterId: null, row: null, col: null };
  puzzle.manualHints = puzzle.manualHints || [];
  puzzle.manualHints.push(step);
  touch(puzzle);
  return step;
}

export function updateManualHintStep(puzzle, stepId, patch) {
  const step = (puzzle.manualHints || []).find((s) => s.id === stepId);
  if (!step) return;
  Object.assign(step, patch);
  touch(puzzle);
}

export function removeManualHintStep(puzzle, stepId) {
  puzzle.manualHints = (puzzle.manualHints || []).filter((s) => s.id !== stepId);
  touch(puzzle);
}

export function reorderManualHintSteps(puzzle, fromIndex, toIndex) {
  const steps = puzzle.manualHints || [];
  if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex >= steps.length) return;
  const [moved] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, moved);
  touch(puzzle);
}
