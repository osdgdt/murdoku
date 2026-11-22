// «Esattamente N persone sono accanto a…» (peopleNear): un numero qualsiasi di persone, accanto a un bersaglio qualunque del tipo
// («un tavolo») o sempre allo stesso.
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid } from "../src/model/grid.js";
import { objectTypeTargetId } from "../src/model/icons.js";
import { CLUE_TYPES, describeClue } from "../src/model/clueTypes.js";
import { missingParams, defaultParams } from "../src/editor/clueDraft.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { dependenciesOf } from "../src/solver/predicates/dependencies.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { assert, assertEqual } from "./assert.js";

// 5×5 in una sola stanza, due tavoli (1,1) e (3,3), quattro persone
function scene() {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 5, 5);
  const room = addZone(puzzle.grid, "Sala", "#eee");
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) paintCellZone(puzzle.grid, r, c, room.id);
  const t1 = placeObject(puzzle.grid, "table", 1, 1);
  const t2 = placeObject(puzzle.grid, "table", 3, 3);
  const people = ["A", "B", "C", "D"].map((n, i) => addCharacter(puzzle, n, "person1", i === 3));
  return { puzzle, t1, t2, people };
}
const at = (entries) => new Map(entries.map(([c, row, col]) => [c.id, { row, col }]));

export const tests = [
  {
    name: "peopleNear: il tipo esiste, è generale e si compila con i valori di partenza",
    fn: () => {
      const def = CLUE_TYPES.peopleNear;
      assert(def && def.scope === "generic", "tipo generale");
      const { puzzle } = scene();
      const params = defaultParams("peopleNear", puzzle);
      assertEqual(params.count, 1);
      assertEqual(params.together, "any");
      assertEqual(missingParams({ type: "peopleNear", params: { ...params, targetId: objectTypeTargetId("table") } }).length, 0);
      assertEqual(missingParams({ type: "peopleNear", params }).length, 1, "manca il bersaglio");
    },
  },
  {
    name: "peopleNear: le frasi dicono quante persone e se sono accanto allo stesso bersaglio",
    fn: () => {
      const { puzzle } = scene();
      const target = objectTypeTargetId("table");
      const say = (params, negate = false) => {
        const clue = addClue(puzzle, null, "peopleNear", params);
        clue.negate = negate;
        return describeClue(clue, puzzle);
      };
      assertEqual(say({ count: 2, targetId: target, together: "any" }), "Esattamente 2 persone sono accanto a un tavolo.");
      assertEqual(
        say({ count: 2, targetId: target, together: "same" }),
        "Esattamente 2 persone sono accanto a un tavolo, sempre lo stesso."
      );
      assertEqual(say({ count: 1, targetId: target, together: "same" }), "Esattamente una persona è accanto a un tavolo.");
      assertEqual(say({ count: 2, targetId: target, together: "any" }, true), "Non ci sono esattamente 2 persone accanto a un tavolo.");
    },
  },
  {
    name: "peopleNear «qualsiasi»: conta le persone accanto a un tavolo qualunque, anche diverso; falso appena sono troppe",
    fn: () => {
      const { puzzle, people } = scene();
      const [a, b, c] = people;
      const clue = addClue(puzzle, null, "peopleNear", { count: 2, targetId: objectTypeTargetId("table"), together: "any" });
      const predicate = buildPredicate(clue, puzzle);
      // A accanto al primo tavolo, B accanto al secondo: sono due, anche se tavoli diversi
      assertEqual(
        predicate(
          at([
            [a, 0, 1],
            [b, 3, 4],
          ]),
          true
        ),
        true,
        "due persone, tavoli diversi"
      );
      assertEqual(predicate(at([[a, 0, 1]]), false), undefined, "una sola per ora: può ancora arrivare un'altra");
      assertEqual(
        predicate(
          at([
            [a, 0, 1],
            [b, 3, 4],
            [c, 2, 3],
          ]),
          false
        ),
        false,
        "già tre: troppe, non può tornare indietro"
      );
      assertEqual(
        predicate(
          at([
            [a, 0, 1],
            [b, 4, 0],
          ]),
          true
        ),
        false,
        "a fine disposizione una sola: no"
      );
    },
  },
  {
    name: "peopleNear «lo stesso»: due persone accanto allo stesso tavolo, non una per tavolo",
    fn: () => {
      const { puzzle, people } = scene();
      const [a, b, c] = people;
      const clue = addClue(puzzle, null, "peopleNear", { count: 2, targetId: objectTypeTargetId("table"), together: "same" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(
        predicate(
          at([
            [a, 0, 1],
            [b, 1, 2],
          ]),
          true
        ),
        true,
        "N e E del tavolo (1,1)"
      );
      assertEqual(
        predicate(
          at([
            [a, 0, 1],
            [b, 3, 4],
          ]),
          true
        ),
        false,
        "una per tavolo: non è «lo stesso»"
      );
      assertEqual(
        predicate(
          at([
            [a, 0, 1],
            [b, 1, 2],
            [c, 3, 4],
          ]),
          true
        ),
        true,
        "due al primo tavolo, una al secondo: il primo ne ha esattamente due"
      );
      assertEqual(predicate(at([[a, 0, 1]]), false), undefined, "per ora uno solo");
    },
  },
  {
    name: "peopleNear: senza tavoli sulla mappa non è mai vero; non dipende da pochi personaggi (si ricontrolla sempre)",
    fn: () => {
      const { puzzle, people } = scene();
      const clue = addClue(puzzle, null, "peopleNear", { count: 2, targetId: objectTypeTargetId("window"), together: "any" });
      assertEqual(buildPredicate(clue, puzzle)(at([[people[0], 0, 0]]), true), false);
      assert(dependenciesOf(clue, puzzle).all === true, "dipende da tutti i personaggi");
    },
  },
  {
    name: "peopleNear: il solver umano e la ricerca esatta danno lo stesso verdetto (qualsiasi e «lo stesso»)",
    fn: () => {
      for (const together of ["any", "same"]) {
        for (const count of [1, 2]) {
          const puzzle = createPuzzle("Piccolo");
          puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
          const left = addZone(puzzle.grid, "Sinistra", "#eee");
          const right = addZone(puzzle.grid, "Destra", "#ddd");
          for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, c < 2 ? left.id : right.id);
          placeObject(puzzle.grid, "table", 1, 1);
          placeObject(puzzle.grid, "table", 2, 3);
          const a = addCharacter(puzzle, "A", "person1");
          const b = addCharacter(puzzle, "B", "person2");
          addCharacter(puzzle, "C", "person1");
          addCharacter(puzzle, "D", "person2", true);
          addClue(puzzle, null, "peopleNear", { count, targetId: objectTypeTargetId("table"), together });
          addClue(puzzle, a.id, "inRoom", { zoneId: left.id });
          addClue(puzzle, b.id, "inRoom", { zoneId: right.id });
          const exact = solvePuzzle(puzzle, { maxSolutions: 3 });
          const result = humanSolve(puzzle);
          const expected = exact.length === 0 ? "contradiction" : exact.length === 1 ? "solved" : "ambiguous";
          assertEqual(result.status, expected, `${together} ${count}: ${exact.length} soluzioni`);
          if (expected === "solved") {
            for (const p of exact[0]) {
              assertEqual(result.placements.get(p.characterId).row, p.row, `${together} ${count} riga`);
              assertEqual(result.placements.get(p.characterId).col, p.col, `${together} ${count} colonna`);
            }
          }
        }
      }
    },
  },
];
