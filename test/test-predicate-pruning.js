// A predicate may answer `false` on a half-built board only if NO way of finishing the board can make it true
// (the search throws that branch away, and a wrong `false` would lose real solutions). This checks it exhaustively on
// small random cases for the clue types whose early answers were strengthened: for every legal complete placement
// (one person per row and column) and every partial view of it, a partial `false` means the complete one is not `true`.
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone, placeObject, isOccupiable, cellAt } from "../src/model/grid.js";
import { isObjectTypeSeat } from "../src/model/icons.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { rng } from "./helpers/random-puzzle.js";
import { assert } from "./assert.js";

function smallPuzzle(seed) {
  const random = rng(seed);
  const puzzle = createPuzzle(`pruning ${seed}`);
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const zones = ["A", "B", "C"].map((name) => addZone(puzzle.grid, name, "#fff"));
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) if (random() < 0.85) paintCellZone(puzzle.grid, r, c, zones[Math.floor(random() * 3)].id);
  for (const type of ["stool", "stool", "chair", "table"])
    placeObject(puzzle.grid, type, Math.floor(random() * 4), Math.floor(random() * 4));
  const people = [0, 1, 2].map((i) => {
    const c = addCharacter(puzzle, `P${i}`, undefined, i === 2);
    c.gender = random() < 0.5 ? "male" : "female";
    return c;
  });
  return { puzzle, people, zones, random };
}

// every complete placement with one person per row and column, on cells a person can stand on
function completePlacements(puzzle, people) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (isOccupiable(puzzle.grid, r, c)) cells.push({ row: r, col: c });
  const all = [];
  for (const a of cells)
    for (const b of cells) {
      if (b.row === a.row || b.col === a.col) continue;
      for (const c of cells) {
        if (c.row === a.row || c.col === a.col || c.row === b.row || c.col === b.col) continue;
        all.push([a, b, c]);
      }
    }
  return all.map((cellsOf) => new Map(people.map((p, i) => [p.id, cellsOf[i]])));
}

// What a clue means on a COMPLETE board, written from its description and independent of the solver's predicates, so the
// check below also catches a predicate that is wrong in the same way on half-built and finished boards.
function zoneOfPerson(puzzle, pos) {
  return cellAt(puzzle.grid, pos.row, pos.col)?.zoneId ?? null;
}
function hasProperty(puzzle, person, pos, params) {
  const cell = cellAt(puzzle.grid, pos.row, pos.col);
  const obj = cell?.objectId ? puzzle.grid.objects.find((o) => o.id === cell.objectId) : null;
  if (params.property === "male" || params.property === "female") return person.gender === params.property;
  if (params.property === "sittingOn") return !!obj && obj.typeId === params.objectTypeId;
  return !!obj && isObjectTypeSeat(obj.typeId); // "seated"
}
const REFERENCE = {
  someoneInRoomWithProperty: (puzzle, people, full, clue) => {
    const owner = clue.characterId;
    const zone = zoneOfPerson(puzzle, full.get(owner));
    if (zone === null) return false;
    return people.some(
      (p) => p.id !== owner && zoneOfPerson(puzzle, full.get(p.id)) === zone && hasProperty(puzzle, p, full.get(p.id), clue.params)
    );
  },
  aloneWithPersonProperty: (puzzle, people, full, clue) => {
    const owner = clue.characterId;
    const zone = zoneOfPerson(puzzle, full.get(owner));
    if (zone === null) return false;
    const inRoom = people.filter((p) => p.id !== owner && zoneOfPerson(puzzle, full.get(p.id)) === zone);
    return inRoom.length === 1 && hasProperty(puzzle, inRoom[0], full.get(inRoom[0].id), clue.params);
  },
  emptyRoomsSameSize: (puzzle, people, full, clue) => {
    const used = new Set(people.map((p) => zoneOfPerson(puzzle, full.get(p.id))));
    const empty = puzzle.grid.zones.filter((z) => !used.has(z.id));
    const size = (z) => puzzle.grid.cells.flat().filter((cell) => cell.zoneId === z.id).length;
    return empty.length === clue.params.count && new Set(empty.map(size)).size <= 1;
  },
  sameRoomSizeAs: (puzzle, people, full, clue) => {
    const za = zoneOfPerson(puzzle, full.get(clue.params.targetAId));
    const zb = zoneOfPerson(puzzle, full.get(clue.params.targetBId));
    if (za === null || zb === null) return false;
    const size = (id) => puzzle.grid.cells.flat().filter((cell) => cell.zoneId === id).length;
    return size(za) === size(zb);
  },
};

function checkClue(seed, label, build) {
  const { puzzle, people, zones, random } = smallPuzzle(seed);
  const clue = build(puzzle, people, zones, random);
  const predicate = buildPredicate(clue, puzzle);
  let pruned = 0;
  for (const full of completePlacements(puzzle, people)) {
    const complete = predicate(full, true);
    const meaning = REFERENCE[clue.type](puzzle, people, full, clue);
    assert(
      complete === (clue.negate ? !meaning : meaning),
      `${label} (caso ${seed}${clue.negate ? ", negato" : ""}): su una scheda completa il verdetto non è quello della definizione`
    );
    for (let mask = 0; mask < 7; mask++) {
      // the people whose bit is set are placed, the others are still to place
      const partial = new Map(people.flatMap((p, i) => (mask & (1 << i) ? [[p.id, full.get(p.id)]] : [])));
      if (predicate(partial, false) === false) {
        pruned++;
        assert(
          complete !== true,
          `${label} (caso ${seed}${clue.negate ? ", negato" : ""}): un parziale scartato ha un completamento valido`
        );
      }
    }
  }
  return pruned;
}

const PROPERTIES = [
  { property: "male" },
  { property: "female" },
  { property: "sittingOn", objectTypeId: "stool" },
  { property: "sittingOn", objectTypeId: "chair" },
  { property: "seated" },
];

function propertyCase(type) {
  return () => {
    let pruned = 0;
    for (const [i, params] of PROPERTIES.entries()) {
      for (let seed = 1; seed <= 12; seed++) {
        for (const negate of [false, true]) {
          pruned += checkClue(seed * 10 + i, `${type} ${params.property}`, (puzzle, people) => {
            const clue = addClue(puzzle, people[0].id, type, { ...params });
            if (negate) clue.negate = true;
            return clue;
          });
        }
      }
    }
    assert(pruned > 0, `${type}: la potatura deve scattare almeno qualche volta`);
  };
}

export const tests = [
  {
    name: "potature: someoneInRoomWithProperty scarta un parziale solo se nessun completamento lo rende vero (esaustivo, anche negato)",
    fn: propertyCase("someoneInRoomWithProperty"),
  },
  {
    name: "potature: aloneWithPersonProperty scarta un parziale solo se nessun completamento lo rende vero (esaustivo, anche negato)",
    fn: propertyCase("aloneWithPersonProperty"),
  },
  {
    name: "potature: emptyRoomsSameSize e sameRoomSizeAs scartano un parziale solo se nessun completamento lo rende vero (esaustivo)",
    fn: () => {
      for (let seed = 1; seed <= 12; seed++) {
        for (const count of [1, 2, 3]) {
          checkClue(seed, `emptyRoomsSameSize ${count}`, (puzzle) => addClue(puzzle, null, "emptyRoomsSameSize", { count }));
        }
        checkClue(seed, "sameRoomSizeAs", (puzzle, people) =>
          addClue(puzzle, null, "sameRoomSizeAs", { targetAId: people[0].id, targetBId: people[1].id })
        );
      }
    },
  },
];
