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

const isNode = !!globalThis.process?.versions?.node;
async function loadText(rel) {
  if (isNode) {
    const { readFile } = await import("node:fs/promises");
    return readFile(new URL(`../${rel}`, import.meta.url), "utf8");
  }
  return (await fetch(new URL(`../${rel}`, import.meta.url))).text();
}
const PAGES = [
  "index.html",
  "player.html",
  "editor.html",
  "print.html",
  "glossary.html",
  "tutorial.html",
  "privacy.html",
  "achievements.html",
  "campaign.html",
  "campaign-editor.html",
];

export const tests = [
  {
    name: "ogni pagina HTML ha la stessa Content-Security-Policy (niente object, base e form esterni)",
    fn: async () => {
      if (isNode) {
        const { readdir } = await import("node:fs/promises");
        const onDisk = (await readdir(new URL("../", import.meta.url))).filter((f) => f.endsWith(".html")).sort();
        assertEqual(JSON.stringify(onDisk), JSON.stringify([...PAGES].sort()), "elenco delle pagine: aggiorna PAGES se ne aggiungi una");
      }
      const policies = new Set();
      for (const page of PAGES) {
        const matches = [...(await loadText(page)).matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)];
        assertEqual(matches.length, 1, `${page}: una sola CSP`);
        policies.add(matches[0][1]);
      }
      assertEqual(policies.size, 1, "la CSP è identica in tutte le pagine");
      const [policy] = policies;
      for (const rule of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) {
        assert(policy.includes(rule), `la CSP deve contenere ${rule}`);
      }
    },
  },
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
      puzzle.title = '<b>Caso</b> & "altro"';
      assert(validatePuzzleShape(puzzle).valid);
    },
  },
];
