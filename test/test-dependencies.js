// The claim behind incremental checking (predicates/dependencies.js): a clue's verdict depends ONLY on
// the characters the table names. If that were false the solver would skip a check it needed and
// accept an invalid arrangement. So it is tested directly, on random clues of every type: moving,
// adding or removing a character OUTSIDE the declared set never changes the predicate's result.
import { addClue } from "../src/model/puzzle.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { dependenciesOf } from "../src/solver/predicates/dependencies.js";
import { TYPE_IDS, randomClueSpec, randomPuzzle, rng, contextOf } from "./helpers/random-puzzle.js";
import { CLUE_TYPES } from "../src/model/clueTypes.js";
import { assert, assertEqual } from "./assert.js";

// The tested types: every ordinary type plus orClue built from two ordinary ones.
function randomOrClue(random, ctx) {
  const pool = TYPE_IDS.filter(
    (id) => CLUE_TYPES[id].scope !== "generic" && !(CLUE_TYPES[id].params || []).some((p) => p.name === "property")
  );
  const side = () => {
    const spec = randomClueSpec(random, ctx, pool[Math.floor(random() * pool.length)]);
    return { type: spec.type, params: spec.params, negate: spec.negate };
  };
  return { type: "orClue", owner: ctx.characters[0], params: { a: side(), b: side() }, negate: random() < 0.3 };
}

const results = (predicate, pm) => [predicate(pm, false), predicate(pm, true)];

function checkClue(puzzle, spec, random, counts) {
  const clue = { id: "t", characterId: spec.owner, type: spec.type, params: spec.params, negate: spec.negate };
  const deps = dependenciesOf(clue, puzzle);
  if (deps.all) {
    counts.all++;
    return;
  }
  counts.local++;
  const predicate = buildPredicate(clue, puzzle);
  const { rows, cols } = puzzle.grid.size;
  const cell = () => ({ row: Math.floor(random() * rows), col: Math.floor(random() * cols) });
  const outsiders = puzzle.characters.map((c) => c.id).filter((id) => !deps.ids.has(id));
  for (let round = 0; round < 12; round++) {
    const pm = new Map();
    for (const c of puzzle.characters) if (random() < 0.7) pm.set(c.id, cell());
    for (const id of outsiders) {
      const base = new Map(pm);
      base.delete(id);
      const expected = results(predicate, base);
      for (const variant of [cell(), cell()]) {
        const moved = new Map(base);
        moved.set(id, variant);
        const got = results(predicate, moved);
        assertEqual(
          JSON.stringify(got),
          JSON.stringify(expected),
          `${spec.type}: un personaggio fuori dalle dipendenze ha cambiato il verdetto`
        );
      }
    }
  }
}

export const tests = [
  {
    name: "dipendenze degli indizi: un personaggio fuori dall'insieme dichiarato non cambia mai il verdetto (tutti i tipi, 300 casi)",
    fn: () => {
      const counts = { local: 0, all: 0 };
      const typesSeen = new Set();
      for (let seed = 1; seed <= 300; seed++) {
        const puzzle = randomPuzzle(seed, { maxClues: 0 });
        const ctx = contextOf(puzzle);
        const random = rng(seed * 7919);
        const type = TYPE_IDS[seed % TYPE_IDS.length];
        const spec = seed % 11 === 0 ? randomOrClue(random, ctx) : randomClueSpec(random, ctx, type);
        typesSeen.add(spec.type);
        checkClue(puzzle, spec, random, counts);
      }
      assert(counts.local > 60 && counts.all > 60, `serve un mix di indizi locali e globali (${counts.local}/${counts.all})`);
      assert(typesSeen.size >= TYPE_IDS.length - 2, `quasi tutti i tipi devono comparire (${typesSeen.size}/${TYPE_IDS.length})`);
    },
  },
  {
    name: "dipendenze degli indizi: un tipo ignoto o sconosciuto è sempre «controllalo sempre» (mai saltato)",
    fn: () => {
      const puzzle = randomPuzzle(1, { maxClues: 0 });
      const owner = puzzle.characters[0].id;
      assertEqual(dependenciesOf({ id: "x", type: "tipoCheNonEsiste", characterId: owner, params: {} }, puzzle).all, true);
      assertEqual(dependenciesOf({ id: null, type: "victimRoomRule", characterId: null, params: {} }, puzzle).all, true);
      assertEqual(dependenciesOf({ id: "x", type: "aloneInRoom", characterId: owner, params: {} }, puzzle).all, true);
    },
  },
  {
    name: "dipendenze degli indizi: un indizio locale dipende da titolare e personaggi citati, e orClue dall'unione dei due rami",
    fn: () => {
      const puzzle = randomPuzzle(3, { maxClues: 0 });
      const [a, b, c] = puzzle.characters.map((x) => x.id);
      const adj = dependenciesOf({ id: "1", type: "adjacent", characterId: a, params: { targetId: b } }, puzzle);
      assertEqual([...adj.ids].sort().join(), [a, b].sort().join());
      const obj = dependenciesOf({ id: "2", type: "adjacent", characterId: a, params: { targetId: puzzle.grid.objects[0].id } }, puzzle);
      assertEqual([...obj.ids].join(), a, "un oggetto come bersaglio non è un personaggio");
      const or = dependenciesOf(
        {
          id: "3",
          type: "orClue",
          characterId: a,
          params: { a: { type: "adjacent", params: { targetId: b } }, b: { type: "sameRoomAs", params: { targetId: c } } },
        },
        puzzle
      );
      assertEqual([...or.ids].sort().join(), [a, b, c].sort().join());
      const orAll = dependenciesOf(
        {
          id: "4",
          type: "orClue",
          characterId: a,
          params: { a: { type: "adjacent", params: { targetId: b } }, b: { type: "aloneInRoom", params: {} } },
        },
        puzzle
      );
      assertEqual(orAll.all, true, "se un ramo guarda tutti, l'OR guarda tutti");
      assert(addClue, "import usato");
    },
  },
];
