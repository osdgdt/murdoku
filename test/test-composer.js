import { proposeClueSet, composeClues, rng, withoutVictim, BANNED_TYPES } from "../src/solver/composer.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { suggestClues, declaredPlacementMap } from "../src/solver/suggestions.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const load = async (name) => JSON.parse(await readRepoFile(`test/fixtures/${name}.murdoku.json`));
const asClues = (list) => list.map((c, i) => ({ id: `n${i}`, ...c }));

export const tests = [
  {
    name: "generatore: per ogni livello propone indizi che rendono unica la soluzione dichiarata (casi di prova, senza i loro indizi)",
    fn: async () => {
      for (const name of ["faro.en", "tutorial.en"]) {
        for (const mode of ["easy", "medium", "hard"]) {
          const puzzle = await load(name);
          puzzle.clues = [];
          const result = proposeClueSet(puzzle, { mode, seed: 7, keepExisting: false, timeMs: 20000 });
          assertEqual(result.status, "ok", `${name} ${mode}: ${result.reason}`);
          puzzle.clues = asClues(result.clues);
          const check = checkUniqueness(puzzle, { maxSolutions: 2, forwardCheck: true });
          assert(check.solutionCount === 1 && check.exhausted, `${name} ${mode}: la soluzione deve essere unica`);
        }
      }
    },
  },
  {
    name: "generatore: il set proposto dà un caso del livello chiesto secondo il solver umano (o dice quale livello è)",
    fn: async () => {
      for (const name of ["faro.en", "monastero.en"]) {
        for (const mode of ["easy", "medium", "hard"]) {
          const puzzle = await load(name);
          puzzle.clues = [];
          const result = proposeClueSet(puzzle, { mode, seed: 5, keepExisting: false, timeMs: 30000 });
          assertEqual(result.status, "ok", `${name} ${mode}`);
          assertEqual(result.requested, mode);
          const human = humanSolve(Object.assign(puzzle, { clues: asClues(result.clues) }));
          assertEqual(human.status, "solved", `${name} ${mode}: risolvibile dal solver umano`);
          if (result.exact) assertEqual(human.level, mode, `${name} ${mode}: «exact» vuol dire proprio quel livello`);
          assertEqual(result.level, human.level, `${name} ${mode}: il livello dichiarato è quello vero`);
        }
      }
    },
  },
  {
    name: "generatore: un livello fuori portata dà comunque un set, dichiarato come di un altro livello",
    fn: async () => {
      const puzzle = await load("tutorial.en");
      puzzle.clues = [];
      const result = proposeClueSet(puzzle, { mode: "expert", seed: 1, keepExisting: false, timeMs: 20000 });
      assertEqual(result.status, "ok");
      assertEqual(result.exact, false);
      assert(result.level !== "expert", "il livello vero non è quello chiesto");
    },
  },
  {
    name: "generatore: stesso seme, stessi indizi; un altro seme può dare un altro insieme",
    fn: async () => {
      const puzzle = await load("faro.en");
      puzzle.clues = [];
      const a = proposeClueSet(puzzle, { mode: "medium", seed: 3, keepExisting: false });
      const b = proposeClueSet(puzzle, { mode: "medium", seed: 3, keepExisting: false });
      assertEqual(JSON.stringify(a.clues), JSON.stringify(b.clues), "deve essere riproducibile");
      const others = new Set();
      for (const seed of [1, 2, 3, 4, 5, 6])
        others.add(JSON.stringify(proposeClueSet(puzzle, { mode: "medium", seed, keepExisting: false }).clues));
      assert(others.size > 1, "semi diversi devono dare insiemi diversi");
    },
  },
  {
    name: "generatore: nessun indizio sulla vittima e mai «più vicino a… che a…», per ogni seme",
    fn: async () => {
      const puzzle = await load("faro.en");
      puzzle.clues = [];
      const victim = puzzle.characters.find((c) => c.isVictim).id;
      for (let seed = 1; seed <= 8; seed++) {
        const result = proposeClueSet(puzzle, { mode: "hard", seed, keepExisting: false });
        assertEqual(result.status, "ok");
        for (const clue of result.clues) {
          assert(
            clue.characterId !== victim && !JSON.stringify(clue.params).includes(victim),
            `seme ${seed}: un indizio riguarda la vittima`
          );
          assert(!BANNED_TYPES.has(clue.type), `seme ${seed}: tipo vietato ${clue.type}`);
        }
      }
    },
  },
  {
    name: "generatore: con «parti dagli indizi che ho già» li conserva e aggiunge solo quel che serve; se è già unico non aggiunge nulla",
    fn: async () => {
      const puzzle = await load("faro.en");
      const already = proposeClueSet(puzzle, { mode: "medium", seed: 1, keepExisting: true });
      assertEqual(already.status, "ok");
      assertEqual(already.clues.length, 0, "il caso è già unico: niente da aggiungere");
      puzzle.clues = puzzle.clues.slice(0, 2);
      const result = proposeClueSet(puzzle, { mode: "medium", seed: 1, keepExisting: true });
      assertEqual(result.status, "ok");
      const all = asClues([
        ...puzzle.clues.map(({ type, characterId, params, negate }) => ({ type, characterId, params, negate })),
        ...result.clues,
      ]);
      puzzle.clues = all;
      const check = checkUniqueness(puzzle, { maxSolutions: 2, forwardCheck: true });
      assert(check.solutionCount === 1 && check.exhausted, "con gli indizi vecchi e nuovi la soluzione è unica");
    },
  },
  {
    name: "generatore: l'avanzamento è tra 0 e 1 e non torna indietro, ascoltarlo non cambia gli indizi, e senza limiti (tempo e nodi) si ottiene lo stesso insieme",
    fn: async () => {
      const puzzle = await load("faro.en");
      puzzle.clues = [];
      const plain = proposeClueSet(puzzle, { mode: "medium", seed: 5, keepExisting: false });
      const seen = [];
      const heard = proposeClueSet(puzzle, { mode: "medium", seed: 5, keepExisting: false, onProgress: (f) => seen.push(f) });
      assertEqual(JSON.stringify(heard.clues), JSON.stringify(plain.clues), "ascoltare l'avanzamento non cambia gli indizi");
      assert(seen.length > 5, `segnala più volte (${seen.length})`);
      assert(
        seen.every((v, i) => v >= 0 && v <= 1 && (i === 0 || v >= seen[i - 1])),
        "tra 0 e 1, mai all'indietro"
      );
      assert(seen[seen.length - 1] > 0.9, `a lavoro finito è vicino a 1 (${seen[seen.length - 1]})`);
      const free = proposeClueSet(puzzle, { mode: "medium", seed: 5, keepExisting: false, timeMs: null, maxNodes: Infinity });
      assertEqual(free.status, "ok", "senza limiti il generatore lavora comunque (nessuna scadenza nulla scambiata per «tempo scaduto»)");
      assertEqual(JSON.stringify(free.clues), JSON.stringify(plain.clues), "e con lo stesso seme dà lo stesso insieme");
    },
  },
  {
    name: "generatore: senza soluzione completa dichiarata, o senza tempo, dice perché non può",
    fn: async () => {
      const puzzle = await load("tutorial.en");
      puzzle.solution.placements = puzzle.solution.placements.slice(0, 2);
      assertEqual(proposeClueSet(puzzle, {}).reason, "no-solution");
      const full = await load("monastero.en");
      full.clues = [];
      assertEqual(proposeClueSet(full, { keepExisting: false, timeMs: 0 }).reason, "time");
    },
  },
  {
    name: "generatore: il nucleo condiviso con la libreria resta quello di prima (seme → stessi numeri, vittima esclusa dalla vista)",
    fn: async () => {
      const a = rng(5);
      const b = rng(5);
      assertEqual([a(), a(), a()].join(), [b(), b(), b()].join());
      const puzzle = await load("faro.en");
      const view = withoutVictim(puzzle);
      assertEqual(view.characters.length, puzzle.characters.length - 1);
      assertEqual(view.solution.placements.length, puzzle.solution.placements.length - 1);
      const pm = declaredPlacementMap(puzzle);
      const { clues } = suggestClues(view, new Map([...pm].filter(([id]) => view.characters.some((c) => c.id === id))), {
        ownerId: view.characters[0].id,
      });
      view.clues = [];
      const picked = composeClues(view, clues, { random: rng(2), allowType: () => true, negateChance: 0, fixed: [], maxClues: 40 });
      assert(picked === null || picked.length > 0);
    },
  },
];
