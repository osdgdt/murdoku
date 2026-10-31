import { encodePuzzleToFragment, decodePuzzleFromFragment } from "../src/storage/shareLink.js";
import { createPuzzle, addCharacter, setSolutionPlacement } from "../src/model/puzzle.js";
import { resizeGrid } from "../src/model/grid.js";
import { assert, assertEqual } from "./assert.js";

function puzzle() {
  const p = createPuzzle("Condiviso <b>& co</b>");
  p.grid = resizeGrid(p.grid, 3, 3);
  const a = addCharacter(p, "Anna", "person1", true);
  const b = addCharacter(p, "Bruno", "person2");
  setSolutionPlacement(p, a.id, 0, 0);
  setSolutionPlacement(p, b.id, 1, 1);
  return p;
}

async function rejects(promise) {
  try { await promise; } catch (e) { return e; }
  return null;
}

export const tests = [
  {
    name: "shareLink: un puzzle sopravvive a codifica/decodifica identico",
    fn: async () => {
      const original = puzzle();
      const fragment = await encodePuzzleToFragment(original);
      assert(fragment.startsWith("case="));
      assert(/^[A-Za-z0-9_=-]+$/.test(fragment), "il frammento deve essere sicuro per un URL");
      const decoded = await decodePuzzleFromFragment("#" + fragment);
      assertEqual(JSON.stringify(decoded), JSON.stringify(original));
    },
  },
  {
    name: "shareLink: un frammento senza caso condiviso restituisce null",
    fn: async () => {
      assertEqual(await decodePuzzleFromFragment(""), null);
      assertEqual(await decodePuzzleFromFragment("#altro=1"), null);
    },
  },
  {
    name: "shareLink: payload corrotto o non-JSON viene rifiutato con un errore leggibile",
    fn: async () => {
      assert(await rejects(decodePuzzleFromFragment("#case=@@@non-base64@@@")), "base64 non valido");
      assert(await rejects(decodePuzzleFromFragment("#case=AAAA")), "deflate non valido");
    },
  },
  {
    name: "shareLink: un puzzle decodificato ma non valido (colore malevolo) viene rifiutato",
    fn: async () => {
      const bad = puzzle();
      bad.characters[0].color = "red;background:url(//evil)";
      const err = await rejects(decodePuzzleFromFragment("#" + (await encodePuzzleToFragment(bad))));
      assert(err, "atteso un rifiuto");
    },
  },
  {
    name: "shareLink: una decompression bomb oltre il limite viene fermata",
    fn: async () => {
      const huge = puzzle();
      huge.briefing = "a".repeat(3 * 1024 * 1024);
      const err = await rejects(decodePuzzleFromFragment("#" + (await encodePuzzleToFragment(huge))));
      assert(err, "atteso un rifiuto per dimensione");
    },
  },
];
