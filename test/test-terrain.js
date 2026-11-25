// Mare e terra (Pirati): la stanza dice cos'è (Acqua, nave, terra), gli indizi «in mare / a terra» e «su una nave»,
// la validazione (l'Acqua è una sola), i nuovi oggetti del mare.
import { createPuzzle, addCharacter, addClue, validatePuzzleShape } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { describeClue, CLUE_TYPES } from "../src/model/clueTypes.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { resolveClueHoverCells } from "../src/solver/hoverTargets.js";
import { isObjectTypeOccupiable, objectCategoryTargetId, objectTypeIdsOf, OBJECT_TYPES } from "../src/model/icons.js";
import { setZoneTerrain, terrainOf, isSeaZone, hasTerrain, zoneTitle, terrainProblems } from "../src/model/terrain.js";
import { assert, assertEqual } from "./assert.js";

// 4×4: l'Acqua (righe 0-1, a sinistra), un Veliero (righe 0-1, a destra) e la Spiaggia (righe 2-3). V è la vittima.
function scene() {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const water = addZone(puzzle.grid, "Acqua", "#cde");
  const ship = addZone(puzzle.grid, "Veliero", "#fec");
  const beach = addZone(puzzle.grid, "Spiaggia", "#efc");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, (r >= 2 ? beach : c < 2 ? water : ship).id);
  setZoneTerrain(puzzle.grid, water.id, "water");
  setZoneTerrain(puzzle.grid, ship.id, "ship");
  const people = [addCharacter(puzzle, "V", "person1", true), addCharacter(puzzle, "A", "person2"), addCharacter(puzzle, "B", "person3")];
  return { puzzle, people, water, ship, beach };
}
const at = (entries) => new Map(entries.map(([c, row, col]) => [c.id, { row, col }]));
const roomOf = (r, c) => (r >= 2 ? "beach" : c < 2 ? "water" : "ship");

export const tests = [
  {
    name: "terreno: una stanza è Acqua, nave o terra (nulla = terra); togliere il terreno toglie il campo",
    fn: () => {
      const { puzzle, water, ship, beach } = scene();
      assertEqual(terrainOf(water), "water");
      assertEqual(terrainOf(ship), "ship");
      assertEqual(terrainOf(beach), "land");
      assert(isSeaZone(water) && isSeaZone(ship) && !isSeaZone(beach), "mare = Acqua o nave");
      assert(hasTerrain(puzzle.grid));
      assert(!("terrain" in beach), "la terra non ha il campo");
      assert(setZoneTerrain(puzzle.grid, water.id, "land") && !("terrain" in water), "terra = nessun campo");
      assert(!setZoneTerrain(puzzle.grid, "non-esiste", "ship"));
      assertEqual(zoneTitle(ship), "⚓ Veliero");
      setZoneTerrain(puzzle.grid, water.id, "water");
      assertEqual(zoneTitle(water), "≈ Acqua");
      assertEqual(zoneTitle(beach), "Spiaggia");
    },
  },
  {
    name: "terreno: l'Acqua è un'area unica (due stanze Acqua è un errore) e un terreno sconosciuto non è valido",
    fn: () => {
      const { puzzle, ship } = scene();
      puzzle.solution = { placements: [] };
      assertEqual(terrainProblems(puzzle).length, 0);
      assert(!validatePuzzleShape(puzzle).errors.some((e) => /acqua|terreno/i.test(e)), "il caso di partenza è valido");
      setZoneTerrain(puzzle.grid, ship.id, "water");
      assert(terrainProblems(puzzle).length > 0, "due stanze Acqua");
      assert(validatePuzzleShape(puzzle).errors.length > 0, "e il caso non passa");
      setZoneTerrain(puzzle.grid, ship.id, "ship");
      ship.terrain = "lava";
      assert(terrainProblems(puzzle).length > 0, "terreno sconosciuto");
      assert(validatePuzzleShape(puzzle).errors.length > 0);
    },
  },
  {
    name: "terreno: «in mare» vale per l'Acqua e per le navi, «a terra» è il contrario; «su una nave» solo per le navi",
    fn: () => {
      const { puzzle, people } = scene();
      const a = people[1];
      const inSea = addClue(puzzle, a.id, "inSea", {});
      const onShip = addClue(puzzle, a.id, "onShip", {});
      const sea = (pos) => buildPredicate(inSea, puzzle)(pos, false);
      const ship = (pos) => buildPredicate(onShip, puzzle)(pos, false);
      assertEqual(sea(new Map()), undefined, "non ancora in gioco");
      assertEqual(sea(at([[a, 0, 0]])), true, "Acqua");
      assertEqual(sea(at([[a, 0, 3]])), true, "nave");
      assertEqual(sea(at([[a, 3, 0]])), false, "spiaggia");
      assertEqual(ship(at([[a, 0, 0]])), false, "l'Acqua non è una nave");
      assertEqual(ship(at([[a, 0, 3]])), true);
      assertEqual(ship(at([[a, 3, 3]])), false);
      assertEqual(describeClue(inSea, puzzle), "È in mare.");
      assertEqual(describeClue(onShip, puzzle), "È su una nave.");
      inSea.negate = true;
      assertEqual(describeClue(inSea, puzzle), "È a terra.");
      assertEqual(sea(at([[a, 3, 0]])), true, "a terra");
      assertEqual(sea(at([[a, 0, 0]])), false);
      onShip.negate = true;
      assertEqual(describeClue(onShip, puzzle), "Non è su una nave.");
      assertEqual(ship(at([[a, 0, 3]])), false);
      assert(CLUE_TYPES.inSea && CLUE_TYPES.onShip);
    },
  },
  {
    name: "terreno: il solver conta le stesse soluzioni della forza bruta con «in mare» e «a terra»",
    fn: () => {
      const { puzzle, people } = scene();
      const [, a, b] = people;
      addClue(puzzle, a.id, "inSea", {});
      addClue(puzzle, b.id, "inSea", {}).negate = true; // B è a terra
      let expected = 0;
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push([r, c]);
      for (const v of cells)
        for (const pa of cells)
          for (const pb of cells) {
            const chosen = [v, pa, pb];
            if (new Set(chosen.map(([r]) => r)).size < 3 || new Set(chosen.map(([, c]) => c)).size < 3) continue;
            const room = chosen.map(([r, c]) => roomOf(r, c));
            if (room.filter((x, i) => i > 0 && x === room[0]).length !== 1) continue; // la vittima ha un solo compagno di stanza
            if (room[1] === "beach" || room[2] !== "beach") continue; // A in mare, B a terra
            expected++;
          }
      assert(expected > 0, "il caso di prova ha soluzioni");
      const report = checkUniqueness(puzzle, { maxSolutions: 100000 });
      assert(report.exhausted);
      assertEqual(report.solutionCount, expected, "stesso numero di soluzioni");
    },
  },
  {
    name: "terreno: passando il mouse sull'indizio si vedono le caselle del mare, o solo quelle delle navi",
    fn: () => {
      const { puzzle, people } = scene();
      const cells = (type) => resolveClueHoverCells({ type, characterId: people[1].id, params: {} }, puzzle, new Map()).length;
      assertEqual(cells("inSea"), 8, "Acqua + nave: 8 caselle");
      assertEqual(cells("onShip"), 4, "la nave: 4 caselle");
    },
  },
  {
    name: "mare: zattera, amaca e sabbia si occupano; cassa, maiale, squalo, masso, corda e cannone ingombrano; maiale e squalo sono animali",
    fn: () => {
      for (const id of ["raft", "hammock", "sand"]) assert(isObjectTypeOccupiable(id), `${id} si occupa`);
      for (const id of ["crate", "pig", "shark", "rock", "rope", "cannon"]) assert(!isObjectTypeOccupiable(id), `${id} ingombra`);
      for (const id of ["raft", "hammock", "sand", "crate", "pig", "shark", "rock", "rope", "cannon"]) {
        assert(OBJECT_TYPES[id], `${id} esiste`);
      }
      const animals = objectTypeIdsOf(objectCategoryTargetId("animal"));
      assert(animals.includes("pig") && animals.includes("shark"), "maiale e squalo sono animali");
    },
  },
];
