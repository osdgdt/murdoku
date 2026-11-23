// The human solver (src/solver/techniques): it must only ever rule out what is impossible (checked against the exact
// reference search on random cases), say which reasonings a case needs, and respect the ceiling it is given.
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { TECHNIQUES, LEVELS, levelIndex, levelOfTechnique, techniquesUpTo } from "../src/solver/techniques/catalog.js";
import { referenceSolutions } from "./reference-solver.js";
import { randomPuzzle } from "./helpers/random-puzzle.js";
import { uniqueCase, placementsOf } from "./helpers/unique-case.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const load = async (path) => JSON.parse(await readRepoFile(path));

function tinyPuzzle(size) {
  const puzzle = createPuzzle("tiny");
  puzzle.grid = resizeGrid(puzzle.grid, size, size);
  return puzzle;
}

export const tests = [
  {
    name: "solver umano: set di indizi che una persona risolve con la logica (e che prima uscivano «Esperto» per ipotesi) ora hanno il livello giusto, con le soluzioni giuste",
    fn: async () => {
      const fixtures = JSON.parse(await readRepoFile("test/fixtures/false-expert.json"));
      const seen = new Set();
      for (const { name, level, hardest, puzzle } of fixtures) {
        const result = humanSolve(puzzle, { maxWork: 5e6 });
        assertEqual(result.status, "solved", name);
        assert(result.level !== "expert", `${name}: non deve più andare per ipotesi (${result.hardest})`);
        assertEqual(result.level, level, `${name}: livello`);
        assertEqual(result.hardest, hardest, `${name}: ragionamento più difficile`);
        for (const p of puzzle.solution.placements) {
          assertEqual(result.placements.get(p.characterId)?.row, p.row, `${name}: riga di ${p.characterId}`);
          assertEqual(result.placements.get(p.characterId)?.col, p.col, `${name}: colonna di ${p.characterId}`);
        }
        seen.add(hardest);
      }
      for (const id of ["sceneUnary", "lineConfined", "pairSupport", "lineGroups"]) assert(seen.has(id), `nessun esempio per ${id}`);
    },
  },
  {
    name: "catalogo: ogni ragionamento ha un livello valido, gli id sono unici e i livelli non scendono lungo l'elenco",
    fn: () => {
      const ids = new Set();
      let last = 0;
      for (const t of TECHNIQUES) {
        assert(!ids.has(t.id), `id doppio: ${t.id}`);
        ids.add(t.id);
        const index = LEVELS.indexOf(t.level);
        assert(index >= 0, `livello sconosciuto per ${t.id}`);
        assert(index >= last, `${t.id} è più facile del ragionamento che lo precede`);
        last = index;
      }
      assertEqual(levelOfTechnique("hypothesis"), "expert");
      assertEqual(techniquesUpTo("easy").length, 3);
    },
  },
  {
    name: "solver umano: un caso risolvibile con un filtro, la riga/colonna occupata e l'unico candidato è facile",
    fn: () => {
      const puzzle = tinyPuzzle(2);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const room = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, room.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: room.id });
      const result = humanSolve(puzzle);
      assertEqual(result.status, "solved");
      assertEqual(result.level, "easy");
      assert(
        result.counts.clueFilter > 0 && result.counts.onlyCandidate > 0 && result.counts.rowColTaken > 0,
        JSON.stringify(result.counts)
      );
      assertEqual(result.placements.get(a.id).row, 0);
    },
  },
  {
    name: "solver umano: un indizio che nomina qualcuno già piazzato richiede il ragionamento relazionale (livello medio)",
    fn: () => {
      const puzzle = tinyPuzzle(3);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person3");
      const room = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, room.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: room.id });
      addClue(puzzle, b.id, "diagonal", { targetId: a.id });
      const result = humanSolve(puzzle);
      assertEqual(result.status, "solved");
      assertEqual(result.level, "medium");
      assertEqual(result.hardest, "relationalKnown");
    },
  },
  {
    name: "solver umano: con un tetto più basso del necessario si ferma («stuck») e dice fin dove è arrivato",
    fn: () => {
      const puzzle = tinyPuzzle(3);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person3");
      const room = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, room.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: room.id });
      addClue(puzzle, b.id, "diagonal", { targetId: a.id });
      const result = humanSolve(puzzle, { maxLevel: "easy" });
      assertEqual(result.status, "stuck");
      assertEqual(result.level, "easy");
    },
  },
  {
    name: "solver umano: indizi contraddittori e casi ambigui sono riconosciuti come tali",
    fn: () => {
      const puzzle = tinyPuzzle(2);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const room = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, room.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: room.id });
      const bad = addClue(puzzle, a.id, "inRoom", { zoneId: room.id });
      bad.negate = true;
      assertEqual(humanSolve(puzzle).status, "contradiction");
      const loose = tinyPuzzle(2);
      addCharacter(loose, "A", "person1");
      addCharacter(loose, "B", "person2");
      assertEqual(humanSolve(loose).status, "ambiguous");
    },
  },
  {
    name: "solver umano: «Il garzone della forgia» (caso reale dell'autore) è Medio, senza ipotesi, e gli indizi diretti sono filtri facili",
    fn: async () => {
      const puzzle = await load("test/bench/cases/garzone-forgia.murdoku.json");
      const result = humanSolve(puzzle);
      assertEqual(result.status, "solved");
      assertEqual(result.level, "medium", "il livello");
      assert(!result.steps.some((s) => levelIndex(s.level) > levelIndex("medium")), "nessun passo difficile o da esperto");
      assert(!result.counts.hypothesis && !result.counts.exhaustive, "niente ipotesi né ricerca a tappeto");
      // «Arnaldo è l'unico nella forgia» e «in colonna 1», «Clelia in riga 5»: tolgono celle agli altri subito, come filtri
      const early = result.steps.slice(0, 14);
      assert(
        early.every((s) => s.technique === "clueFilter"),
        "i primi passi sono tutti filtri d'indizio: " + early.map((s) => s.technique).join(", ")
      );
    },
  },
  {
    name: "solver umano: «L'orto dell'abbazia» (caso 2 della campagna) è Medio, senza ipotesi: gli indizi generali (due persone accanto al tavolo, una donna sul giaciglio…) servono subito",
    fn: async () => {
      const puzzle = await load("test/bench/cases/orto-abbazia.murdoku.json");
      const result = humanSolve(puzzle);
      assertEqual(result.status, "solved");
      assertEqual(result.level, "medium", "il livello");
      assert(!result.counts.hypothesis && !result.counts.exhaustive && !result.counts.nestedHypothesis, "niente ipotesi");
      assert(!result.steps.some((s) => levelIndex(s.level) > levelIndex("medium")), "nessun passo difficile o da esperto");
      // «qualcuno c'è» e «casella occupata» sono i ragionamenti che sfruttano gli indizi generali
      assert(result.counts.witness > 0 && result.counts.occupiedCell > 0, JSON.stringify(result.counts));
      for (const p of puzzle.solution.placements) {
        assertEqual(result.placements.get(p.characterId)?.row, p.row, "riga");
        assertEqual(result.placements.get(p.characterId)?.col, p.col, "colonna");
      }
    },
  },
  {
    name: "solver umano: il limite di lavoro dà «limit», mai una risposta inventata",
    fn: async () => {
      const puzzle = await load("test/bench/cases/tragedia-piastra-pendolina.murdoku.json");
      const result = humanSolve(puzzle, { maxWork: 2000 });
      assertEqual(result.status, "limit");
    },
  },
  {
    name: "solver umano: i casi di prova si risolvono con la stessa soluzione della ricerca esatta, e il livello non supera il tetto",
    fn: async () => {
      for (const name of ["faro.en", "monastero.en", "tutorial.en"]) {
        const puzzle = await load(`test/fixtures/${name}.murdoku.json`);
        const expected = referenceSolutions(puzzle);
        assertEqual(expected.length, 1, `${name}: una sola soluzione`);
        const want = placementsOf(expected[0]);
        const result = humanSolve(puzzle);
        assertEqual(result.status, "solved", name);
        for (const [id, cell] of want) {
          assertEqual(result.placements.get(id).row, cell.row, `${name} riga`);
          assertEqual(result.placements.get(id).col, cell.col, `${name} colonna`);
        }
        for (const level of LEVELS) {
          const capped = humanSolve(puzzle, { maxLevel: level });
          assert(LEVELS.indexOf(capped.level ?? "easy") <= LEVELS.indexOf(level), `${name}: livello oltre il tetto ${level}`);
        }
      }
    },
  },
  {
    name: "solver umano differenziale: su casi casuali (con e senza soluzione unica) non scarta mai una cella della soluzione e conclude come la ricerca esatta",
    fn: () => {
      let solved = 0;
      let stuck = 0;
      for (let seed = 1; seed <= 220; seed++) {
        const puzzle = seed % 2 === 0 ? uniqueCase(seed) : randomPuzzle(seed);
        if (!puzzle) continue;
        const expected = referenceSolutions(puzzle);
        const full = humanSolve(puzzle, { maxWork: 3e6 });
        if (full.status === "limit") continue; // budget: no claim
        if (expected.length === 0) assertEqual(full.status, "contradiction", `caso ${seed}: senza soluzioni`);
        else if (expected.length >= 2) assertEqual(full.status, "ambiguous", `caso ${seed}: ambiguo`);
        else {
          assertEqual(full.status, "solved", `caso ${seed}: una soluzione`);
          const want = placementsOf(expected[0]);
          for (const [id, cell] of want) {
            assertEqual(full.placements.get(id)?.row, cell.row, `caso ${seed}: riga di ${id}`);
            assertEqual(full.placements.get(id)?.col, cell.col, `caso ${seed}: colonna di ${id}`);
          }
          // every step must be true of the solution: nothing the solution uses is ever ruled out, every placement is right
          for (const step of full.steps) {
            const cell = want.get(step.characterId);
            if (step.placed)
              assert(step.placed.row === cell.row && step.placed.col === cell.col, `caso ${seed}: ${step.technique} piazza male`);
            for (const gone of step.eliminated ?? [])
              assert(!(gone.row === cell.row && gone.col === cell.col), `caso ${seed}: ${step.technique} scarta la cella giusta`);
          }
          solved++;
        }
        // with a ceiling: whatever it concludes must still be the solution, and it never uses a harder reasoning
        for (const level of ["easy", "medium", "hard"]) {
          const capped = humanSolve(puzzle, { maxLevel: level, maxWork: 3e6 });
          if (capped.status === "limit") continue;
          for (const step of capped.steps)
            assert(LEVELS.indexOf(step.level) <= LEVELS.indexOf(level), `caso ${seed}: oltre il tetto ${level}`);
          if (capped.status === "solved") {
            assertEqual(expected.length, 1, `caso ${seed}: risolto con tetto ${level} ma non ha una sola soluzione`);
            const want = placementsOf(expected[0]);
            for (const [id, cell] of want) assertEqual(capped.placements.get(id)?.row, cell.row, `caso ${seed} ${level}`);
          } else if (capped.status === "contradiction")
            assertEqual(expected.length, 0, `caso ${seed}: contraddizione sbagliata con tetto ${level}`);
          else stuck++;
        }
      }
      assert(solved >= 20, `servono abbastanza casi risolvibili per fidarsi del test (${solved})`);
      assert(stuck > 0, "almeno un caso deve richiedere più del tetto, o il tetto non prova nulla");
    },
  },
];
