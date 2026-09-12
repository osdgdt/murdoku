import { createPuzzle, addCharacter, addClue, setClueNegate, setSolutionPlacement } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { deriveSolution } from "../src/solver/deriveSolution.js";
import { assert, assertEqual } from "./assert.js";

function basePuzzle(rows, cols) {
  const puzzle = createPuzzle("Test deriveSolution");
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  return puzzle;
}

// A pinned to (0,0) via a single-cell zone, B pinned to (1,1) via another —
// no character marked as victim, so the always-on "victim alone in a room"
// base rule (predicates.js's victimRoomRulePredicate) stays vacuously true
// (it returns undefined with no victim present) and can't interfere.
function uniquelySolvablePuzzle() {
  const puzzle = basePuzzle(3, 3);
  const a = addCharacter(puzzle, "A", "person1");
  const b = addCharacter(puzzle, "B", "person2");
  const zoneA = addZone(puzzle.grid, "Zona A", "#eee");
  paintCellZone(puzzle.grid, 0, 0, zoneA.id);
  const zoneB = addZone(puzzle.grid, "Zona B", "#ddd");
  paintCellZone(puzzle.grid, 1, 1, zoneB.id);
  addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id });
  addClue(puzzle, b.id, "inRoom", { zoneId: zoneB.id });
  return { puzzle, a, b };
}

export const tests = [
  {
    name: "deriveSolution: status \"unique\" quando esiste esattamente una soluzione, dimostrata in modo esaustivo",
    fn: () => {
      const { puzzle, a, b } = uniquelySolvablePuzzle();
      const result = deriveSolution(puzzle);
      assertEqual(result.status, "unique");
      const posA = result.placements.find((p) => p.characterId === a.id);
      const posB = result.placements.find((p) => p.characterId === b.id);
      assertEqual(posA.row, 0);
      assertEqual(posA.col, 0);
      assertEqual(posB.row, 1);
      assertEqual(posB.col, 1);
    },
  },
  {
    name: "deriveSolution: status \"unsatisfiable\" quando gli indizi sono contraddittori",
    fn: () => {
      const puzzle = basePuzzle(2, 2);
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Sala", "#eee");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      paintCellZone(puzzle.grid, 1, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id); // l'intera griglia è un'unica stanza
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const negated = addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      setClueNegate(puzzle, negated.id, true); // "non si trova nella Sala" — ma A è SEMPRE nella Sala, qualunque cella scelga
      const result = deriveSolution(puzzle);
      assertEqual(result.status, "unsatisfiable");
      assertEqual(result.placements, null);
    },
  },
  {
    name: "deriveSolution: status \"ambiguous\" quando vengono trovate 2 o più soluzioni",
    fn: () => {
      // 2x2, 2 personaggi, nessun indizio: esattamente 4 soluzioni possibili
      // (stesso fixture già provato in test-solver.js's "checkUniqueness con
      // maxSolutions sufficiente...").
      const puzzle = basePuzzle(2, 2);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const result = deriveSolution(puzzle);
      assertEqual(result.status, "ambiguous");
      assertEqual(result.placements, null);
    },
  },
  {
    name: "deriveSolution: status \"inconclusive\" quando il budget di nodi si esaurisce prima di poter dimostrare 0 o esattamente 1 soluzione",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person3");
      const result = deriveSolution(puzzle, { maxNodes: 2 });
      assertEqual(result.status, "inconclusive");
      assertEqual(result.placements, null);
    },
  },
  {
    name: "deriveSolution non guarda mai puzzle.solution: la soluzione derivata riflette gli indizi anche quando la soluzione salvata è sbagliata",
    fn: () => {
      const { puzzle, a } = uniquelySolvablePuzzle();
      setSolutionPlacement(puzzle, a.id, 1, 0); // deliberatamente sbagliata: A può stare solo in (0,0)
      const result = deriveSolution(puzzle);
      assertEqual(result.status, "unique");
      const posA = result.placements.find((p) => p.characterId === a.id);
      assertEqual(posA.row, 0, "la soluzione derivata deve venire dagli indizi, non dalla soluzione salvata (sbagliata)");
      assertEqual(posA.col, 0);
    },
  },
  {
    name: "deriveSolution: \"unsatisfiable\" dimostrata dalla sola propagazione upfront, zero nodi di ricerca",
    fn: () => {
      // Stesso fixture del test "unsatisfiable" sopra: dimostrabile da
      // propagate() da solo (nessun ragionamento incrociato tra personaggi
      // necessario). maxNodes:0 vieta OGNI nodo di backtracking — se il
      // risultato dipendesse dalla ricerca, tornerebbe "inconclusive"
      // (nodeCapHit/truncated), non un verdetto definitivo.
      const puzzle = basePuzzle(2, 2);
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Sala", "#eee");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      paintCellZone(puzzle.grid, 1, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const negated = addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      setClueNegate(puzzle, negated.id, true);
      const result = deriveSolution(puzzle, { maxNodes: 0 });
      assertEqual(result.status, "unsatisfiable", "la contraddizione deve emergere dalla sola propagazione upfront, senza alcuna ricerca");
      assertEqual(result.placements, null);
    },
  },
  {
    name: "deriveSolution: \"unique\" determinata dalla sola propagazione upfront, ricerca residua nulla",
    fn: () => {
      // uniquelySolvablePuzzle: A e B sono entrambi fissati da propagate()
      // stesso (zone a una sola cella), quindi finiscono entrambi in
      // fixedPlacements — nessuna cella viene mai enumerata liberamente.
      // Ogni personaggio "fixed" costa comunque esattamente 1 nodo (vedi
      // solver.js: il ramo `fixed` incrementa nodesVisited prima di
      // procedere) quindi characters.length+1 è il budget ESATTO minimo
      // che lascia passare solo quei nodi "gratuiti" — un vero backtracking
      // su un personaggio libero ne richiederebbe molti di più. Se il
      // risultato dipendesse da una ricerca reale, un budget così risicato
      // tornerebbe "inconclusive" (nodeCapHit/truncated), non un verdetto
      // definitivo.
      const { puzzle, a, b } = uniquelySolvablePuzzle();
      const result = deriveSolution(puzzle, { maxNodes: puzzle.characters.length + 1 });
      assertEqual(result.status, "unique");
      const posA = result.placements.find((p) => p.characterId === a.id);
      const posB = result.placements.find((p) => p.characterId === b.id);
      assertEqual(posA.row, 0);
      assertEqual(posA.col, 0);
      assertEqual(posB.row, 1);
      assertEqual(posB.col, 1);
    },
  },
];
