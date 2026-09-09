import { createPuzzle, addCharacter, addClue, setSolutionPlacement } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid, setBlocked } from "../src/model/grid.js";
import { objectTypeTargetId } from "../src/model/icons.js";
import { characterClueTypeIds, genericClueTypeIds, describeClue } from "../src/model/clueTypes.js";
import { buildPredicate } from "../src/solver/predicates.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { checkUniqueness, validateSolution } from "../src/solver/validator.js";
import { assert, assertEqual } from "./assert.js";

function basePuzzle(rows = 3, cols = 3) {
  const puzzle = createPuzzle("Test solver");
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  return puzzle;
}

function mapOf(entries) {
  return new Map(entries);
}

export const tests = [
  {
    name: "predicate adjacent: true quando le celle sono a distanza 1",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      const pm = mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]);
      assertEqual(predicate(pm, true), true);
    },
  },
  {
    name: "predicate adjacent: false quando le celle sono distanti",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      const pm = mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]);
      assertEqual(predicate(pm, true), false);
    },
  },
  {
    name: "predicate direction: south corretto",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "direction", { direction: "south", targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      const pmTrue = mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 0, col: 0 }]]);
      const pmFalse = mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 0 }]]);
      assertEqual(predicate(pmTrue, true), true);
      assertEqual(predicate(pmFalse, true), false);
    },
  },
  {
    name: "predicate inRoom/notInRoom usa la zona della cella",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      const inClue = addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const notClue = addClue(puzzle, a.id, "notInRoom", { zoneId: zone.id });
      const inPred = buildPredicate(inClue, puzzle);
      const notPred = buildPredicate(notClue, puzzle);
      const pmIn = mapOf([[a.id, { row: 0, col: 0 }]]);
      const pmOut = mapOf([[a.id, { row: 1, col: 1 }]]);
      assertEqual(inPred(pmIn, true), true);
      assertEqual(inPred(pmOut, true), false);
      assertEqual(notPred(pmOut, true), true);
    },
  },
  {
    name: "predicate onlyPersonNear richiede il completamento per essere certo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const obj = placeObject(puzzle.grid, "shelf", 1, 1);
      const clue = addClue(puzzle, a.id, "onlyPersonNear", { targetId: obj.id });
      const predicate = buildPredicate(clue, puzzle);
      // A adjacent to shelf, C also adjacent -> violates once complete
      const pm = mapOf([
        [a.id, { row: 0, col: 1 }],
        [b.id, { row: 2, col: 2 }],
        [c.id, { row: 1, col: 0 }],
      ]);
      assertEqual(predicate(pm, true), false, "C è anche vicino allo scaffale, non dovrebbe passare");
    },
  },
  {
    name: "predicate aloneWithVictim rileva la vittima e stanza condivisa",
    fn: () => {
      const puzzle = basePuzzle();
      const murderer = addCharacter(puzzle, "Sospetto", "person1");
      const bystander = addCharacter(puzzle, "Testimone", "person2");
      const victim = addCharacter(puzzle, "Vittima", "person1", true);
      const zone = addZone(puzzle.grid, "Salotto", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      const clue = addClue(puzzle, murderer.id, "aloneWithVictim", {});
      const predicate = buildPredicate(clue, puzzle);
      const pm = mapOf([
        [murderer.id, { row: 0, col: 0 }],
        [victim.id, { row: 0, col: 1 }],
        [bystander.id, { row: 2, col: 2 }],
      ]);
      assertEqual(predicate(pm, true), true);
    },
  },
  {
    name: "solvePuzzle trova la soluzione unica su un mini-caso vincolato",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1", true);
      // Force: A north of B, B north of C -> unique row order A<B<C, any column perm allowed by rows/cols distinct
      addClue(puzzle, a.id, "direction", { direction: "north", targetId: b.id });
      addClue(puzzle, b.id, "direction", { direction: "north", targetId: c.id });
      // Rows 1 and 2 as one room: since the clues above force A to row 0 and
      // B/C to rows 1/2 regardless of column, B and the victim C always end
      // up together in this room and A never does — satisfying the base
      // rule (victim alone with exactly one companion) for every column
      // permutation the search might try, not just the declared solution.
      const livingRoom = addZone(puzzle.grid, "Salone", "#eee");
      for (let col = 0; col < 3; col++) {
        paintCellZone(puzzle.grid, 1, col, livingRoom.id);
        paintCellZone(puzzle.grid, 2, col, livingRoom.id);
      }
      setSolutionPlacement(puzzle, a.id, 0, 0);
      setSolutionPlacement(puzzle, b.id, 1, 1);
      setSolutionPlacement(puzzle, c.id, 2, 2);

      const report = checkUniqueness(puzzle);
      assert(report.solutionCount >= 1, "deve esistere almeno una soluzione");
      const found = report.solutions[0];
      const byChar = Object.fromEntries(found.map((p) => [p.characterId, p]));
      assert(byChar[a.id].row < byChar[b.id].row, "A deve essere sopra B");
      assert(byChar[b.id].row < byChar[c.id].row, "B deve essere sopra C");
    },
  },
  {
    name: "validateSolution segnala un indizio violato",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2", true);
      addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      setSolutionPlacement(puzzle, a.id, 0, 0);
      setSolutionPlacement(puzzle, b.id, 2, 2); // not adjacent -> violation
      const result = validateSolution(puzzle);
      assert(!result.valid, "atteso non valido");
      assert(result.violations.length > 0, "attesa almeno una violazione");
    },
  },
  {
    name: "checkUniqueness con maxSolutions sufficiente trova l'intero insieme e segnala truncated:false",
    fn: () => {
      // 2x2, 2 personaggi, nessun indizio: esattamente 4 soluzioni possibili
      // (permutazioni di righe × permutazioni di colonne, 2!×2!).
      const puzzle = basePuzzle(2, 2);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const report = checkUniqueness(puzzle, { maxSolutions: 10 });
      assertEqual(report.solutionCount, 4, "devono esistere esattamente 4 soluzioni");
      assertEqual(report.solutions.length, 4, "il report deve includere tutte e 4 le soluzioni trovate");
      assertEqual(report.truncated, false, "la ricerca è esaustiva, non deve risultare troncata");
    },
  },
  {
    name: "checkUniqueness con maxSolutions basso ferma la ricerca e segnala truncated:true",
    fn: () => {
      const puzzle = basePuzzle(2, 2);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const report = checkUniqueness(puzzle, { maxSolutions: 2 });
      assertEqual(report.solutionCount, 2, "la ricerca deve fermarsi esattamente al cap");
      assertEqual(report.truncated, true, "il cap (non l'esaurimento) ha fermato la ricerca: deve risultare troncata");
    },
  },
  {
    name: "checkUniqueness espone nodesVisited, usato dall'editor per la stima di difficoltà",
    fn: () => {
      const puzzle = basePuzzle(2, 2);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const report = checkUniqueness(puzzle, { maxSolutions: 10 });
      assert(typeof report.nodesVisited === "number" && report.nodesVisited > 0, "nodesVisited deve essere un numero positivo per una ricerca che ha esplorato lo spazio");
    },
  },
  {
    name: "checkUniqueness: omettere forwardCheck equivale esplicitamente a forwardCheck:false (nessun cambiamento di comportamento di default)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zone.id });

      const withoutOption = checkUniqueness(puzzle, { maxSolutions: 10 });
      const explicitFalse = checkUniqueness(puzzle, { maxSolutions: 10, forwardCheck: false });
      assertEqual(withoutOption.nodesVisited, explicitFalse.nodesVisited, "il calibrato di Stima difficoltà dipende da questo comportamento di default rimasto invariato");
      assertEqual(withoutOption.solutionCount, explicitFalse.solutionCount);
    },
  },
  {
    name: "checkUniqueness: forwardCheck:true (opt-in) visita meno nodi del default su un ramo strutturalmente morto",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zone.id });

      const withoutFC = checkUniqueness(puzzle, { maxSolutions: 10 });
      const withFC = checkUniqueness(puzzle, { maxSolutions: 10, forwardCheck: true });
      assertEqual(withoutFC.solutionCount, 0);
      assertEqual(withFC.solutionCount, 0);
      assert(withFC.nodesVisited < withoutFC.nodesVisited, `forwardCheck:true doveva visitare meno nodi (${withFC.nodesVisited} vs ${withoutFC.nodesVisited})`);
    },
  },
  {
    name: "solvePuzzle non piazza mai personaggi su celle bloccate (mappa a L)",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      // Block the top-right corner to form an L-shaped map.
      setBlocked(puzzle.grid, 0, 2, true);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1", true);
      // A 2-cell room on different rows/cols so two distinct characters can
      // occupy it at once (a same-row/same-col room could never hold more
      // than one person) — needed so at least one placement satisfies the
      // base rule (victim alone with exactly one companion) alongside the
      // blocked-cell constraint this test is actually about.
      const room = addZone(puzzle.grid, "Stanza", "#eee");
      paintCellZone(puzzle.grid, 1, 1, room.id);
      paintCellZone(puzzle.grid, 2, 2, room.id);
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione anche con una cella bloccata");
      for (const solution of report.solutions) {
        for (const p of solution) {
          assert(!(p.row === 0 && p.col === 2), "nessun personaggio deve finire sulla cella bloccata");
        }
      }
    },
  },
  {
    name: "solvePuzzle non piazza mai personaggi su una cella con un oggetto",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      placeObject(puzzle.grid, "shelf", 0, 2);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      // See the L-shaped-map test above: a 2-cell room on different
      // rows/cols so the base rule (victim + exactly one companion) is
      // satisfiable alongside the object-avoidance constraint this test
      // actually checks.
      const room = addZone(puzzle.grid, "Stanza", "#eee");
      paintCellZone(puzzle.grid, 1, 1, room.id);
      paintCellZone(puzzle.grid, 2, 2, room.id);
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione anche con un oggetto sulla mappa");
      for (const solution of report.solutions) {
        for (const p of solution) {
          assert(!(p.row === 0 && p.col === 2), "nessun personaggio deve finire sulla cella con lo scaffale");
        }
      }
    },
  },
  {
    name: "predicate adjacent con bersaglio generico 'qualsiasi porta' è vero se accanto a una qualunque",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "door", 2, 2); // porta lontana da A
      placeObject(puzzle.grid, "door", 0, 1); // porta vicina ad A
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: objectTypeTargetId("door") });
      const predicate = buildPredicate(clue, puzzle);
      const pm = mapOf([[a.id, { row: 0, col: 0 }]]);
      assertEqual(predicate(pm, true), true, "deve bastare essere accanto a una qualsiasi delle porte");
    },
  },
  {
    name: "predicate adjacent con bersaglio generico è falso se non esiste nessun oggetto di quel tipo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: objectTypeTargetId("door") });
      const predicate = buildPredicate(clue, puzzle);
      const pm = mapOf([[a.id, { row: 0, col: 0 }]]);
      assertEqual(predicate(pm, true), false, "senza porte sulla mappa l'indizio non può essere soddisfatto");
    },
  },
  {
    name: "predicate onlyPersonNear con bersaglio generico considera solo le istanze cui il proprietario è vicino",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      placeObject(puzzle.grid, "door", 0, 1); // porta vicina ad A
      placeObject(puzzle.grid, "door", 2, 2); // porta vicina a B, ma A non è vicino a questa
      const clue = addClue(puzzle, a.id, "onlyPersonNear", { targetId: objectTypeTargetId("door") });
      const predicate = buildPredicate(clue, puzzle);
      const pm = mapOf([
        [a.id, { row: 0, col: 0 }],
        [b.id, { row: 2, col: 1 }], // vicino solo alla porta (2,2), non a quella di A
      ]);
      assertEqual(predicate(pm, true), true, "B è vicino a un'altra porta, non deve invalidare l'indizio di A");
    },
  },
  {
    name: "predicate rowOrColWith su un oggetto: vero se condivide l'asse, falso altrimenti",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const shelf = placeObject(puzzle.grid, "shelf", 2, 1);
      const clue = addClue(puzzle, a.id, "rowOrColWith", { axis: "col", targetId: shelf.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), true, "stessa colonna dello scaffale");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 2 }]]), true), false, "colonna diversa dallo scaffale");
    },
  },
  {
    name: "predicate rowOrColWith con bersaglio generico è falso se non esiste nessun oggetto di quel tipo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "rowOrColWith", { axis: "row", targetId: objectTypeTargetId("door") });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false);
    },
  },
  {
    name: "predicate rowOrColWith con bersaglio-personaggio resta sempre insoddisfacibile (regressione)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "rowOrColWith", { axis: "row", targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      // Qualunque soluzione valida ha A e B su righe/colonne distinte (Regola 1), quindi resta sempre falso.
      const pm = mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]);
      assertEqual(predicate(pm, true), false);
    },
  },
  {
    name: "predicate notAdjacent: vero se lontano, falso se adiacente",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "notAdjacent", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]), true), false);
    },
  },
  {
    name: "predicate notAdjacent con bersaglio generico è vero per verità vacua se non esiste nessuna istanza",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "notAdjacent", { targetId: objectTypeTargetId("door") });
      const predicate = buildPredicate(clue, puzzle);
      // Contrasto deliberato con "adjacent" (che in questo stesso caso restituisce false).
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true);
    },
  },
  {
    name: "predicate notAdjacent resta indeterminato finché il bersaglio non è piazzato",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "notAdjacent", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined);
    },
  },
  {
    name: "predicate diagonal: vero in diagonale, falso se adiacente ortogonalmente o lontano",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "diagonal", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), true);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]), true), false, "adiacente ma non in diagonale");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), false, "troppo lontano");
    },
  },
  {
    name: "predicate between: vero se strettamente tra due bersagli sulla stessa riga",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const table = placeObject(puzzle.grid, "table", 0, 0);
      const chair = placeObject(puzzle.grid, "chair", 0, 3);
      const clue = addClue(puzzle, a.id, "between", { targetAId: table.id, targetBId: chair.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), true);
    },
  },
  {
    name: "predicate between: falso se non strettamente compreso o fuori dalla riga/colonna condivisa",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const table = placeObject(puzzle.grid, "table", 0, 0);
      const chair = placeObject(puzzle.grid, "chair", 0, 3);
      const clue = addClue(puzzle, a.id, "between", { targetAId: table.id, targetBId: chair.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false, "coincide con un bersaglio, non è 'tra'");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), true), false, "fuori dalla riga condivisa dai bersagli");
    },
  },
  {
    name: "predicate between resta indeterminato se un bersaglio-personaggio non è ancora piazzato",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const table = placeObject(puzzle.grid, "table", 0, 0);
      const clue = addClue(puzzle, a.id, "between", { targetAId: table.id, targetBId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), false), undefined);
    },
  },
  {
    name: "predicate between è falso (non vacuo) se un bersaglio generico non ha istanze sulla mappa",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const table = placeObject(puzzle.grid, "table", 0, 0);
      const clue = addClue(puzzle, a.id, "between", { targetAId: table.id, targetBId: objectTypeTargetId("lamp") });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), false);
    },
  },
  {
    name: "predicate notSameRoomAs: falso se stessa stanza, vero altrimenti",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Salotto", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      const clue = addClue(puzzle, a.id, "notSameRoomAs", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]), true), false, "stessa stanza");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true, "stanze diverse");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato");
    },
  },
  {
    name: "solvePuzzle: 'between' e 'rowOrColWith' su un oggetto producono una soluzione valida",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      const table = placeObject(puzzle.grid, "table", 0, 0);
      const chair = placeObject(puzzle.grid, "chair", 0, 3);
      const shelf = placeObject(puzzle.grid, "shelf", 2, 2);
      addClue(puzzle, a.id, "between", { targetAId: table.id, targetBId: chair.id });
      addClue(puzzle, b.id, "rowOrColWith", { axis: "col", targetId: shelf.id });
      // A is pinned to row 0 by the clues above (its only valid column once
      // B's is forced to the shelf's), so a room covering rows 1-2 entirely
      // always excludes A and always includes both B and the victim C —
      // satisfying the base rule (victim + exactly one companion) for every
      // solution the search can find, not just one lucky ordering.
      const room = addZone(puzzle.grid, "Salotto", "#eee");
      for (let row = 1; row <= 2; row++) {
        for (let col = 0; col < 4; col++) paintCellZone(puzzle.grid, row, col, room.id);
      }
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      const byChar = Object.fromEntries(report.solutions[0].map((p) => [p.characterId, p]));
      assert(byChar[a.id].row === 0 && byChar[a.id].col > 0 && byChar[a.id].col < 3, "A deve stare tra tavolo e sedia sulla riga 0");
      assertEqual(byChar[b.id].col, 2, "B deve condividere la colonna con lo scaffale");
    },
  },
  {
    name: "solvePuzzle con fixedPlacements vincola la ricerca ai personaggi già piazzati",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2", true);
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      // Also part of the same room: B's fixed cell (0,0) — so the victim B
      // ends up in a room together with exactly A (satisfying the base
      // rule) once A is forced into the room's only other cell, (1,1).
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const solutions = solvePuzzle(puzzle, {
        maxSolutions: 10,
        fixedPlacements: new Map([[b.id, { row: 0, col: 0 }]]),
      });
      assertEqual(solutions.length, 1, "fissando B, l'unica cella compatibile per A è (1,1)");
      const byChar = Object.fromEntries(solutions[0].map((p) => [p.characterId, p]));
      assertEqual(byChar[b.id].row, 0);
      assertEqual(byChar[b.id].col, 0);
      assertEqual(byChar[a.id].row, 1);
      assertEqual(byChar[a.id].col, 1);
    },
  },
  {
    name: "solvePuzzle con fixedPlacements su una cella bloccata non genera errori e non trova soluzioni",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      setBlocked(puzzle.grid, 0, 0, true);
      const solutions = solvePuzzle(puzzle, { fixedPlacements: new Map([[a.id, { row: 0, col: 0 }]]) });
      assertEqual(solutions.length, 0);
    },
  },
  {
    name: "solvePuzzle con maxNodes segnala tramite stats.nodeCapHit quando il budget viene esaurito",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1");
      const stats = {};
      solvePuzzle(puzzle, { maxSolutions: 1000, maxNodes: 10, stats });
      assertEqual(stats.nodeCapHit, true);
      assert(stats.nodesVisited >= 10, "nodesVisited deve riflettere il lavoro effettivamente svolto");
    },
  },
  {
    name: "solvePuzzle con forwardCheck:true visita molti meno nodi di forwardCheck:false su un ramo strutturalmente morto",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      // A e B sono entrambi confinati alla stessa zona di 2 celle, sulla
      // STESSA riga: non potranno mai starci entrambi (due personaggi non
      // possono mai condividere una riga). Senza forward-check, la ricerca
      // scopre questo solo dopo aver provato ogni cella rimanente per B (il
      // suo stesso indizio le rifiuta tutte, una per una); con forward-check,
      // la propagazione scopre che B non ha più alcuna cella valida non
      // appena A viene piazzata, e scarta il ramo subito.
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zone.id });

      const statsWithout = {};
      const withoutFC = solvePuzzle(puzzle, { maxSolutions: 10, stats: statsWithout, forwardCheck: false });
      const statsWith = {};
      const withFC = solvePuzzle(puzzle, { maxSolutions: 10, stats: statsWith, forwardCheck: true });

      assertEqual(withoutFC.length, 0, "il puzzle è genuinamente irrisolvibile in entrambi i casi");
      assertEqual(withFC.length, 0);
      assert(statsWith.nodesVisited < statsWithout.nodesVisited, `forwardCheck doveva visitare meno nodi (${statsWith.nodesVisited} vs ${statsWithout.nodesVisited})`);
    },
  },
  {
    name: "solvePuzzle: forwardCheck non cambia mai l'insieme delle soluzioni trovate, solo quanto in fretta le trova",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const x = addCharacter(puzzle, "X", "person1");
      const y = addCharacter(puzzle, "Y", "person2");
      addCharacter(puzzle, "Z", "person1"); // libero, nessun indizio
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, x.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, y.id, "inRoom", { zoneId: zone.id });

      const solutionKey = (sol) =>
        [...sol].sort((a, b) => a.characterId.localeCompare(b.characterId)).map((p) => `${p.characterId}:${p.row},${p.col}`).join("|");

      const withoutFC = solvePuzzle(puzzle, { maxSolutions: 100, forwardCheck: false });
      const withFC = solvePuzzle(puzzle, { maxSolutions: 100, forwardCheck: true });
      assert(withoutFC.length > 0, "il puzzle deve avere soluzioni reali per essere un test significativo");
      assertEqual(withFC.length, withoutFC.length);
      const setWithout = new Set(withoutFC.map(solutionKey));
      const setWith = new Set(withFC.map(solutionKey));
      assertEqual(setWith.size, setWithout.size);
      for (const key of setWithout) assert(setWith.has(key), `soluzione mancante con forwardCheck:true: ${key}`);
      for (const key of setWith) assert(setWithout.has(key), `soluzione in più con forwardCheck:true: ${key}`);
    },
  },
  {
    name: "predicate generico noOneInRoom: falso appena qualcuno è nella stanza, vero solo a completamento",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, null, "noOneInRoom", { zoneId: zone.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), false), false, "A è nella stanza vietata");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato, potrebbe finire lì");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true, "nessuno dei due è nella stanza");
    },
  },
  {
    name: "predicate generico exactlyOneInRoom: falso appena sono in due, vero solo con esattamente una persona a completamento",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      const clue = addClue(puzzle, null, "exactlyOneInRoom", { zoneId: zone.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }], [b.id, { row: 0, col: 1 }]]), false), false, "entrambi nella stanza: già troppi");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), false), undefined, "solo uno per ora, B potrebbe ancora entrarci o no");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }], [b.id, { row: 2, col: 2 }]]), true), true, "esattamente una persona nella stanza");
    },
  },
  {
    name: "predicate generico noOneNear: verità vacua con bersaglio generico assente, falso se qualcuno è vicino",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const door = placeObject(puzzle.grid, "door", 1, 1);
      const clue = addClue(puzzle, null, "noOneNear", { targetId: door.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), false), false, "A è adiacente alla porta");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true, "nessuno è vicino alla porta");

      const emptyClue = addClue(puzzle, null, "noOneNear", { targetId: objectTypeTargetId("window") });
      const emptyPredicate = buildPredicate(emptyClue, puzzle);
      assertEqual(emptyPredicate(mapOf([[a.id, { row: 0, col: 1 }]]), false), true, "nessuna finestra sulla mappa: verità vacua immediata");
    },
  },
  {
    name: "predicate generico sameRoomTogether confronta due personaggi nominati, senza proprietario",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Salotto", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, null, "sameRoomTogether", { targetAId: a.id, targetBId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), true, "stessa stanza");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), false, "stanze diverse");
    },
  },
  {
    name: "solvePuzzle rispetta un indizio generico noOneInRoom durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle();
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2", true);
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, null, "noOneInRoom", { zoneId: zone.id });
      // Every other cell as one big second room: since the clue above keeps
      // everyone out of Studio anyway, both characters always land in this
      // room together — satisfying the base rule (victim + exactly one
      // companion) for every solution, on top of the noOneInRoom clue this
      // test is actually about.
      const restOfHouse = addZone(puzzle.grid, "Casa", "#eee");
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (row === 1 && col === 1) continue;
          paintCellZone(puzzle.grid, row, col, restOfHouse.id);
        }
      }
      const solutions = solvePuzzle(puzzle, { maxSolutions: 50 });
      assert(solutions.length > 0, "deve esistere almeno una soluzione");
      for (const sol of solutions) {
        for (const p of sol) {
          assert(!(p.row === 1 && p.col === 1), "nessun personaggio deve finire nella stanza vietata");
        }
      }
    },
  },
  {
    name: "predicate eitherAdjacent: vero se accanto a uno qualsiasi dei due bersagli",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const shrub = placeObject(puzzle.grid, "plant", 2, 2);
      const shelf = placeObject(puzzle.grid, "shelf", 0, 1);
      const clue = addClue(puzzle, a.id, "eitherAdjacent", { targetAId: shrub.id, targetBId: shelf.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "accanto allo scaffale (bersaglio B)");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 1 }]]), true), true, "accanto alla pianta (bersaglio A)");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }]]), true), false, "non accanto a nessuno dei due");
    },
  },
  {
    name: "predicate eitherAdjacent è vero se un lato è già soddisfatto anche se l'altro bersaglio non è ancora piazzato",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const shelf = placeObject(puzzle.grid, "shelf", 0, 1);
      const clue = addClue(puzzle, a.id, "eitherAdjacent", { targetAId: b.id, targetBId: shelf.id });
      const predicate = buildPredicate(clue, puzzle);
      // A accanto allo scaffale (bersaglio B, risolto), B non ancora piazzato (bersaglio A, indeterminato).
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), true);
    },
  },
  {
    name: "predicate eitherAdjacent resta indeterminato se nessun lato è ancora deciso",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const clue = addClue(puzzle, a.id, "eitherAdjacent", { targetAId: b.id, targetBId: c.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "né B né C sono ancora piazzati");
    },
  },
  {
    name: "predicate aloneInRoom: vero se sola nella sua stanza, falso se qualcun altro la condivide o non è in nessuna stanza",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "aloneInRoom", {});
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), false, "B condivide la stanza");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato, potrebbe entrare nella stanza");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true, "A è sola nella stanza");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }], [b.id, { row: 0, col: 0 }]]), true), false, "A non è in nessuna stanza");
    },
  },
  {
    name: "predicate aloneWithPerson: vero se sola col bersaglio, falso se un terzo si unisce o il bersaglio è altrove",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "aloneWithPerson", { targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), false), false, "B non è nella stessa stanza di A");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), false), undefined, "C non ancora piazzato, potrebbe unirsi");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }], [c.id, { row: 2, col: 0 }]]), true),
        true,
        "C altrove: A e B restano soli"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }], [c.id, { row: 0, col: 1 }]]), true),
        false,
        "C si unisce nella stessa stanza"
      );
    },
  },
  {
    name: "predicate onlyPersonInRoom: vero se nella stanza indicata e sola, falso se altrove o in compagnia",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "onlyPersonInRoom", { zoneId: zone.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]]), false), false, "A non è nella stanza indicata");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "A è nella stanza, B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true, "A sola nella stanza indicata");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), false, "B si unisce nella stanza");
    },
  },
  {
    name: "predicate inCorner: vero solo nei quattro angoli della griglia",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "inCorner", {});
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "angolo in alto a sinistra");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]]), true), true, "angolo in basso a destra");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 2 }]]), true), true, "angolo in alto a destra");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), true), false, "centro, non è un angolo");
      assertEqual(predicate(mapOf([]), false), undefined, "non ancora piazzato");
    },
  },
  {
    name: "predicate inRoomCorner: vero negli angoli della propria stanza, non della mappa",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Salotto", "#fff");
      // Stanza rettangolare 3x3 in un angolo di una mappa 4x4, cosicché
      // (3,3) resti fuori da qualunque stanza.
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) paintCellZone(puzzle.grid, r, c, zone.id);
      const clue = addClue(puzzle, a.id, "inRoomCorner", {});
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([]), false), undefined, "non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "angolo della stanza in alto a sinistra");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]]), true), true, "angolo della stanza in basso a destra");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), false, "bordo della stanza, non un angolo");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), true), false, "centro della stanza");
      assertEqual(predicate(mapOf([[a.id, { row: 3, col: 3 }]]), true), false, "fuori da qualunque stanza");
    },
  },
  {
    name: "predicate inRoomCorner: negli angoli 'interni' (concavi) di una stanza a L, non solo quelli convessi",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "StanzaAL", "#fff");
      // Stanza a L: l'intera griglia 3x3 tranne l'angolo in alto a destra.
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 0 && c === 2) continue;
          paintCellZone(puzzle.grid, r, c, zone.id);
        }
      }
      const clue = addClue(puzzle, a.id, "inRoomCorner", {});
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), true), false, "centro della L, circondato su tutti i lati: non è un angolo");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "angolo convesso in alto a sinistra");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }]]), true), true, "angolo convesso in basso a sinistra");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 2 }]]), true), true, "angolo concavo accanto alla tacca mancante");
    },
  },
  {
    name: "predicate facing: vero se stessa riga o colonna del bersaglio",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const window = placeObject(puzzle.grid, "window", 1, 1);
      const clue = addClue(puzzle, a.id, "facing", { targetId: window.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }]]), true), true, "stessa riga della finestra");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), true, "stessa colonna della finestra");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false, "né riga né colonna in comune");

      const emptyClue = addClue(puzzle, a.id, "facing", { targetId: objectTypeTargetId("door") });
      const emptyPredicate = buildPredicate(emptyClue, puzzle);
      assertEqual(emptyPredicate(mapOf([[a.id, { row: 1, col: 0 }]]), true), false, "nessuna porta sulla mappa");
    },
  },
  {
    name: "predicate directionDistance: vera solo all'esatta distanza nella direzione indicata",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "directionDistance", { direction: "north", distance: 2, targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }]]), false), undefined, "B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }], [b.id, { row: 3, col: 0 }]]), true), true, "esattamente 2 righe a nord");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 3, col: 0 }]]), true), false, "solo 1 riga di distanza, non 2");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }], [b.id, { row: 4, col: 0 }]]), true), false, "3 righe, non 2");
    },
  },
  {
    name: "predicate closerTo: vero se più vicino al primo bersaglio che al secondo",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const near = placeObject(puzzle.grid, "chair", 0, 0);
      const far = placeObject(puzzle.grid, "table", 4, 4);
      const clue = addClue(puzzle, a.id, "closerTo", { targetAId: near.id, targetBId: far.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), true, "molto più vicino alla sedia che al tavolo");
      assertEqual(predicate(mapOf([[a.id, { row: 4, col: 3 }]]), true), false, "molto più vicino al tavolo che alla sedia");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]]), true), false, "equidistante non conta come 'più vicino'");
    },
  },
  {
    name: "predicate closerTo con bersaglio generico usa l'istanza più vicina di ciascun tipo",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "chair", 0, 0);
      placeObject(puzzle.grid, "chair", 4, 4); // sedia lontana: quella vicina in (0,0) è quella che conta
      placeObject(puzzle.grid, "table", 2, 0);
      const clue = addClue(puzzle, a.id, "closerTo", { targetAId: objectTypeTargetId("chair"), targetBId: objectTypeTargetId("table") });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), true, "la sedia più vicina batte il tavolo");
    },
  },
  {
    name: "predicate generico emptyRoomsCount: falso appena troppe stanze sono occupate, vero solo al conteggio esatto a completamento",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zoneA = addZone(puzzle.grid, "Studio", "#fff");
      const zoneB = addZone(puzzle.grid, "Cucina", "#eee");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      paintCellZone(puzzle.grid, 2, 2, zoneB.id);
      const clue = addClue(puzzle, null, "emptyRoomsCount", { count: 1 });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([]), false), undefined, "nessuno ancora piazzato, entrambe le stanze potrebbero restare vuote");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), false),
        false,
        "entrambe le stanze occupate: nessuna resta vuota"
      );
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "una stanza occupata, B non ancora piazzato");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true),
        true,
        "Studio occupato, Cucina vuota: esattamente una stanza vuota"
      );
    },
  },
  {
    name: "solvePuzzle rispetta un indizio generico emptyRoomsCount durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2", true);
      addCharacter(puzzle, "Cnew", "person1");
      const zoneA = addZone(puzzle.grid, "Studio", "#fff");
      const zoneB = addZone(puzzle.grid, "Cucina", "#eee");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      // Cucina spans two cells on different rows/cols, big enough for two
      // distinct characters at once (a same-row/same-col room could never
      // hold both) — needed so the victim B can share a room with exactly
      // one companion here, satisfying the base rule alongside the
      // emptyRoomsCount clue this test is actually about. Studio stays a
      // single cell, which can only ever hold the victim alone or nobody —
      // so under the base rule, whichever room ends up "the occupied one"
      // is now always Cucina, never Studio; the clue itself doesn't care
      // which, only that exactly one of the two is occupied.
      paintCellZone(puzzle.grid, 2, 2, zoneB.id);
      paintCellZone(puzzle.grid, 3, 3, zoneB.id);
      addClue(puzzle, null, "emptyRoomsCount", { count: 1 });
      const solutions = solvePuzzle(puzzle, { maxSolutions: 50 });
      assert(solutions.length > 0, "deve esistere almeno una soluzione");
      for (const sol of solutions) {
        const occupied = new Set();
        for (const p of sol) {
          if (p.row === 0 && p.col === 0) occupied.add("studio");
          if ((p.row === 2 && p.col === 2) || (p.row === 3 && p.col === 3)) occupied.add("cucina");
        }
        assertEqual(occupied.size, 1, "esattamente una delle due stanze deve essere occupata, l'altra vuota");
        const byChar = Object.fromEntries(sol.map((p) => [p.characterId, p]));
        assert(
          (byChar[b.id].row === 2 && byChar[b.id].col === 2) || (byChar[b.id].row === 3 && byChar[b.id].col === 3),
          "sotto la regola base, la vittima deve trovarsi in Cucina insieme a un solo compagno"
        );
      }
    },
  },
  {
    name: "buildPredicate: clue.negate inverte in modo sano un predicato positivo (equivalente al vecchio notAdjacent)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      clue.negate = true;
      const predicate = buildPredicate(clue, puzzle);
      const legacyClue = addClue(puzzle, a.id, "notAdjacent", { targetId: b.id });
      const legacyPredicate = buildPredicate(legacyClue, puzzle);
      for (const pm of [
        mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]),
        mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]),
        mapOf([[a.id, { row: 0, col: 0 }]]),
      ]) {
        assertEqual(predicate(pm, true), legacyPredicate(pm, true), "negate=true su 'adjacent' deve coincidere col vecchio notAdjacent");
      }

      const emptyClue = addClue(puzzle, a.id, "adjacent", { targetId: objectTypeTargetId("door") });
      emptyClue.negate = true;
      const emptyPredicate = buildPredicate(emptyClue, puzzle);
      assertEqual(emptyPredicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "nessuna porta sulla mappa: negato è vero (verità vacua)");
    },
  },
  {
    name: "directionDistance senza distanza equivale al vecchio 'direction' (qualsiasi distanza positiva)",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "directionDistance", { direction: "north", distance: null, targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 0 }]]), true), true, "1 riga a nord va bene");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 4, col: 0 }]]), true), true, "4 righe a nord: comunque vero");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 1, col: 0 }]]), true), false, "a sud, non a nord");
    },
  },
  {
    name: "aloneInRoom con zoneId specifica richiede anche quella stanza (sostituisce il vecchio onlyPersonInRoom)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zoneStudio = addZone(puzzle.grid, "Studio", "#fff");
      const zoneCucina = addZone(puzzle.grid, "Cucina", "#eee");
      paintCellZone(puzzle.grid, 0, 0, zoneStudio.id);
      paintCellZone(puzzle.grid, 2, 2, zoneCucina.id);
      const clue = addClue(puzzle, a.id, "aloneInRoom", { zoneId: zoneStudio.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]]), false), false, "A è in cucina, non nello studio richiesto");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "A nello studio, B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), true, "A sola nello studio richiesto");
    },
  },
  {
    name: "predicate someoneInRoomWithProperty (adjacentTo): vero se qualcun altro nella stanza è accanto al bersaglio",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const door = placeObject(puzzle.grid, "door", 0, 2);
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "adjacentTo", targetId: door.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato, potrebbe unirsi ed essere accanto alla porta");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true), false, "B non è nella stanza di A");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]), true), true, "B è nella stanza di A ed è accanto alla porta");
    },
  },
  {
    name: "predicate someoneInRoomWithProperty (genere): vero se qualcun altro nella stanza ha il genere richiesto",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      b.gender = "female";
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "female" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), true, "B (donna) è nella stanza di A");
      b.gender = "male";
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), false, "B (uomo) non soddisfa 'donna'");
    },
  },
  {
    name: "predicate someoneInRoomWithProperty (sittingOn): vero se qualcun altro nella stanza è su un oggetto di quel tipo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      placeObject(puzzle.grid, "chair", 1, 1);
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "sittingOn", objectTypeId: "chair" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), true, "B è seduto sulla sedia nella stanza di A");
    },
  },
  {
    name: "predicate someoneInRoomWithProperty negato: vero solo se nessun altro nella stanza aveva la proprietà",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      b.gender = "male";
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "female" });
      clue.negate = true;
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), true, "B è un uomo, non una donna: negato è vero");
      b.gender = "female";
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), false, "B è donna: negato è falso");
    },
  },
  {
    name: "predicate extremeInDirection: vero se è la persona più a nord su tutta la mappa",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const clue = addClue(puzzle, a.id, "extremeInDirection", { direction: "north", scope: "map", property: "" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }]]), false), undefined, "B e C non ancora piazzati, potrebbero essere più a nord");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }], [b.id, { row: 0, col: 1 }]]), false), false, "B è più a nord di A");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }], [c.id, { row: 2, col: 2 }]]), true),
        true,
        "A è la più a nord di tutti"
      );
    },
  },
  {
    name: "predicate extremeInDirection con scope 'room': confronta solo con chi condivide la stanza",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 0, zone.id);
      paintCellZone(puzzle.grid, 2, 0, zone.id);
      const clue = addClue(puzzle, a.id, "extremeInDirection", { direction: "north", scope: "room", property: "" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(
        predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 0, col: 3 }]]), true),
        true,
        "B non è nella stanza di A: non conta anche se è più a nord in assoluto"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 1, col: 0 }]]), true),
        false,
        "B è nella stessa stanza e più a nord"
      );
    },
  },
  {
    name: "predicate extremeInDirection con filtro di proprietà: confronta solo con chi ha quella proprietà",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      a.gender = "female";
      b.gender = "male";
      const clue = addClue(puzzle, a.id, "extremeInDirection", { direction: "north", scope: "map", property: "female" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(
        predicate(mapOf([[a.id, { row: 4, col: 0 }], [b.id, { row: 0, col: 0 }]]), true),
        true,
        "B (uomo, più a nord) non conta: non ha la proprietà richiesta"
      );
      b.gender = "female";
      assertEqual(
        predicate(mapOf([[a.id, { row: 4, col: 0 }], [b.id, { row: 0, col: 0 }]]), true),
        false,
        "B ora è donna e più a nord: conta"
      );
    },
  },
  {
    name: "predicate inRowOrCol: vero solo sulla riga/colonna esatta (1-indicizzata come le etichette R1/C1)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "inRowOrCol", { axis: "row", index: 2 });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }]]), true), true, "riga 2 (indice 1) corrisponde a row:1");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false, "riga sbagliata");
    },
  },
  {
    name: "predicate rowOrColParity: vero solo su righe/colonne pari/dispari (1-indicizzate come le etichette R1/C1)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const oddCol = addClue(puzzle, a.id, "rowOrColParity", { axis: "col", parity: "odd" });
      const oddColPredicate = buildPredicate(oddCol, puzzle);
      assertEqual(oddColPredicate(mapOf([]), false), undefined, "non ancora piazzato");
      assertEqual(oddColPredicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "col:0 -> C1, dispari");
      assertEqual(oddColPredicate(mapOf([[a.id, { row: 0, col: 1 }]]), true), false, "col:1 -> C2, pari");
      assertEqual(oddColPredicate(mapOf([[a.id, { row: 0, col: 2 }]]), true), true, "col:2 -> C3, dispari");

      const evenRow = addClue(puzzle, a.id, "rowOrColParity", { axis: "row", parity: "even" });
      const evenRowPredicate = buildPredicate(evenRow, puzzle);
      assertEqual(evenRowPredicate(mapOf([[a.id, { row: 1, col: 0 }]]), true), true, "row:1 -> R2, pari");
      assertEqual(evenRowPredicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false, "row:0 -> R1, dispari");
    },
  },
  {
    name: "solvePuzzle rispetta un indizio rowOrColParity durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      addClue(puzzle, a.id, "rowOrColParity", { axis: "col", parity: "odd" });
      const room = addZone(puzzle.grid, "Salotto", "#eee");
      paintCellZone(puzzle.grid, 2, 2, room.id);
      paintCellZone(puzzle.grid, 3, 3, room.id);
      addClue(puzzle, null, "sameRoomTogether", { targetAId: puzzle.characters[1].id, targetBId: puzzle.characters[2].id });
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aPos = sol.find((p) => p.characterId === a.id);
        assert((aPos.col + 1) % 2 === 1, "A deve trovarsi in una colonna dispari (C1 o C3 su una griglia 4x4)");
      }
    },
  },
  {
    name: "describeClue: il prefisso 'Non' generico funziona per i tipi che iniziano con un verbo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const b = puzzle.characters[1];
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      clue.negate = true;
      assertEqual(describeClue(clue, puzzle), "Non è accanto a B.");
    },
  },
  {
    name: "describeClue: i tipi con negatedDescribe dedicato non usano il prefisso generico",
    fn: () => {
      const puzzle = basePuzzle();
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      const generic = addClue(puzzle, null, "noOneInRoom", { zoneId: zone.id });
      generic.negate = true;
      assertEqual(describeClue(generic, puzzle), 'Qualcuno si trova nella stanza "Studio".');

      const a = addCharacter(puzzle, "A", "person1");
      const someone = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "male" });
      someone.negate = true;
      assertEqual(describeClue(someone, puzzle), "Nessun altro nella sua stanza era un uomo.");
    },
  },
  {
    name: "characterClueTypeIds/genericClueTypeIds escludono i tipi legacy dalla creazione di nuovi indizi",
    fn: () => {
      const charIds = characterClueTypeIds();
      const genIds = genericClueTypeIds();
      for (const legacyId of ["notAdjacent", "notInRoom", "notSameRoomAs", "direction", "onlyPersonInRoom", "aloneWithVictim", "eitherAdjacent"]) {
        assert(!charIds.includes(legacyId), `${legacyId} non deve comparire tra i tipi selezionabili`);
      }
      assert(!genIds.includes("emptyRoomsCount"), "emptyRoomsCount (legacy, sostituito da roomsWithStateCount) non deve comparire");
      assert(charIds.includes("adjacent"), "i tipi non legacy restano selezionabili");
      assert(genIds.includes("roomsWithStateCount"), "i tipi generici non legacy restano selezionabili");
    },
  },
  {
    name: "solvePuzzle rispetta un indizio extremeInDirection durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      addClue(puzzle, a.id, "extremeInDirection", { direction: "north", scope: "map", property: "" });
      // A is always the strictly northmost, so rows 1-2 as one room always
      // catches B and the victim C together and never A — satisfying the
      // base rule for every solution, regardless of columns.
      const room = addZone(puzzle.grid, "Salotto", "#eee");
      for (let col = 0; col < 3; col++) {
        paintCellZone(puzzle.grid, 1, col, room.id);
        paintCellZone(puzzle.grid, 2, col, room.id);
      }
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aRow = sol.find((p) => p.characterId === a.id).row;
        for (const p of sol) {
          if (p.characterId === a.id) continue;
          assert(p.row > aRow, "A deve essere strettamente la più a nord di tutti");
        }
      }
    },
  },
  {
    name: "predicate onObjectType: vero solo se il personaggio si trova su un oggetto di quel tipo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "carpet", 1, 1);
      const clue = addClue(puzzle, a.id, "onObjectType", { objectTypeId: "carpet" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([])), undefined, "A non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]])), true, "A è sul tappeto");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]])), false, "A non è sul tappeto");
    },
  },
  {
    name: "predicate seated: vero su qualunque oggetto occupabile (sedia, sgabello, tappeto...), non solo su un tipo scelto",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "chair", 0, 0);
      placeObject(puzzle.grid, "stool", 1, 1);
      placeObject(puzzle.grid, "table", 2, 2); // non occupabile: non conta come "seduto"
      const clue = addClue(puzzle, a.id, "seated", {});
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([])), undefined, "A non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]])), true, "A è sulla sedia");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]])), true, "A è sullo sgabello");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]])), false, "A è sul tavolo, che non è un oggetto su cui ci si siede");
      assertEqual(predicate(mapOf([[a.id, { row: 3, col: 3 }]])), false, "A non è su nessun oggetto");
    },
  },
  {
    name: "describeClue: seated produce il testo atteso, negato compreso",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "seated", {});
      assertEqual(describeClue(clue, puzzle), "Era seduto/a.");
      clue.negate = true;
      assertEqual(describeClue(clue, puzzle), "Non era seduto/a.");
    },
  },
  {
    name: "predicate someoneInRoomWithProperty (seated): vero se qualcun altro nella stanza era seduto su un qualunque oggetto occupabile",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Salotto", "#fff");
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) paintCellZone(puzzle.grid, r, c, zone.id);
      placeObject(puzzle.grid, "stool", 1, 1);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "seated" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true),
        true,
        "B è nella stessa stanza di A, seduta sullo sgabello"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]), true),
        false,
        "B è nella stanza ma non è seduta da nessuna parte"
      );
    },
  },
  {
    name: "predicate orClue: vero se almeno uno dei due sotto-indizi è vero (es. sul tappeto oppure accanto alla pianta)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "carpet", 0, 0);
      const plant = placeObject(puzzle.grid, "plant", 3, 3);
      const clue = addClue(puzzle, a.id, "orClue", {
        a: { type: "onObjectType", params: { objectTypeId: "carpet" } },
        b: { type: "adjacent", params: { targetId: plant.id } },
      });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), true, "A è sul tappeto (primo ramo)");
      assertEqual(predicate(mapOf([[a.id, { row: 3, col: 2 }]]), true), true, "A è accanto alla pianta (secondo ramo)");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), true), false, "nessuno dei due rami è vero");
    },
  },
  {
    name: "predicate orClue: indeterminato finché nessun ramo è vero e almeno uno non è ancora deciso",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "orClue", {
        a: { type: "onObjectType", params: { objectTypeId: "carpet" } },
        b: { type: "adjacent", params: { targetId: b.id } },
      });
      const predicate = buildPredicate(clue, puzzle);
      // A non è sul tappeto (nessun tappeto sulla mappa: ramo falso e definitivo),
      // ma B non è ancora piazzato: il secondo ramo resta indeterminato.
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined);
    },
  },
  {
    name: "predicate orClue negato: vero solo se nessuno dei due rami è vero (De Morgan)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "carpet", 0, 0);
      const plant = placeObject(puzzle.grid, "plant", 3, 3);
      const clue = addClue(puzzle, a.id, "orClue", {
        a: { type: "onObjectType", params: { objectTypeId: "carpet" } },
        b: { type: "adjacent", params: { targetId: plant.id } },
      });
      clue.negate = true;
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false, "A è sul tappeto: negato è falso");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 1 }]]), true), true, "nessuno dei due rami: negato è vero");
    },
  },
  {
    name: "describeClue: orClue combina la descrizione dei due sotto-indizi con 'oppure'",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const plant = placeObject(puzzle.grid, "plant", 0, 0);
      const clue = addClue(puzzle, a.id, "orClue", {
        a: { type: "onObjectType", params: { objectTypeId: "carpet" } },
        b: { type: "adjacent", params: { targetId: plant.id } },
      });
      assertEqual(describeClue(clue, puzzle), "Si trova su un tappeto, oppure è accanto a una pianta.");
    },
  },
  {
    name: "solvePuzzle rispetta un indizio orClue durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(3, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      placeObject(puzzle.grid, "carpet", 0, 0);
      const plant = placeObject(puzzle.grid, "plant", 2, 3);
      addClue(puzzle, a.id, "orClue", {
        a: { type: "onObjectType", params: { objectTypeId: "carpet" } },
        b: { type: "adjacent", params: { targetId: plant.id } },
      });
      // Rows 1-2 as one room: whichever branch of the OR clue places A, at
      // least one full placement keeps the victim C sharing this room with
      // exactly one companion — satisfying the base rule without
      // constraining which branch actually gets used.
      const room = addZone(puzzle.grid, "Salotto", "#eee");
      for (let col = 0; col < 4; col++) {
        paintCellZone(puzzle.grid, 1, col, room.id);
        paintCellZone(puzzle.grid, 2, col, room.id);
      }
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aPos = sol.find((p) => p.characterId === a.id);
        const onCarpet = aPos.row === 0 && aPos.col === 0;
        const nearPlant = Math.abs(aPos.row - 2) + Math.abs(aPos.col - 3) === 1;
        assert(onCarpet || nearPlant, "A deve essere sul tappeto o accanto alla pianta");
      }
    },
  },
  {
    name: "predicate someoneAtDirectionDistance: vero se qualcun altro è esattamente a quella distanza/direzione da lui",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const clue = addClue(puzzle, a.id, "someoneAtDirectionDistance", { direction: "north", distance: 2 });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }]]), false), undefined, "B e C non ancora piazzati, potrebbero trovarsi lì");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 0, col: 0 }]]), false), true, "B è 2 righe a nord di A");
      assertEqual(
        predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 1, col: 3 }], [c.id, { row: 3, col: 4 }]]), true),
        false,
        "nessuno dei due è 2 righe a nord di A"
      );
    },
  },
  {
    name: "predicate someoneAtDirectionDistance senza distanza: qualsiasi distanza positiva nella direzione va bene",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "someoneAtDirectionDistance", { direction: "south", distance: null });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 4, col: 0 }]]), true), true, "B è a sud di A, a qualunque distanza");
      assertEqual(predicate(mapOf([[a.id, { row: 4, col: 0 }], [b.id, { row: 0, col: 0 }]]), true), false, "B è a nord, non a sud");
    },
  },
  {
    name: "predicate someoneAtDirectionDistance negato: vero solo se nessuno è in quella direzione/distanza",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "someoneAtDirectionDistance", { direction: "north", distance: 2 });
      clue.negate = true;
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 0, col: 0 }]]), true), false, "B è 2 righe a nord: negato è falso");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 4, col: 4 }]]), true), true, "nessuno è 2 righe a nord: negato è vero");
    },
  },
  {
    name: "predicate generico noOneInRowOrCol: falso appena qualcuno è lì, vero solo a completamento",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, null, "noOneInRowOrCol", { axis: "col", index: 3 });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 2 }]]), false), false, "A è nella colonna 3 (indice 2)");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "A altrove, B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true), true, "nessuno dei due nella colonna 3");
    },
  },
  {
    name: "describeClue: someoneAtDirectionDistance e noOneInRowOrCol producono il testo atteso, negato compreso",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "someoneAtDirectionDistance", { direction: "north", distance: 2 });
      assertEqual(describeClue(clue, puzzle), "C'è qualcuno a 2 righe a nord di lui/lei.");
      clue.negate = true;
      assertEqual(describeClue(clue, puzzle), "Nessuno si trova a 2 righe a nord di lui/lei.");

      const generic = addClue(puzzle, null, "noOneInRowOrCol", { axis: "row", index: 1 });
      assertEqual(describeClue(generic, puzzle), "Nessuno si trova nella riga 1.");
      generic.negate = true;
      assertEqual(describeClue(generic, puzzle), "Qualcuno si trova nella riga 1.");
    },
  },
  {
    name: "solvePuzzle rispetta un indizio someoneAtDirectionDistance durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      addClue(puzzle, a.id, "someoneAtDirectionDistance", { direction: "east", distance: 1 });
      // A small room on different rows/cols so a completion exists where the
      // victim C and exactly one companion share it — enough for the base
      // rule to be satisfiable alongside the east-distance clue this test
      // is actually about (the clue itself is loose enough that plenty of
      // other completions remain, some of which the base rule now prunes).
      const room = addZone(puzzle.grid, "Salotto", "#eee");
      paintCellZone(puzzle.grid, 0, 1, room.id);
      paintCellZone(puzzle.grid, 1, 2, room.id);
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aPos = sol.find((p) => p.characterId === a.id);
        // "east by 1" only constrains the column (matches isDirectionDistance,
        // which projects onto the relevant axis) — the row can be anything.
        const someoneOneColEast = sol.some((p) => p.characterId !== a.id && p.col === aPos.col + 1);
        assert(someoneOneColEast, "qualcuno deve trovarsi esattamente 1 colonna a est di A");
      }
    },
  },
  {
    name: "predicate zoneAdjacentTo: vero se la propria stanza confina con quella indicata",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const zoneA = addZone(puzzle.grid, "A-Room", "#fff");
      const zoneB = addZone(puzzle.grid, "B-Room", "#eee");
      const zoneC = addZone(puzzle.grid, "C-Room", "#ddd");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      paintCellZone(puzzle.grid, 0, 1, zoneA.id);
      paintCellZone(puzzle.grid, 0, 2, zoneB.id);
      paintCellZone(puzzle.grid, 0, 3, zoneB.id);
      paintCellZone(puzzle.grid, 3, 0, zoneC.id);
      paintCellZone(puzzle.grid, 3, 1, zoneC.id);
      const clue = addClue(puzzle, a.id, "zoneAdjacentTo", { zoneId: zoneB.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([])), undefined, "A non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]])), true, "la stanza A confina con la stanza B");
      const farClue = addClue(puzzle, a.id, "zoneAdjacentTo", { zoneId: zoneC.id });
      const farPredicate = buildPredicate(farClue, puzzle);
      assertEqual(farPredicate(mapOf([[a.id, { row: 0, col: 0 }]])), false, "la stanza A non confina con la stanza C");
    },
  },
  {
    name: "predicate zoneAdjacentTo: bersaglio può essere un personaggio, risolto alla sua stanza dinamicamente",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zoneA = addZone(puzzle.grid, "A-Room", "#fff");
      const zoneB = addZone(puzzle.grid, "B-Room", "#eee");
      const zoneC = addZone(puzzle.grid, "C-Room", "#ddd");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      paintCellZone(puzzle.grid, 0, 1, zoneA.id);
      paintCellZone(puzzle.grid, 0, 2, zoneB.id);
      paintCellZone(puzzle.grid, 0, 3, zoneB.id);
      paintCellZone(puzzle.grid, 3, 0, zoneC.id);
      paintCellZone(puzzle.grid, 3, 1, zoneC.id);
      const clue = addClue(puzzle, a.id, "zoneAdjacentTo", { zoneId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]])), undefined, "B non ancora piazzato");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 2 }]])),
        true,
        "B è nella stanza B, adiacente alla stanza A di fronte"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 3, col: 0 }]])),
        false,
        "B è nella stanza C, non adiacente alla stanza A"
      );
    },
  },
  {
    name: "predicate rowOrColAdjacentTo: vero se la riga/colonna è adiacente (non uguale) a quella del bersaglio",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "rowOrColAdjacentTo", { axis: "row", targetId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }]])), undefined, "B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 3, col: 4 }]])), true, "riga 2 adiacente alla riga 3");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 2, col: 4 }]])), false, "stessa riga: non è 'adiacente'");
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }], [b.id, { row: 4, col: 4 }]])), false, "righe troppo distanti");
    },
  },
  {
    name: "predicate inRowOrColWithAny: vero se condivide l'asse con almeno uno dei bersagli elencati",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const clue = addClue(puzzle, a.id, "inRowOrColWithAny", { axis: "col", targetIds: [b.id, c.id] });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }]])), undefined, "né B né C ancora piazzati");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 1 }], [b.id, { row: 2, col: 1 }]])), true, "condivide la colonna con B");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 1 }], [b.id, { row: 2, col: 3 }], [c.id, { row: 3, col: 4 }]])),
        false,
        "colonna diversa da entrambi, entrambi piazzati"
      );

      const emptyClue = addClue(puzzle, a.id, "inRowOrColWithAny", { axis: "col", targetIds: [] });
      const emptyPredicate = buildPredicate(emptyClue, puzzle);
      assertEqual(emptyPredicate(mapOf([[a.id, { row: 0, col: 0 }]])), false, "nessun bersaglio selezionato");
    },
  },
  {
    name: "predicate aloneWithPersonProperty: vero se l'unica altra persona nella stanza ha quella proprietà",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      b.gender = "male";
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "aloneWithPersonProperty", { property: "male" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), false), undefined, "B non ancora piazzato");
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]]), false),
        undefined,
        "C non ancora piazzato, potrebbe unirsi"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }], [c.id, { row: 3, col: 3 }]]), true),
        true,
        "sola con B (uomo), C altrove"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }], [c.id, { row: 1, col: 1 }]]), true),
        false,
        "C si unisce: non più sola con una sola persona"
      );
      b.gender = "female";
      assertEqual(
        predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }], [c.id, { row: 3, col: 3 }]]), true),
        false,
        "B è donna, non uomo"
      );
    },
  },
  {
    name: "predicate generico roomsWithStateCount: conta le stanze vuote o piene a seconda dello stato scelto",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      addZone(puzzle.grid, "Studio", "#fff");
      addZone(puzzle.grid, "Cucina", "#eee");
      const [zoneA, zoneB] = puzzle.grid.zones;
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      paintCellZone(puzzle.grid, 2, 2, zoneB.id);

      const emptyClue = addClue(puzzle, null, "roomsWithStateCount", { count: 1, state: "empty" });
      const emptyPredicate = buildPredicate(emptyClue, puzzle);
      assertEqual(
        emptyPredicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true),
        true,
        "Studio occupato, Cucina vuota"
      );

      const occupiedClue = addClue(puzzle, null, "roomsWithStateCount", { count: 2, state: "occupied" });
      const occupiedPredicate = buildPredicate(occupiedClue, puzzle);
      assertEqual(
        occupiedPredicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]), true),
        false,
        "solo una stanza occupata, non due"
      );
      assertEqual(
        occupiedPredicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true),
        true,
        "entrambe le stanze occupate"
      );

      const tooManyClue = addClue(puzzle, null, "roomsWithStateCount", { count: 1, state: "occupied" });
      const tooManyPredicate = buildPredicate(tooManyClue, puzzle);
      assertEqual(
        tooManyPredicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), false),
        false,
        "già 2 stanze occupate ma ne bastava 1: falso definitivo anche prima del completamento"
      );
    },
  },
  {
    name: "predicate generico sameRoomSizeAs: confronta il numero di caselle delle stanze di due bersagli",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zoneSmall1 = addZone(puzzle.grid, "Small1", "#fff");
      const zoneSmall2 = addZone(puzzle.grid, "Small2", "#eee");
      const zoneBig = addZone(puzzle.grid, "Big", "#ddd");
      paintCellZone(puzzle.grid, 0, 0, zoneSmall1.id);
      paintCellZone(puzzle.grid, 0, 1, zoneSmall2.id);
      paintCellZone(puzzle.grid, 3, 0, zoneBig.id);
      paintCellZone(puzzle.grid, 3, 1, zoneBig.id);
      paintCellZone(puzzle.grid, 3, 2, zoneBig.id);
      const clue = addClue(puzzle, null, "sameRoomSizeAs", { targetAId: a.id, targetBId: b.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]])), undefined, "B non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 0, col: 1 }]])), true, "entrambe le stanze hanno 1 casella");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 3, col: 0 }]])), false, "1 casella contro 3");
    },
  },
  {
    name: "predicate generico noOneWithProperty: nessuno con quella proprietà, ovunque o in una stanza specifica",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      a.gender = "male";
      b.gender = "female";
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);

      const wideClue = addClue(puzzle, null, "noOneWithProperty", { property: "male" });
      const widePredicate = buildPredicate(wideClue, puzzle);
      assertEqual(widePredicate(mapOf([[a.id, { row: 1, col: 1 }]]), false), false, "A (uomo) è già piazzato, ovunque sia");
      assertEqual(widePredicate(mapOf([[b.id, { row: 1, col: 1 }]]), false), undefined, "A non ancora piazzato, potrebbe essere lui l'uomo");
      assertEqual(
        widePredicate(mapOf([[a.id, { row: 1, col: 1 }], [b.id, { row: 2, col: 2 }]]), true),
        false,
        "A è uomo, ovunque si trovi"
      );

      const roomClue = addClue(puzzle, null, "noOneWithProperty", { zoneId: zone.id, property: "male" });
      const roomPredicate = buildPredicate(roomClue, puzzle);
      assertEqual(
        roomPredicate(mapOf([[a.id, { row: 1, col: 1 }], [b.id, { row: 2, col: 2 }]]), true),
        true,
        "A (uomo) non è nello Studio"
      );
      assertEqual(
        roomPredicate(mapOf([[a.id, { row: 0, col: 0 }], [b.id, { row: 2, col: 2 }]]), true),
        false,
        "A (uomo) è nello Studio"
      );
    },
  },
  {
    name: "predicate generico noOneWithProperty: onlyGender combina il filtro di genere con la proprietà (es. 'nessuna donna seduta su uno sgabello')",
    fn: () => {
      const puzzle = basePuzzle();
      const anna = addCharacter(puzzle, "Anna", "person1");
      const bruno = addCharacter(puzzle, "Bruno", "person2");
      anna.gender = "female";
      bruno.gender = "male";
      placeObject(puzzle.grid, "stool", 1, 1);
      const clue = addClue(puzzle, null, "noOneWithProperty", {
        onlyGender: "female",
        property: "sittingOn",
        objectTypeId: "stool",
      });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(
        predicate(mapOf([[bruno.id, { row: 1, col: 1 }]]), false),
        undefined,
        "Bruno è un uomo (escluso dal filtro): irrilevante dove si trovi, Anna non è ancora piazzata"
      );
      assertEqual(
        predicate(mapOf([[bruno.id, { row: 1, col: 1 }], [anna.id, { row: 0, col: 0 }]]), true),
        true,
        "Bruno è sullo sgabello ma è un uomo; Anna (donna) non ci è seduta"
      );
      assertEqual(
        predicate(mapOf([[anna.id, { row: 1, col: 1 }], [bruno.id, { row: 0, col: 0 }]]), true),
        false,
        "Anna (donna) è seduta sullo sgabello"
      );
    },
  },
  {
    name: "predicate generico emptyRoomsSameSize: conta le stanze vuote e verifica che abbiano lo stesso numero di caselle",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const studio = addZone(puzzle.grid, "Studio", "#fff"); // 1 cella
      paintCellZone(puzzle.grid, 0, 0, studio.id);
      const cucina = addZone(puzzle.grid, "Cucina", "#eee"); // 1 cella
      paintCellZone(puzzle.grid, 1, 1, cucina.id);
      const salotto = addZone(puzzle.grid, "Salotto", "#ddd"); // 2 celle
      paintCellZone(puzzle.grid, 2, 2, salotto.id);
      paintCellZone(puzzle.grid, 2, 3, salotto.id);

      const clue = addClue(puzzle, null, "emptyRoomsSameSize", { count: 2 });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([]), false), undefined, "nessuno ancora piazzato");
      // A in Salotto: Studio e Cucina restano entrambe vuote e hanno la stessa dimensione (1 cella ciascuna).
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 2 }]]), true), true, "Studio e Cucina vuote, stesso numero di caselle (1)");
      // A in Studio: Cucina e Salotto restano vuote, ma hanno dimensioni diverse (1 vs 2).
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]]), true), false, "Cucina e Salotto vuote, ma di dimensioni diverse");

      const guaranteedFalseClue = addClue(puzzle, null, "emptyRoomsSameSize", { count: 3 });
      const guaranteedFalsePredicate = buildPredicate(guaranteedFalseClue, puzzle);
      assertEqual(
        guaranteedFalsePredicate(mapOf([[a.id, { row: 0, col: 0 }]]), false),
        false,
        "con A già in Studio, al massimo 2 stanze possono restare vuote: mai 3, anche prima del completamento"
      );
    },
  },
  {
    name: "solvePuzzle rispetta un indizio emptyRoomsSameSize durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1", true);
      const studio = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, studio.id);
      const cucina = addZone(puzzle.grid, "Cucina", "#eee");
      paintCellZone(puzzle.grid, 1, 1, cucina.id);
      // Un terzo, capiente room per ospitare la vittima con esattamente un
      // compagno (regola base), lasciando Studio e Cucina libere di restare
      // entrambe vuote (stessa dimensione, 1 cella ciascuna).
      const salotto = addZone(puzzle.grid, "Salotto", "#ddd");
      paintCellZone(puzzle.grid, 2, 2, salotto.id);
      paintCellZone(puzzle.grid, 3, 3, salotto.id);
      addClue(puzzle, null, "emptyRoomsSameSize", { count: 2 });
      addClue(puzzle, null, "sameRoomTogether", { targetAId: b.id, targetBId: c.id });
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const occupiedStudio = sol.some((p) => p.row === 0 && p.col === 0);
        const occupiedCucina = sol.some((p) => p.row === 1 && p.col === 1);
        assert(!occupiedStudio && !occupiedCucina, "Studio e Cucina devono restare entrambe vuote");
      }
    },
  },
  {
    name: "solvePuzzle rispetta un indizio zoneAdjacentTo durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      const zoneA = addZone(puzzle.grid, "A-Room", "#fff");
      const zoneB = addZone(puzzle.grid, "B-Room", "#eee");
      const zoneC = addZone(puzzle.grid, "C-Room", "#ddd");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      paintCellZone(puzzle.grid, 0, 1, zoneB.id); // adjacent to A-Room
      paintCellZone(puzzle.grid, 3, 3, zoneC.id); // far from A-Room
      // A extra room, on different rows/cols from each other and from every
      // cell above, so a completion exists where the victim C shares it
      // with exactly one companion — A-Room/B-Room/C-Room are all single
      // cells and could never host two people at once, so without this the
      // base rule would be unsatisfiable no matter where anyone stands.
      const extra = addZone(puzzle.grid, "Extra", "#ccc");
      paintCellZone(puzzle.grid, 1, 2, extra.id);
      paintCellZone(puzzle.grid, 2, 3, extra.id);
      addClue(puzzle, a.id, "zoneAdjacentTo", { zoneId: zoneA.id });
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aPos = sol.find((p) => p.characterId === a.id);
        assertEqual(aPos.row, 0, "A deve trovarsi nell'unica stanza adiacente alla A-Room");
        assertEqual(aPos.col, 1);
      }
    },
  },
  {
    name: "predicate someoneAtDirectionDistance con property='custom': filtra chi conta con un indizio annidato qualsiasi",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const bagno = addZone(puzzle.grid, "Bagno", "#fff");
      const corridoio = addZone(puzzle.grid, "Corridoio", "#eee");
      const lontano = addZone(puzzle.grid, "Lontano", "#ddd");
      paintCellZone(puzzle.grid, 0, 3, bagno.id);
      paintCellZone(puzzle.grid, 0, 2, corridoio.id); // adjacent to Bagno
      paintCellZone(puzzle.grid, 0, 0, lontano.id); // not adjacent to Bagno
      const clue = addClue(puzzle, a.id, "someoneAtDirectionDistance", {
        direction: "north",
        distance: 2,
        property: "custom",
        customClue: { type: "zoneAdjacentTo", params: { zoneId: bagno.id } },
      });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(
        predicate(mapOf([[a.id, { row: 2, col: 2 }], [c.id, { row: 0, col: 0 }]]), false),
        undefined,
        "C (in una stanza non adiacente al bagno) non soddisfa, ma B non è ancora piazzato e potrebbe"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 2, col: 2 }], [b.id, { row: 0, col: 2 }], [c.id, { row: 0, col: 0 }]]), true),
        true,
        "B è 2 righe a nord di A ed è in una stanza adiacente al bagno"
      );
      assertEqual(
        predicate(mapOf([[a.id, { row: 2, col: 2 }], [b.id, { row: 4, col: 4 }], [c.id, { row: 0, col: 0 }]]), true),
        false,
        "nessuno alla posizione giusta soddisfa anche la condizione annidata"
      );
    },
  },
  {
    name: "describeClue: someoneAtDirectionDistance con property='custom' descrive la condizione annidata",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      const bagno = addZone(puzzle.grid, "Bagno", "#fff");
      const clue = addClue(puzzle, a.id, "someoneAtDirectionDistance", {
        direction: "north",
        distance: 2,
        property: "custom",
        customClue: { type: "zoneAdjacentTo", params: { zoneId: bagno.id } },
      });
      assertEqual(
        describeClue(clue, puzzle),
        'C\'è qualcuno a 2 righe a nord di lui/lei che verificava: Si trova in una stanza adiacente a "Bagno".'
      );
    },
  },
  {
    name: "describeClue: orClue mostra 'Non' quando uno dei due rami è negato",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "orClue", {
        a: { type: "adjacent", params: { targetId: b.id }, negate: true },
        b: { type: "inCorner", params: {} },
      });
      assertEqual(describeClue(clue, puzzle), "Non è accanto a B, oppure si trova in un angolo della mappa.");
    },
  },
  {
    name: "solvePuzzle rispetta un indizio someoneAtDirectionDistance con property='custom' durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(5, 5);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      const bagno = addZone(puzzle.grid, "Bagno", "#fff");
      addZone(puzzle.grid, "Corridoio", "#eee");
      const [, corridoio] = puzzle.grid.zones;
      paintCellZone(puzzle.grid, 4, 4, bagno.id);
      paintCellZone(puzzle.grid, 4, 3, corridoio.id); // adjacent to Bagno
      // An extra room, on rows/cols the clue leaves free, so a completion
      // exists where the victim C shares it with exactly one companion —
      // Bagno/Corridoio are both single cells (Corridoio ends up holding
      // whoever satisfies the clue, alone), so without this the base rule
      // would be unsatisfiable no matter where anyone stands.
      const extra = addZone(puzzle.grid, "Extra", "#ddd");
      paintCellZone(puzzle.grid, 3, 0, extra.id);
      paintCellZone(puzzle.grid, 0, 1, extra.id);
      addClue(puzzle, a.id, "someoneAtDirectionDistance", {
        direction: "south",
        distance: 1,
        property: "custom",
        customClue: { type: "zoneAdjacentTo", params: { zoneId: bagno.id } },
      });
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aPos = sol.find((p) => p.characterId === a.id);
        const qualifier = sol.find((p) => p.characterId !== a.id && p.row === 4 && p.col === 3);
        assert(qualifier, "deve esserci qualcuno nel Corridoio (l'unica stanza adiacente al Bagno)");
        assertEqual(qualifier.row, aPos.row + 1, "e deve trovarsi esattamente una riga a sud di A");
      }
    },
  },
  {
    name: "predicate adjacent con bersaglio-stanza: vero se accanto ad almeno una cella della zona",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const salotto = addZone(puzzle.grid, "Salotto", "#fff");
      paintCellZone(puzzle.grid, 0, 0, salotto.id);
      paintCellZone(puzzle.grid, 0, 1, salotto.id);
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: salotto.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([])), undefined, "A non ancora piazzato");
      assertEqual(predicate(mapOf([[a.id, { row: 1, col: 0 }]])), true, "adiacente a (0,0)");
      assertEqual(predicate(mapOf([[a.id, { row: 3, col: 3 }]])), false, "troppo lontano dalla stanza");
    },
  },
  {
    name: "predicate facing con bersaglio-stanza: la generalizzazione a zone raggiunge automaticamente anche gli altri tipi",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const cucina = addZone(puzzle.grid, "Cucina", "#fff");
      paintCellZone(puzzle.grid, 2, 2, cucina.id);
      const clue = addClue(puzzle, a.id, "facing", { targetId: cucina.id });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(mapOf([[a.id, { row: 2, col: 0 }]])), true, "stessa riga della cucina");
      assertEqual(predicate(mapOf([[a.id, { row: 0, col: 0 }]])), false, "né riga né colonna in comune con la cucina");
    },
  },
  {
    name: "describeClue: adjacent con bersaglio-stanza usa il nome della stanza tra virgolette",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const salotto = addZone(puzzle.grid, "Salotto", "#fff");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: salotto.id });
      assertEqual(describeClue(clue, puzzle), 'È accanto a "Salotto".');
    },
  },
  {
    name: "solvePuzzle rispetta un indizio adjacent con bersaglio-stanza durante la ricerca reale",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1", true);
      const salotto = addZone(puzzle.grid, "Salotto", "#fff");
      paintCellZone(puzzle.grid, 0, 0, salotto.id);
      // An extra room, away from Salotto and the cells adjacent to it, so a
      // completion exists where the victim C shares it with exactly one
      // companion — Salotto itself is a single cell and nobody is required
      // to actually be in it, so without a second room the base rule would
      // be unsatisfiable no matter where anyone stands.
      const extra = addZone(puzzle.grid, "Extra", "#eee");
      paintCellZone(puzzle.grid, 2, 2, extra.id);
      paintCellZone(puzzle.grid, 3, 3, extra.id);
      addClue(puzzle, a.id, "adjacent", { targetId: salotto.id });
      const report = checkUniqueness(puzzle);
      assert(report.solutionCount > 0, "deve esistere almeno una soluzione");
      for (const sol of report.solutions) {
        const aPos = sol.find((p) => p.characterId === a.id);
        const adjacentToSalotto = (aPos.row === 0 && aPos.col === 1) || (aPos.row === 1 && aPos.col === 0);
        assert(adjacentToSalotto, "A deve trovarsi in una cella adiacente al Salotto: (0,1) o (1,0)");
      }
    },
  },
];
