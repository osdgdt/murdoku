// I sigilli (Egitto / Roma): il dato sulla cella, la regola sempre attiva (Anubi = solo nella stanza, Ra = non solo),
// l'indizio «su un sigillo», la migrazione e la validazione.
import { createPuzzle, addCharacter, addClue, validatePuzzleShape } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid, setBlocked, setSeal, sealOf, hasSeals, sealedCells } from "../src/model/grid.js";
import { describeClue, CLUE_TYPES } from "../src/model/clueTypes.js";
import { CURRENT_SCHEMA_VERSION, migratePuzzle } from "../src/model/migrations.js";
import { buildPredicate, buildPredicates } from "../src/solver/predicates/index.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { enumerateParams } from "../src/solver/suggestions.js";
import { resolveClueHoverCells } from "../src/solver/hoverTargets.js";
import { assert, assertEqual } from "./assert.js";

// 4×4: la stanza «Nord» (righe 0-1) e la stanza «Sud» (righe 2-3); tre persone (la prima è la vittima).
function scene({ anubis = [0, 0], ra = [2, 2] } = {}) {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const north = addZone(puzzle.grid, "Nord", "#cfe");
  const south = addZone(puzzle.grid, "Sud", "#fec");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, (r < 2 ? north : south).id);
  if (anubis) setSeal(puzzle.grid, anubis[0], anubis[1], "anubis");
  if (ra) setSeal(puzzle.grid, ra[0], ra[1], "ra");
  const people = [addCharacter(puzzle, "V", "person1", true), addCharacter(puzzle, "A", "person2"), addCharacter(puzzle, "B", "person3")];
  return { puzzle, people };
}
const at = (entries) => new Map(entries.map(([c, row, col]) => [c.id, { row, col }]));
const sealRule = (puzzle) => buildPredicates(puzzle).find(({ clue }) => clue.type === "sealRule")?.predicate;

// Tutte le soluzioni per forza bruta, con le regole scritte a mano (non quelle del solver).
function bruteForce(puzzle) {
  const people = puzzle.characters;
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push([r, c]);
  const zoneOf = ([r]) => puzzle.grid.cells[r][0].zoneId;
  let count = 0;
  const place = (i, chosen) => {
    if (i === people.length) {
      const victim = people.findIndex((p) => p.isVictim);
      const mates = (k) => chosen.filter((cell, j) => j !== k && zoneOf(cell) === zoneOf(chosen[k])).length;
      if (mates(victim) !== 1) return;
      for (let k = 0; k < chosen.length; k++) {
        const seal = sealOf(puzzle.grid, chosen[k][0], chosen[k][1]);
        if (seal === "anubis" && mates(k) !== 0) return;
        if (seal === "ra" && mates(k) === 0) return;
      }
      count++;
      return;
    }
    for (const cell of cells) {
      if (chosen.some(([r, c]) => r === cell[0] || c === cell[1])) continue;
      place(i + 1, [...chosen, cell]);
    }
  };
  place(0, []);
  return count;
}

export const tests = [
  {
    name: "sigilli: si mettono dove una persona può stare, si tolgono, e bloccare la cella o metterci un mobile alto li cancella",
    fn: () => {
      const { puzzle } = scene({ anubis: null, ra: null });
      const grid = puzzle.grid;
      assert(!hasSeals(grid));
      assert(setSeal(grid, 1, 1, "ra") && sealOf(grid, 1, 1) === "ra" && hasSeals(grid));
      assert(setSeal(grid, 1, 1, "anubis") && sealOf(grid, 1, 1) === "anubis", "un altro sigillo sostituisce il primo");
      assertEqual(sealedCells(grid).length, 1);
      placeObject(grid, "horse", 2, 2); // il cavallo si occupa: il sigillo ci sta
      assert(setSeal(grid, 2, 2, "ra"));
      placeObject(grid, "table", 3, 3); // un tavolo no
      assert(!setSeal(grid, 3, 3, "ra") && sealOf(grid, 3, 3) === null);
      setSeal(grid, 0, 3, "ra");
      placeObject(grid, "shelf", 0, 3);
      assertEqual(sealOf(grid, 0, 3), null, "un mobile alto cancella il sigillo");
      setBlocked(grid, 1, 1, true);
      assertEqual(sealOf(grid, 1, 1), null, "una cella bloccata non ha sigillo");
      assert(!setSeal(grid, 1, 1, "ra"));
      assert(setSeal(grid, 2, 2, null) && sealOf(grid, 2, 2) === null);
      assert(!setSeal(grid, 9, 9, "ra"), "fuori mappa");
    },
  },
  {
    name: "sigilli: ridimensionare la mappa tiene i sigilli che restano dentro",
    fn: () => {
      const { puzzle } = scene();
      const bigger = resizeGrid(puzzle.grid, 5, 5);
      assertEqual(sealOf(bigger, 0, 0), "anubis");
      assertEqual(sealOf(bigger, 2, 2), "ra");
      const smaller = resizeGrid(bigger, 3, 3);
      assertEqual(sealedCells(smaller).length, 2);
    },
  },
  {
    name: "sigilli: la regola — Anubi vuole la persona sola nella stanza (falso appena arriva un'altra), Ra non sola (si giudica a fine)",
    fn: () => {
      const { puzzle, people } = scene();
      const [v, a, b] = people;
      const rule = sealRule(puzzle);
      assert(rule, "la regola c'è, perché la mappa ha sigilli");
      // A su Anubi (0,0) con V nella stessa stanza (1,1): non è sola
      assertEqual(
        rule(
          at([
            [a, 0, 0],
            [v, 1, 1],
          ]),
          false
        ),
        false
      );
      // A su Anubi, V e B nell'altra stanza: sola
      assertEqual(
        rule(
          at([
            [a, 0, 0],
            [v, 2, 1],
            [b, 3, 3],
          ]),
          true
        ),
        true
      );
      // A su Anubi: finché non sono tutti piazzati non si può dire (qualcuno può ancora arrivare)
      assertEqual(rule(at([[a, 0, 0]]), false), undefined);
      // B su Ra (2,2) con V (3,1) nella stanza: va bene; senza compagnia no
      assertEqual(
        rule(
          at([
            [b, 2, 2],
            [v, 3, 1],
            [a, 1, 3],
          ]),
          true
        ),
        true
      );
      assertEqual(
        rule(
          at([
            [b, 2, 2],
            [v, 1, 1],
            [a, 0, 3],
          ]),
          true
        ),
        false
      );
      assertEqual(rule(at([[b, 2, 2]]), false), undefined, "Ra: solo a mappa completa");
      // nessuno sui sigilli: la regola non chiede niente
      assertEqual(
        rule(
          at([
            [a, 1, 1],
            [v, 1, 2],
            [b, 3, 0],
          ]),
          true
        ),
        true
      );
    },
  },
  {
    name: "sigilli: una mappa senza sigilli non ha la regola (stessi predicati di sempre)",
    fn: () => {
      const { puzzle } = scene({ anubis: null, ra: null });
      assert(!sealRule(puzzle));
      assertEqual(buildPredicates(puzzle).length, 1, "solo la regola della vittima");
    },
  },
  {
    name: "sigilli: il solver conta le stesse soluzioni della forza bruta (con e senza sigilli)",
    fn: () => {
      const variants = [
        { anubis: null, ra: null },
        {},
        { anubis: [1, 1], ra: null },
        { anubis: null, ra: [3, 0] },
        { anubis: [0, 2], ra: [2, 2] },
      ];
      for (const options of variants) {
        const { puzzle } = scene(options);
        const report = checkUniqueness(puzzle, { maxSolutions: 100000 });
        assert(report.exhausted);
        assertEqual(report.solutionCount, bruteForce(puzzle), `soluzioni con ${JSON.stringify(options)}`);
      }
      // i sigilli tolgono davvero qualche soluzione
      assert(bruteForce(scene().puzzle) < bruteForce(scene({ anubis: null, ra: null }).puzzle));
    },
  },
  {
    name: "sigilli: l'indizio «è sul sigillo» — testo, negazione, tempo, predicato",
    fn: () => {
      const { puzzle, people } = scene();
      const a = people[1];
      const any = addClue(puzzle, a.id, "onSeal", { sealKind: "any" });
      const anubis = addClue(puzzle, a.id, "onSeal", { sealKind: "anubis" });
      const ra = addClue(puzzle, a.id, "onSeal", { sealKind: "ra" });
      assertEqual(describeClue(any, puzzle), "È su una casella sigillo.");
      assertEqual(describeClue(anubis, puzzle), "È sul sigillo di Anubi.");
      assertEqual(describeClue(ra, puzzle), "È sul sigillo di Ra.");
      const check = (clue, row, col) => buildPredicate(clue, puzzle)(at([[a, row, col]]), false);
      assertEqual(check(any, 0, 0), true);
      assertEqual(check(any, 2, 2), true);
      assertEqual(check(any, 1, 1), false);
      assertEqual(check(ra, 0, 0), false);
      assertEqual(check(ra, 2, 2), true);
      assertEqual(buildPredicate(any, puzzle)(new Map(), false), undefined, "senza posizione non si sa");
      anubis.negate = true;
      assertEqual(describeClue(anubis, puzzle), "Non è sul sigillo di Anubi.");
      assertEqual(check(anubis, 0, 0), false, "negato: sul sigillo di Anubi → falso");
      assertEqual(check(anubis, 3, 3), true);
      puzzle.tense = "past";
      assertEqual(describeClue(ra, puzzle), "Era sul sigillo di Ra.");
    },
  },
  {
    name: "sigilli: i suggerimenti propongono solo i sigilli che ci sono sulla mappa",
    fn: () => {
      const def = CLUE_TYPES.onSeal;
      const { puzzle, people } = scene({ anubis: [0, 0], ra: null });
      assertEqual(
        enumerateParams(def, puzzle, people[1].id)
          .map((p) => p.sealKind)
          .join(),
        "any,anubis"
      );
      assertEqual(enumerateParams(def, scene({ anubis: null, ra: null }).puzzle, people[1].id).length, 0);
    },
  },
  {
    name: "sigilli: passando il mouse sull'indizio si evidenziano le caselle con quel sigillo",
    fn: () => {
      const { puzzle, people } = scene();
      const cells = (kind) =>
        resolveClueHoverCells({ type: "onSeal", characterId: people[1].id, params: { sealKind: kind } }, puzzle, new Map())
          .map((c) => `${c.row},${c.col}`)
          .join(" ");
      assertEqual(cells("anubis"), "0,0");
      assertEqual(cells("ra"), "2,2");
      assertEqual(cells("any"), "0,0 2,2");
    },
  },
  {
    name: "sigilli: i casi vecchi si aprono come prima, un sigillo non valido è rifiutato",
    fn: () => {
      const { puzzle } = scene({ anubis: null, ra: null });
      puzzle.solution = { placements: [] };
      const old = JSON.parse(JSON.stringify(puzzle));
      old.schemaVersion = 4;
      const before = JSON.stringify(old.grid.cells);
      migratePuzzle(old);
      assertEqual(old.schemaVersion, CURRENT_SCHEMA_VERSION);
      assert(CURRENT_SCHEMA_VERSION >= 5);
      assertEqual(JSON.stringify(old.grid.cells), before, "la migrazione non tocca le celle");
      const bad = scene().puzzle;
      bad.solution = { placements: [] };
      bad.grid.cells[3][3].seal = "osiride";
      assert(validatePuzzleShape(bad).errors.length > 0, "un sigillo sconosciuto non passa");
      const good = scene().puzzle;
      good.solution = { placements: [] };
      assert(!validatePuzzleShape(good).errors.some((e) => /sigillo/i.test(e)));
    },
  },
];
