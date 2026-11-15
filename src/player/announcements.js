// What the player board SAYS, in words, for screen-reader users: how a cell reads out (who is there, a cross,
// the notes, the furniture) and what to announce after a move (compare the board before and after). Pure: the
// board state and the puzzle in, sentences out, so it can be tested without a page.
import { objectIcon, sideLabel } from "../model/icons.js";
import { edgeObjectsAt } from "../model/grid.js";
import { key } from "./board.js";
import { t } from "../i18n/i18n.js";

const nameOf = (puzzle, id) => puzzle.characters.find((c) => c.id === id)?.name ?? "";

// "Anna, victim", "cross", "notes: Anna, Bruno", "chair", "door (Est side)": what is in a cell, as a
// list of phrases (empty for an empty cell).
export function describeCellContent(puzzle, state, row, col) {
  const parts = [];
  const cell = puzzle.grid.cells[row]?.[col];
  if (!cell || cell.blocked) return parts;
  const occupant = [...state.placements].find(([, pos]) => pos.row === row && pos.col === col);
  if (occupant) {
    const character = puzzle.characters.find((c) => c.id === occupant[0]);
    if (character) parts.push(character.name + (character.isVictim ? t(" (vittima)") : "") + t(" piazzato"));
  } else if (state.xMarks.has(key(row, col))) {
    parts.push(t("segnata con una X"));
  } else {
    const notes = state.candidates.get(key(row, col));
    if (notes && notes.size > 0) {
      const names = puzzle.characters.filter((c) => notes.has(c.id)).map((c) => c.name);
      if (names.length > 0) parts.push(t("note: {names}", { names: names.join(", ") }));
    }
  }
  if (cell.objectId) {
    const object = puzzle.grid.objects.find((o) => o.id === cell.objectId);
    const def = object && objectIcon(object.typeId);
    if (def) parts.push(def.label);
  }
  for (const piece of edgeObjectsAt(puzzle.grid, row, col)) {
    const def = objectIcon(piece.typeId);
    if (def) parts.push(t("{label} (lato {side})", { label: def.label, side: sideLabel(piece.side || "N") }));
  }
  return parts;
}

// The label of a cell for a screen reader: its place and room (`base`, from the board renderer), then what is in it.
export function cellAriaLabel(base, puzzle, state, row, col) {
  const parts = describeCellContent(puzzle, state, row, col);
  return parts.length > 0 ? `${base}: ${parts.join(", ")}` : `${base}: ${t("vuota")}`;
}

// A copy of the parts of the board a move can change, to compare before and after.
export function snapshotBoard(state) {
  return {
    placements: new Map([...state.placements].map(([id, pos]) => [id, { row: pos.row, col: pos.col }])),
    xMarks: new Set(state.xMarks),
    candidates: new Map([...state.candidates].map(([k, set]) => [k, new Set(set)])),
    lineNotes: new Map([...state.lineNotes].map(([k, set]) => [k, new Set(set)])),
  };
}

const place = (row, col) => t("riga {row}, colonna {col}", { row: row + 1, col: col + 1 });
const parseKey = (k) => k.split(",").map(Number);

// One sentence for what changed between two snapshots, or "" when nothing worth saying did.
// Several changes at once (a drag, "clear all", an undo of many cells) become a count, not a list.
export function describeBoardChange(puzzle, before, after) {
  const said = [];
  for (const [id, pos] of after.placements) {
    const was = before.placements.get(id);
    if (!was) said.push(t("{name} piazzato in {place}", { name: nameOf(puzzle, id), place: place(pos.row, pos.col) }));
    else if (was.row !== pos.row || was.col !== pos.col)
      said.push(t("{name} spostato in {place}", { name: nameOf(puzzle, id), place: place(pos.row, pos.col) }));
  }
  for (const [id] of before.placements) {
    if (!after.placements.has(id)) said.push(t("{name} tolto dalla griglia", { name: nameOf(puzzle, id) }));
  }
  if (said.length > 0) return said.length === 1 ? said[0] : t("{count} personaggi modificati", { count: said.length });

  // crosses
  const crossesAdded = [...after.xMarks].filter((k) => !before.xMarks.has(k));
  const crossesGone = [...before.xMarks].filter((k) => !after.xMarks.has(k));
  // notes (cell level): compare every cell, name what was added or taken off
  const noteChanges = [];
  const cells = new Set([...before.candidates.keys(), ...after.candidates.keys()]);
  for (const k of cells) {
    const a = after.candidates.get(k) ?? new Set();
    const b = before.candidates.get(k) ?? new Set();
    for (const id of a) if (!b.has(id)) noteChanges.push({ k, id, added: true });
    for (const id of b) if (!a.has(id)) noteChanges.push({ k, id, added: false });
  }
  const total = crossesAdded.length + crossesGone.length + noteChanges.length;
  if (total === 0) {
    const lines = new Set([...before.lineNotes.keys(), ...after.lineNotes.keys()]);
    for (const k of lines) {
      const a = after.lineNotes.get(k) ?? new Set();
      const b = before.lineNotes.get(k) ?? new Set();
      if (a.size !== b.size || [...a].some((id) => !b.has(id))) return t("Nota su una riga o colonna aggiornata");
    }
    return "";
  }
  if (total > 1) return t("{count} caselle modificate", { count: total });
  if (crossesAdded.length === 1) {
    const [r, c] = parseKey(crossesAdded[0]);
    return t("X segnata in {place}", { place: place(r, c) });
  }
  if (crossesGone.length === 1) {
    const [r, c] = parseKey(crossesGone[0]);
    return t("X tolta da {place}", { place: place(r, c) });
  }
  const change = noteChanges[0];
  const [r, c] = parseKey(change.k);
  return change.added
    ? t("Nota {name} aggiunta in {place}", { name: nameOf(puzzle, change.id), place: place(r, c) })
    : t("Nota {name} tolta da {place}", { name: nameOf(puzzle, change.id), place: place(r, c) });
}

// "Anna selected. 3 clues: …" — what a character's clues say, for when the tool changes.
export function describeSelection(puzzle, character, clueTexts) {
  if (clueTexts.length === 0) return t("{name} selezionato. Nessun indizio.", { name: character.name });
  return t("{name} selezionato. Indizi: {clues}", { name: character.name, clues: clueTexts.join(" ") });
}
