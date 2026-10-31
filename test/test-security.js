import { createPuzzle, addCharacter, validatePuzzleShape, setSolutionPlacement } from "../src/model/puzzle.js";
import { resizeGrid, addZone } from "../src/model/grid.js";
import { isSafeId, isSafeColor, escapeHtml } from "../src/util/safe.js";
import { assert, assertEqual } from "./assert.js";

function validPuzzle() {
  const puzzle = createPuzzle("Sicurezza");
  puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
  const a = addCharacter(puzzle, "Anna", "person1", true);
  const b = addCharacter(puzzle, "Bruno", "person2", false);
  setSolutionPlacement(puzzle, a.id, 0, 0);
  setSolutionPlacement(puzzle, b.id, 1, 1);
  return puzzle;
}

export const tests = [
  {
    name: "isSafeId accetta gli id generati da makeId e rifiuta markup/virgolette/spazi",
    fn: () => {
      assert(isSafeId("puzzle_abc123"));
      assert(isSafeId("char-1"));
      assert(!isSafeId('x" onmouseover="alert(1)'));
      assert(!isSafeId("<img src=x>"));
      assert(!isSafeId(""));
      assert(!isSafeId(42));
    },
  },
  {
    name: "isSafeColor accetta solo colori esadecimali, non dichiarazioni CSS arbitrarie",
    fn: () => {
      assert(isSafeColor("#fff"));
      assert(isSafeColor("#f4c2c2"));
      assert(!isSafeColor("red"));
      assert(!isSafeColor("#fff;background:url(//evil.example/x)"));
      assert(!isSafeColor("url(javascript:alert(1))"));
    },
  },
  {
    name: "escapeHtml neutralizza i caratteri speciali",
    fn: () => {
      assertEqual(escapeHtml('<img src=x onerror="a()">'), "&lt;img src=x onerror=&quot;a()&quot;&gt;");
    },
  },
  {
    name: "validatePuzzleShape rifiuta un id di personaggio con markup",
    fn: () => {
      const puzzle = validPuzzle();
      puzzle.characters[1].id = '"><script>alert(1)</script>';
      assert(!validatePuzzleShape(puzzle).valid);
    },
  },
  {
    name: "validatePuzzleShape rifiuta un colore di zona o personaggio non esadecimale",
    fn: () => {
      const puzzle = validPuzzle();
      puzzle.grid.zones.push({ ...addZone(puzzle.grid, "Cucina", "#fff"), color: "red;background:url(//evil)" });
      assert(!validatePuzzleShape(puzzle).valid, "zona con colore malevolo");
      const puzzle2 = validPuzzle();
      puzzle2.characters[0].color = "expression(alert(1))";
      assert(!validatePuzzleShape(puzzle2).valid, "personaggio con colore malevolo");
    },
  },
  {
    name: "validatePuzzleShape rifiuta titolo non testuale e celle non coerenti con la griglia",
    fn: () => {
      const puzzle = validPuzzle();
      puzzle.title = { toString: "x" };
      assert(!validatePuzzleShape(puzzle).valid, "titolo oggetto");
      const puzzle2 = validPuzzle();
      puzzle2.grid.cells.pop();
      assert(!validatePuzzleShape(puzzle2).valid, "celle mancanti");
    },
  },
  {
    name: "un puzzle valido con un titolo pieno di markup resta valido (il titolo è solo testo, non è un problema di forma)",
    fn: () => {
      const puzzle = validPuzzle();
      puzzle.title = "<b>Caso</b> & \"altro\"";
      assert(validatePuzzleShape(puzzle).valid);
    },
  },
];
