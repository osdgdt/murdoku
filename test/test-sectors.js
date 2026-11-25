// Più mappe affiancate (Far West: il treno, una mappa per vagone): le colonne sono numerate da un vagone all'altro e ognuna
// ha una persona, le righe si ripetono in ogni vagone e in ciascuno ne vale una per riga.
import { createPuzzle, addCharacter, addClue, validatePuzzleShape } from "../src/model/puzzle.js";
import {
  createGrid,
  resizeGrid,
  addZone,
  paintCellZone,
  setBlocked,
  wallBetween,
  isWallEdge,
  edgeCells,
  edgeObjectsAt,
  placeObject,
  removeObject,
} from "../src/model/grid.js";
import { buildPredicates } from "../src/solver/predicates/index.js";
import { placeElevator, placeStairs, wayProblems } from "../src/model/floors.js";
import { typeIdsFor } from "../src/editor/clueDraft.js";
import { withDeclared } from "../src/model/declared.js";
import { objectTypeTargetId } from "../src/model/icons.js";
import { describeClue } from "../src/model/clueTypes.js";
import { zonesAreAdjacent } from "../src/solver/predicates/helpers.js";
import { addRole, setEveryoneHasRole, roleProblems } from "../src/model/roles.js";
import { checkUniqueness } from "../src/solver/validator.js";
import {
  setSectors,
  rowKeyFn,
  colKeyFn,
  capacityOf,
  hasSectors,
  sectorProblems,
  sectorAt,
  sharedAxes,
  isFloorPadding,
} from "../src/model/sectors.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { createBoardState, handleCellHold, lineCells } from "../src/player/board.js";
import { referenceSolutions } from "./reference-solver.js";
import { randomPuzzle } from "./helpers/random-puzzle.js";
import { assert, assertEqual } from "./assert.js";

const keyOf = (solution) =>
  solution
    .map((p) => `${p.characterId}:${p.row},${p.col}`)
    .sort()
    .join("|");

// The random cases sometimes aim a clue at a piece of furniture that a later one replaced: a clue about nothing, which the
// search and the human reasonings may read differently (no real case has it).
const aimsAtNothing = (puzzle) =>
  puzzle.clues.some(
    (c) => String(c.params?.targetId ?? "").startsWith("obj_") && !puzzle.grid.objects.some((o) => o.id === c.params.targetId)
  );

const cellsText = (cells) => cells.map((c) => `${c.row},${c.col}`).join(" ");

export const tests = [
  {
    name: "vagoni: si tagliano le colonne (almeno due, senza buchi), la chiave di riga e la capienza; senza vagoni nulla cambia",
    fn: () => {
      const grid = createGrid(4, 7);
      assert(!hasSectors(grid) && capacityOf(grid) === 4 && rowKeyFn(grid)(2, 5) === 2, "senza vagoni: la riga è il suo numero");
      assert(!setSectors(grid, [3, 3]), "la somma non fa 7");
      assert(!setSectors(grid, [4, 0, 3]) && !setSectors(grid, [4, 1.5, 1.5]));
      assert(setSectors(grid, [4, 3], ["Merci", "Locomotiva"]));
      assertEqual(grid.sectors.map((s) => `${s.name}:${s.first}-${s.last}`).join(" "), "Merci:0-3 Locomotiva:4-6");
      assertEqual(capacityOf(grid), 4 + 3, "ogni vagone ne tiene min(righe, larghezza)");
      const key = rowKeyFn(grid);
      assert(key(1, 0) === key(1, 3) && key(1, 3) !== key(1, 4) && key(1, 4) !== key(2, 4), "stessa riga nello stesso vagone");
      assertEqual(sectorAt(grid, 0, 5).name, "Locomotiva");
      assertEqual(sectorProblems(grid).length, 0);
      grid.sectors[1].first = 5;
      assert(sectorProblems(grid).length > 0, "buco fra i vagoni");
      assert(setSectors(grid, null) && !("sectors" in grid), "togliere i vagoni");
    },
  },
  {
    name: "vagoni: ridimensionare la mappa riadatta i vagoni (l'ultimo prende la differenza); troppo stretta, tornano una mappa sola",
    fn: () => {
      const grid = createGrid(4, 8);
      setSectors(grid, [4, 4]);
      const wider = resizeGrid(grid, 4, 10);
      assertEqual(wider.sectors.map((s) => s.last).join(), "3,9");
      const narrower = resizeGrid(grid, 4, 6);
      assertEqual(narrower.sectors.map((s) => s.last).join(), "3,5");
      assert(!("sectors" in resizeGrid(grid, 4, 4)), "un vagone solo non è più un treno");
    },
  },
  {
    name: "vagoni: la validazione conta le persone per vagone, non per riga della mappa intera",
    fn: () => {
      const puzzle = createPuzzle("Treno");
      puzzle.grid = resizeGrid(puzzle.grid, 3, 6);
      setSectors(puzzle.grid, [3, 3]);
      for (let i = 0; i < 6; i++) addCharacter(puzzle, `P${i}`, undefined, i === 5);
      puzzle.solution = { placements: [] };
      assert(!validatePuzzleShape(puzzle).errors.some((e) => /Troppi personaggi/.test(e)), "6 persone in 6 colonne, due vagoni da 3 righe");
      addCharacter(puzzle, "Extra");
      assert(
        validatePuzzleShape(puzzle).errors.some((e) => /Troppi personaggi/.test(e)),
        "una persona in più di quante colonne"
      );
      const plain = createPuzzle("Piano");
      plain.grid = resizeGrid(plain.grid, 3, 6);
      for (let i = 0; i < 4; i++) addCharacter(plain, `P${i}`, undefined, i === 3);
      plain.solution = { placements: [] };
      assert(
        validatePuzzleShape(plain).errors.some((e) => /Troppi personaggi/.test(e)),
        "senza vagoni: al massimo 3 (le righe)"
      );
      plain.grid.sectors = [{ id: "s", name: "x", first: 0, last: 2 }];
      assert(validatePuzzleShape(plain).errors.length > 0, "un vagone solo e che non copre le colonne");
    },
  },
  {
    name: "vagoni: il solver conta come la ricerca di riferimento (casi casuali con la mappa tagliata in due vagoni), anche col solutore umano",
    fn: () => {
      let withSolutions = 0;
      let unique = 0;
      for (let seed = 1; seed <= 450; seed++) {
        const puzzle = randomPuzzle(seed);
        if (aimsAtNothing(puzzle)) continue;
        const cols = puzzle.grid.size.cols;
        const left = 1 + (seed % (cols - 1));
        // wagons side by side on the even seeds, floors one above the other on the odd ones (the grids are square)
        setSectors(puzzle.grid, [left, cols - left], [], seed % 2 ? "row" : "col");
        const expected = referenceSolutions(puzzle).sort();
        for (const options of [{ forwardCheck: false }, { forwardCheck: true }, { forwardCheck: true, forwardCheckMinRemaining: 2 }]) {
          const actual = solvePuzzle(puzzle, { maxSolutions: 100000, incremental: true, ...options })
            .map(keyOf)
            .sort();
          assertEqual(actual.join("\n"), expected.join("\n"), `caso ${seed}: soluzioni (${JSON.stringify(options)})`);
        }
        if (expected.length > 0) withSolutions++;
        const human = humanSolve(puzzle, { maxWork: 5e6 });
        if (human.status === "limit") continue;
        if (expected.length === 0) assertEqual(human.status, "contradiction", `caso ${seed}: nessuna soluzione`);
        else if (expected.length > 1) assertEqual(human.status, "ambiguous", `caso ${seed}: più soluzioni`);
        else {
          unique++;
          assertEqual(human.status, "solved", `caso ${seed}: una soluzione`);
          const want = new Map(expected[0].split("|").map((s) => s.split(":")));
          for (const [id, cell] of human.placements) assertEqual(`${cell.row},${cell.col}`, want.get(id), `caso ${seed}: dove sta ${id}`);
        }
      }
      assert(withSolutions >= 40 && unique >= 3, `servono casi con soluzioni (${withSolutions}) e con una sola (${unique})`);
    },
  },
  {
    name: "solutore umano: stessa risposta della ricerca di riferimento su casi casuali con indizi di ogni tipo (anche «qualcuno è vicino a X» con X ancora da piazzare)",
    fn: () => {
      for (const seed of [44, ...Array.from({ length: 150 }, (_, i) => i + 1)]) {
        const puzzle = randomPuzzle(seed);
        if (aimsAtNothing(puzzle)) continue;
        const expected = referenceSolutions(puzzle);
        const human = humanSolve(puzzle, { maxWork: 5e6 });
        if (human.status === "limit") continue;
        const want = expected.length === 0 ? "contradiction" : expected.length > 1 ? "ambiguous" : "solved";
        assertEqual(human.status, want, `caso ${seed}`);
      }
    },
  },
  {
    name: "vagoni: «un fuorilegge per vagone» — il solver conta come la forza bruta; senza vagoni la regola è un errore",
    fn: () => {
      // 3 righe × 4 colonne in due vagoni (colonne 0-1 e 2-3), ognuno una stanza: 4 persone, due per vagone.
      const puzzle = createPuzzle("Treno");
      puzzle.grid = resizeGrid(puzzle.grid, 3, 4);
      setSectors(puzzle.grid, [2, 2], ["Merci", "Locomotiva"]);
      const left = addZone(puzzle.grid, "Merci", "#cfe");
      const right = addZone(puzzle.grid, "Loco", "#fec");
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, (c < 2 ? left : right).id);
      const outlaw = addRole(puzzle, "Fuorilegge", "onePerSector");
      setEveryoneHasRole(puzzle, false);
      const [v, a, b, c] = [
        addCharacter(puzzle, "V", "person1", true),
        addCharacter(puzzle, "A"),
        addCharacter(puzzle, "B"),
        addCharacter(puzzle, "C"),
      ];
      puzzle.solution = { placements: [] };
      assertEqual(roleProblems(puzzle).length, 0);

      const wagon = (col) => (col < 2 ? 0 : 1);
      // all the ways to stand: a column each, a row each inside a wagon; the victim with exactly one other (so two per wagon, always)
      const count = (extra) => {
        const cells = [];
        for (let r = 0; r < 3; r++) for (let col = 0; col < 4; col++) cells.push([r, col]);
        let n = 0;
        for (const pv of cells)
          for (const pa of cells)
            for (const pb of cells)
              for (const pc of cells) {
                const all = [pv, pa, pb, pc];
                if (new Set(all.map(([, col]) => col)).size < 4) continue;
                if (new Set(all.map(([r, col]) => `${wagon(col)}:${r}`)).size < 4) continue;
                if (all.filter(([, col]) => wagon(col) === wagon(pv[1])).length !== 2) continue;
                if (extra(all)) n++;
              }
        return n;
      };
      const plain = checkUniqueness(puzzle, { maxSolutions: 100000 });
      assert(plain.exhausted);
      // somebody is an outlaw in each wagon, always possible: every way to stand counts
      assertEqual(
        plain.solutionCount,
        count(() => true),
        "senza altri indizi"
      );
      // A and B are both outlaws: one per wagon, so they stand in different wagons
      addClue(puzzle, a.id, "hasRole", { roleId: outlaw.id });
      addClue(puzzle, b.id, "hasRole", { roleId: outlaw.id });
      const apart = checkUniqueness(puzzle, { maxSolutions: 100000 });
      assert(apart.exhausted);
      assertEqual(
        apart.solutionCount,
        count(([, pa, pb]) => wagon(pa[1]) !== wagon(pb[1])),
        "A e B in vagoni diversi"
      );
      // the victim and C are not outlaws: A and B (the only two) must be one in each wagon, and V and C fill the rest
      addClue(puzzle, c.id, "hasRole", { roleId: outlaw.id });
      assertEqual(checkUniqueness(puzzle, { maxSolutions: 100000 }).solutionCount, 0, "tre fuorilegge in due vagoni: impossibile");
      assert(v && c);

      delete puzzle.grid.sectors;
      assert(roleProblems(puzzle).length > 0, "senza vagoni «uno solo per vagone» non ha senso");
    },
  },
  {
    name: "grattacielo: i piani impilati — righe numerate di seguito, colonne che si ripetono in ogni piano; chiavi, capienza, ridimensionamento",
    fn: () => {
      const grid = createGrid(9, 4);
      assert(setSectors(grid, [3, 3, 3], ["Attico", "Piano", "Terra"], "row"));
      assertEqual(grid.sectorAxis, "row");
      assert(!setSectors(grid, [4, 4], [], "row"), "la somma deve fare 9 (le righe), non 4");
      assertEqual(capacityOf(grid), 3 * 3, "tre piani da tre: ognuno ne tiene min(colonne, righe del piano)");
      const row = rowKeyFn(grid);
      const col = colKeyFn(grid);
      assert(row(2, 1) !== row(3, 1) && row(2, 1) === row(2, 3), "le righe sono tutte diverse");
      assert(col(0, 2) === col(2, 2) && col(2, 2) !== col(3, 2) && col(3, 2) !== col(3, 1), "la colonna conta dentro il piano");
      assertEqual(sectorAt(grid, 4, 0).name, "Piano");
      assertEqual(sharedAxes(grid).join(), "row");
      assertEqual(sectorProblems(grid).length, 0);
      assertEqual(
        resizeGrid(grid, 12, 4)
          .sectors.map((s) => s.last)
          .join(),
        "2,5,11"
      );
      assertEqual(resizeGrid(grid, 12, 4).sectorAxis, "row", "l'asse resta");
      assert(setSectors(grid, [3, 3, 3], [], "col") === false, "per colonne la somma deve fare 4");
      grid.sectorAxis = "diagonal";
      assert(sectorProblems(grid).length > 0);
      assertEqual(sharedAxes(createGrid(4, 4)).join(), "row,col");
    },
  },
  {
    name: "grattacielo: la validazione, il tavolo da gioco (X automatiche, righe e colonne riservate) e il solver",
    fn: () => {
      // 6 righe × 3 colonne, due piani da tre righe: una persona per riga (6) e una per colonna dentro ogni piano (3+3)
      const puzzle = createPuzzle("Grattacielo");
      puzzle.grid = resizeGrid(puzzle.grid, 6, 3);
      setSectors(puzzle.grid, [3, 3], ["Alto", "Basso"], "row");
      for (let i = 0; i < 6; i++) addCharacter(puzzle, `P${i}`, undefined, i === 5);
      puzzle.solution = { placements: [] };
      assert(!validatePuzzleShape(puzzle).errors.some((e) => /Troppi personaggi/.test(e)), "6 persone su 6 righe, 3 colonne");
      addCharacter(puzzle, "Extra");
      assert(validatePuzzleShape(puzzle).errors.some((e) => /Troppi personaggi/.test(e)));

      const grid = puzzle.grid;
      const state = createBoardState();
      const a = { kind: "character", id: "a" };
      const b = { kind: "character", id: "b" };
      assert(handleCellHold(state, grid, 1, 1, a).ok);
      assertEqual(handleCellHold(state, grid, 1, 2, b).reason, "row-col-conflict", "stessa riga");
      assertEqual(handleCellHold(state, grid, 2, 1, b).reason, "row-col-conflict", "stessa colonna, stesso piano");
      const crossed = [...state.xMarks];
      assert(crossed.includes("0,1") && crossed.includes("2,1"), "le X coprono la colonna dentro il piano");
      assert(!crossed.includes("3,1") && !crossed.includes("5,1"), "e non quella dell'altro piano");
      assert(crossed.includes("4,1"), "ma il pilastro (stessa riga del piano e stessa colonna) è escluso sull'altro piano");
      assertEqual(handleCellHold(state, grid, 4, 1, b).reason, "row-col-conflict", "stesso pilastro");
      assert(handleCellHold(state, grid, 4, 2, b).ok, "stessa colonna dell'altro piano ma un altro pilastro");
      assertEqual(cellsText(lineCells(grid, "col", 64 + 1)), "3,1 4,1 5,1", "la colonna C2 del piano basso");
      assertEqual(cellsText(lineCells(grid, "row", 4)), "4,0 4,1 4,2", "le righe restano quelle di tutta la mappa");
    },
  },
  {
    name: "grattacielo: un cubo latino — 2 piani 2×2 hanno 2 modi di disporre le caselle (×4! per chi ci sta), la ricerca di riferimento e il solver concordano",
    fn: () => {
      const puzzle = createPuzzle("Cubo");
      puzzle.grid = resizeGrid(puzzle.grid, 4, 2);
      assert(setSectors(puzzle.grid, [2, 2], ["Alto", "Basso"], "row"));
      // a room per floor: each floor holds exactly 2 people, so the victim always has exactly one other in hers
      for (const [i, floor] of puzzle.grid.sectors.entries()) {
        const zone = addZone(puzzle.grid, `Piano ${i}`, "#c2e0f4");
        for (let r = floor.first; r <= floor.last; r++) for (let c = 0; c < 2; c++) paintCellZone(puzzle.grid, r, c, zone.id);
      }
      for (let i = 0; i < 4; i++) addCharacter(puzzle, `P${i}`, undefined, i === 3);
      puzzle.solution = { placements: [] };
      assertEqual(capacityOf(puzzle.grid), 4);
      assertEqual(referenceSolutions(puzzle).length, 2 * 24, "una per riga, una per colonna di ogni piano, una per pilastro");
      assertEqual(checkUniqueness(puzzle, { maxSolutions: 1000 }).solutionCount, 48);
      assertEqual(solvePuzzle(puzzle, { maxSolutions: 1000 }).length, 48);
      // a pillar is the same place on every floor: nobody else there (3 floors of 2×2 hold 6 by floors, but there are 4 pillars)
      const tall = createPuzzle("Torre");
      tall.grid = resizeGrid(tall.grid, 6, 2);
      assert(setSectors(tall.grid, [2, 2, 2], [], "row"));
      assertEqual(capacityOf(tall.grid), 4, "i piani ne tengono 6 ma i pilastri sono 4");
      for (let i = 0; i < 5; i++) addCharacter(tall, `Q${i}`);
      tall.solution = { placements: [] };
      assert(
        validatePuzzleShape(tall).errors.some((e) => /Troppi personaggi/.test(e)),
        "5 persone non ci stanno"
      );
    },
  },
  {
    name: "grattacielo: piani più stretti — le caselle a destra non esistono, la capienza e la validazione le tengono fuori, ridimensionare le riadatta",
    fn: () => {
      const grid = createGrid(6, 4);
      assert(!setSectors(grid, [3, 3], [], "row", [4, 5]), "più larga della griglia");
      assert(!setSectors(grid, [3, 3], [], "row", [4, 0]));
      assert(setSectors(grid, [3, 3], ["Alto", "Basso"], "row", [4, 2]));
      assertEqual(grid.sectors[0].width, undefined, "un piano largo quanto la griglia non memorizza la larghezza");
      assertEqual(grid.sectors[1].width, 2);
      assert(isFloorPadding(grid, 3, 2) && isFloorPadding(grid, 5, 3) && !isFloorPadding(grid, 3, 1) && !isFloorPadding(grid, 0, 3));
      assert(grid.cells[4][3].blocked && !grid.cells[4][1].blocked, "le caselle in più sono vuote");
      setBlocked(grid, 4, 3, false);
      assert(grid.cells[4][3].blocked, "e non si riempiono");
      assertEqual(sectorProblems(grid).length, 0);
      assertEqual(capacityOf(grid), 3 + 2, "alto: min(3, 4) = 3; basso: min(3, 2) = 2");
      grid.cells[4][3].blocked = false;
      assert(sectorProblems(grid).length > 0, "una casella fuori larghezza non vuota");
      grid.cells[4][3].blocked = true;
      assertEqual(resizeGrid(grid, 6, 3).sectors[1].width, 2, "ridimensionare tiene la larghezza se è più stretta");
      assert(!("width" in resizeGrid(grid, 6, 2).sectors[1]), "...e la toglie se è larga quanto la griglia");
      assert(setSectors(grid, [3, 3], [], "row", [4, 4]));
      assert(!grid.cells[4][3].blocked && !grid.cells[5][2].blocked, "tolte le larghezze, le caselle tornano");
      assert(setSectors(grid, [3, 3], [], "row", [4, 2]) && setSectors(grid, null));
      assert(!grid.cells[4][3].blocked, "tolti i piani, le caselle tornano");
    },
  },
  {
    name: "grattacielo con piani stretti: il solver conta come la ricerca di riferimento (anche il solutore umano)",
    fn: () => {
      let withSolutions = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const puzzle = randomPuzzle(seed);
        const cols = puzzle.grid.size.cols;
        const left = 1 + (seed % (cols - 1));
        const widths = seed % 2 ? [cols - 1, cols] : [cols, cols - 1];
        if (!setSectors(puzzle.grid, [left, cols - left], [], "row", widths)) continue;
        if (aimsAtNothing(puzzle)) continue;
        const expected = referenceSolutions(puzzle).sort();
        const actual = solvePuzzle(puzzle, { maxSolutions: 100000, incremental: true }).map(keyOf).sort();
        assertEqual(actual.join("\n"), expected.join("\n"), `caso ${seed}: soluzioni`);
        if (expected.length > 0) withSolutions++;
        const human = humanSolve(puzzle, { maxWork: 5e6 });
        if (human.status === "limit") continue;
        const want = expected.length === 0 ? "contradiction" : expected.length > 1 ? "ambiguous" : "solved";
        assertEqual(human.status, want, `caso ${seed}: solutore umano`);
      }
      assert(withSolutions >= 10, `servono casi con soluzioni (${withSolutions})`);
    },
  },
  {
    name: "grattacielo: direzioni, righe, colonne, angoli e «accanto» valgono solo dentro lo stesso piano; fra due piani sono falsi (la negazione è vera)",
    fn: () => {
      const puzzle = createPuzzle("Torre");
      puzzle.grid = resizeGrid(puzzle.grid, 4, 3);
      setSectors(puzzle.grid, [2, 2], ["Alto", "Basso"], "row");
      const a = addCharacter(puzzle, "A");
      const b = addCharacter(puzzle, "B");
      const holds = (type, params, where, owner = a) => {
        const clue = addClue(puzzle, owner.id, type, params);
        const pm = new Map(Object.entries(where).map(([id, [row, col]]) => [id, { row, col }]));
        const predicate = buildPredicates(puzzle).find((p) => p.clue.id === clue.id).predicate;
        return predicate(pm, true);
      };
      const together = { [a.id]: [1, 0], [b.id]: [2, 0] }; // one above the other, on two floors
      assertEqual(holds("adjacent", { targetId: b.id }, together), false, "accanto, fra due piani");
      assertEqual(holds("directionDistance", { direction: "north", targetId: b.id }, together), false, "a nord di, fra due piani");
      assertEqual(holds("directionDistance", { direction: "north", distance: 1, targetId: b.id }, together), false);
      assertEqual(holds("rowOrColWith", { axis: "col", targetId: b.id }, together), false, "stessa colonna, fra due piani");
      assertEqual(holds("rowOrColAdjacentTo", { axis: "row", targetId: b.id }, together), false, "riga vicina, fra due piani");
      assertEqual(holds("facing", { targetId: b.id }, together), false, "di fronte, fra due piani");
      assertEqual(holds("diagonal", { targetId: b.id }, { [a.id]: [1, 0], [b.id]: [2, 1] }), false, "in diagonale, fra due piani");
      const same = { [a.id]: [0, 0], [b.id]: [1, 0] }; // the same two floor-mates
      assertEqual(holds("adjacent", { targetId: b.id }, same), true);
      assertEqual(holds("directionDistance", { direction: "north", targetId: b.id }, same), true);
      assertEqual(holds("rowOrColWith", { axis: "col", targetId: b.id }, same), true);
      assertEqual(holds("inCorner", {}, { [a.id]: [2, 0] }), true, "il piano basso ha il suo angolo in alto a sinistra");
      assertEqual(holds("inCorner", {}, { [a.id]: [1, 2] }), true, "e il piano alto in basso a destra");
      assertEqual(holds("inCorner", {}, { [a.id]: [1, 1] }), false);
      // the line of the shared numbering (a row) is the same for everybody; only the columns repeat
      assertEqual(holds("rowOrColWith", { axis: "row", targetId: b.id }, { [a.id]: [2, 0], [b.id]: [2, 2] }), true);
      // between: the same column on two floors is not a line
      const c = addCharacter(puzzle, "C");
      assertEqual(holds("between", { targetAId: b.id, targetBId: c.id }, { [a.id]: [1, 0], [b.id]: [0, 0], [c.id]: [3, 0] }), false);
    },
  },
  {
    name: "grattacielo: il confine fra due piani è un muro esterno di ciascuno — nessun muro «fra» i piani, nessuna porta che li colleghi",
    fn: () => {
      const grid = createGrid(4, 2);
      assert(setSectors(grid, [2, 2], [], "row"));
      const room = addZone(grid, "Atrio", "#c2e0f4");
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) paintCellZone(grid, r, c, room.id);
      assert(!wallBetween(grid, 1, 0, 2, 0), "una stanza su due piani non ha un muro in mezzo");
      assert(isWallEdge(grid, 1, 0, "S") && isWallEdge(grid, 2, 0, "N"), "ma il bordo del piano è un muro esterno");
      assertEqual(edgeCells(grid, { row: 1, col: 0, side: "S" }).length, 1, "la porta sul bordo sta in una cella sola");
      const door = placeObject(grid, "door", 1, 0, "S");
      assert(door && edgeObjectsAt(grid, 2, 0).length === 0, "è del piano alto e non dell'altro");
      assert(!zonesAreAdjacent(grid, room.id, room.id));
    },
  },
  {
    name: "grattacielo: l'ascensore è un pozzo su tutti i piani, le scale una coppia; si tolgono insieme, si potano se il piano cambia, e chi sta su un'estremità è accanto a chi sta sull'altra",
    fn: () => {
      const puzzle = createPuzzle("Torre");
      puzzle.grid = resizeGrid(puzzle.grid, 6, 3);
      assert(setSectors(puzzle.grid, [2, 2, 2], ["Alto", "Medio", "Terra"], "row"));
      const grid = puzzle.grid;
      assert(!placeElevator(createGrid(4, 4), 1, 1).ok, "senza piani non c'è ascensore");
      const lift = placeElevator(grid, 1, 2); // row 1 of the top floor, column 2: rows 1, 3, 5
      assert(lift.ok && lift.objects.map((o) => `${o.row},${o.col}`).join(" ") === "1,2 3,2 5,2");
      assert(new Set(lift.objects.map((o) => o.shaftId)).size === 1);
      assertEqual(wayProblems(grid).length, 0);
      const stairs = placeStairs(grid, { row: 0, col: 0 }, { row: 3, col: 1 }); // the top floor to the middle one, other cells
      assert(stairs.ok && stairs.objects.length === 2);
      assert(!placeStairs(grid, { row: 0, col: 0 }, { row: 5, col: 0 }).ok, "due piani lontani");
      assert(!placeStairs(grid, { row: 0, col: 0 }, { row: 1, col: 0 }).ok, "lo stesso piano");
      assertEqual(wayProblems(grid).length, 0);
      assertEqual(sectorProblems(grid).length, 0);
      // next to: only between people, through the way
      const a = addCharacter(puzzle, "A");
      const b = addCharacter(puzzle, "B");
      const near = (where, owner = a, target = b) => {
        const clue = addClue(puzzle, owner.id, "adjacent", { targetId: target.id });
        const pm = new Map(Object.entries(where).map(([id, [row, col]]) => [id, { row, col }]));
        return buildPredicates(puzzle)
          .find((p) => p.clue.id === clue.id)
          .predicate(pm, true);
      };
      assertEqual(near({ [a.id]: [1, 2], [b.id]: [5, 2] }), true, "l'ascensore arriva a ogni piano (dal piano alto al terra)");
      assertEqual(near({ [a.id]: [3, 2], [b.id]: [1, 2] }), true);
      assertEqual(near({ [a.id]: [0, 0], [b.id]: [3, 1] }), true, "le scale: da un'estremità all'altra");
      assertEqual(near({ [a.id]: [0, 0], [b.id]: [5, 1] }), false, "ma non al piano che non servono");
      assertEqual(near({ [a.id]: [0, 0], [b.id]: [2, 0] }), false, "nemmeno la cella sotto senza scale");
      assertEqual(near({ [a.id]: [1, 2], [b.id]: [3, 1] }), false, "una cella accanto all'ascensore sull'altro piano non basta");
      // taking away one end takes the whole way
      removeObject(grid, grid.cells[3][2].objectId);
      assert(!grid.objects.some((o) => o.typeId === "elevator"), "l'ascensore se ne va intero");
      assert(grid.objects.filter((o) => o.typeId === "stairs").length === 2);
      setBlocked(grid, 0, 0, true);
      assert(!grid.objects.some((o) => o.typeId === "stairs"), "bloccare una casella toglie le scale");
      // a way that no longer fits the floors goes with the resize
      assert(placeElevator(grid, 0, 1).ok);
      const cut = resizeGrid(grid, 4, 3);
      assertEqual(
        cut.objects.filter((o) => o.typeId === "elevator").length,
        2,
        "tagliare il piano più basso: l'ascensore resta sugli altri due"
      );
      assertEqual(wayProblems(cut).length, 0);

      grid.objects.find((o) => o.typeId === "elevator").shaftId = undefined;
      assert(wayProblems(grid).length > 0, "un'estremità senza collegamento");
      assert(setSectors(grid, null) && !grid.objects.some((o) => o.typeId === "elevator"), "senza piani, niente ascensore");
    },
  },
  {
    name: "grattacielo: «accanto» via ascensore e scale vale anche per gli oggetti; le righe si numerano in ogni piano; «il più a nord» vale per tutti i piani o per il proprio",
    fn: () => {
      const puzzle = createPuzzle("Torre");
      puzzle.grid = resizeGrid(puzzle.grid, 6, 3);
      assert(setSectors(puzzle.grid, [2, 2, 2], ["Alto", "Medio", "Terra"], "row"));
      const grid = puzzle.grid;
      assert(placeElevator(grid, 1, 2).ok); // rows 1, 3, 5, column 2
      assert(placeStairs(grid, { row: 0, col: 0 }, { row: 2, col: 0 }).ok);
      assert(placeObject(grid, "lamp", 3, 0)); // on the middle floor
      const a = addCharacter(puzzle, "A");
      const b = addCharacter(puzzle, "B");
      const c = addCharacter(puzzle, "C");
      const holds = (type, params, where, owner = a) => {
        const clue = addClue(puzzle, owner.id, type, params);
        const pm = new Map(Object.entries(where).map(([id, [row, col]]) => [id, { row, col }]));
        const result = buildPredicates(puzzle)
          .find((p) => p.clue.id === clue.id)
          .predicate(pm, true);
        puzzle.clues = puzzle.clues.filter((x) => x.id !== clue.id);
        return result;
      };
      // next to the lift or the stairs: from one end to the others on any floor of the lift, to the floor the stairs lead to;
      // never next to a piece of furniture on another floor
      const liftType = objectTypeTargetId("elevator");
      const stairsType = objectTypeTargetId("stairs");
      assertEqual(
        holds("adjacent", { targetId: liftType }, { [a.id]: [1, 2] }),
        true,
        "sul pozzo: accanto all'ascensore degli altri piani"
      );
      assertEqual(holds("adjacent", { targetId: liftType }, { [a.id]: [5, 2] }), true, "anche dal piano terra");
      assertEqual(holds("adjacent", { targetId: liftType }, { [a.id]: [1, 1] }), true, "e chi gli sta vicino nello stesso piano");
      assertEqual(holds("adjacent", { targetId: liftType }, { [a.id]: [4, 1] }), false, "una cella qualunque di un altro piano no");
      assertEqual(holds("adjacent", { targetId: stairsType }, { [a.id]: [2, 0] }), true, "sulle scale: accanto all'altra estremità");
      assertEqual(holds("adjacent", { targetId: stairsType }, { [a.id]: [4, 1] }), false);
      const lamp = grid.objects.find((o) => o.typeId === "lamp");
      assertEqual(
        holds("adjacent", { targetId: lamp.id }, { [a.id]: [5, 2] }),
        false,
        "la lampada è in un altro piano: sull'ascensore non basta"
      );
      assertEqual(holds("adjacent", { targetId: lamp.id }, { [a.id]: [3, 1] }), true, "stesso piano, cella accanto");
      // the rows count from the top of each floor: «row 2» is the second of every floor, «row 2 odd/even» likewise
      for (const row of [1, 3, 5])
        assertEqual(holds("inRowOrCol", { axis: "row", index: 2 }, { [a.id]: [row, 0] }), true, `riga 2 del piano di R${row + 1}`);
      assertEqual(holds("inRowOrCol", { axis: "row", index: 2 }, { [a.id]: [2, 0] }), false);
      assertEqual(holds("rowOrColParity", { axis: "row", parity: "even" }, { [a.id]: [3, 0] }), true);
      assertEqual(holds("rowOrColParity", { axis: "row", parity: "odd" }, { [a.id]: [4, 0] }), true);
      // «the northernmost»: of everybody (the row of each floor, every floor taken in) or of one's own floor
      const extreme = (direction, scope, owner, where) => holds("extremeInDirection", { direction, scope, property: "" }, where, owner);
      // A and C are both in row 1 of their floor, B in row 2 of the top one
      const tied = { [a.id]: [2, 0], [b.id]: [1, 1], [c.id]: [4, 2] };
      assertEqual(extreme("north", "map", a, tied), false, "A e C sono alla stessa riga: nessuna delle due è la più a nord di tutti");
      assertEqual(extreme("north", "floor", a, tied), true, "ma A lo è nel suo piano");
      assertEqual(extreme("north", "map", b, tied), false, "B è alla riga 2: più a sud di A e di C");
      assertEqual(extreme("north", "floor", b, tied), true, "ma è sola nel suo piano");
      // A alone in row 1, the others in row 2 of their floors
      const alone = { [a.id]: [2, 0], [b.id]: [1, 1], [c.id]: [5, 2] };
      assertEqual(extreme("north", "map", a, alone), true, "A è la più a nord di tutti i piani");
      assertEqual(extreme("south", "map", a, alone), false);
      // the east is the column, the same in every floor
      assertEqual(
        extreme("east", "map", c, { [a.id]: [2, 0], [b.id]: [1, 1], [c.id]: [5, 2] }),
        true,
        "la colonna 3 è la più a est di tutti"
      );
      assertEqual(extreme("east", "floor", b, alone), true, "B è sola nel suo piano");
    },
  },
  {
    name: "grattacielo: «a nord di tutti i <ruolo>» confronta la riga di ogni piano, in tutti i piani; si offre coi piani",
    fn: () => {
      const puzzle = createPuzzle("Torre");
      puzzle.grid = resizeGrid(puzzle.grid, 6, 3);
      assert(setSectors(puzzle.grid, [2, 2, 2], ["Alto", "Medio", "Terra"], "row"));
      const knight = addRole(puzzle, "Cavaliere", "none");
      const a = addCharacter(puzzle, "A");
      const b = addCharacter(puzzle, "B");
      const c = addCharacter(puzzle, "C");
      puzzle.solution.roles = { [a.id]: null, [b.id]: knight.id, [c.id]: knight.id };
      assert(new Set(typeIdsFor(a.id, puzzle)).has("roleDirection"), "si offre coi piani");
      const holds = (direction, where) => {
        const clue = addClue(puzzle, a.id, "roleDirection", { direction, roleId: knight.id });
        const pm = new Map(Object.entries(where).map(([id, [row, col]]) => [id, { row, col }]));
        const result = buildPredicates(withDeclared(puzzle))
          .find((p) => p.clue.id === clue.id)
          .predicate(pm, true);
        puzzle.clues = puzzle.clues.filter((x) => x.id !== clue.id);
        return result;
      };
      // A in row 1 of the top floor; the knights in row 2 of the middle floor and row 2 of the ground floor: A is north of both
      assertEqual(
        holds("north", { [a.id]: [0, 0], [b.id]: [3, 1], [c.id]: [5, 2] }),
        true,
        "la riga 1 è a nord della riga 2 di un altro piano"
      );
      assertEqual(holds("south", { [a.id]: [0, 0], [b.id]: [3, 1], [c.id]: [5, 2] }), false);
      // a knight in row 1 of another floor ties with A: not north of him
      assertEqual(holds("north", { [a.id]: [0, 0], [b.id]: [2, 1], [c.id]: [5, 2] }), false, "stessa riga di un altro piano");
      assertEqual(holds("east", { [a.id]: [0, 2], [b.id]: [3, 1], [c.id]: [4, 0] }), true, "la colonna è la stessa in ogni piano");
    },
  },
  {
    name: "grattacielo: gli indizi sui piani (stesso piano, più alto/più basso, subito sopra/sotto, al piano…) — verità, negazione, scelta nell'editor e conteggio come la forza bruta",
    fn: () => {
      const puzzle = createPuzzle("Torre");
      puzzle.grid = resizeGrid(puzzle.grid, 6, 3);
      assert(setSectors(puzzle.grid, [2, 2, 2], ["Attico", "Primo", "Terra"], "row"));
      const [top, mid, ground] = puzzle.grid.sectors;
      const a = addCharacter(puzzle, "A");
      const b = addCharacter(puzzle, "B");
      const holds = (type, params, where, negate = false) => {
        const clue = addClue(puzzle, a.id, type, params);
        clue.negate = negate;
        const pm = new Map(Object.entries(where).map(([id, [row, col]]) => [id, { row, col }]));
        const predicate = buildPredicates(puzzle).find((p) => p.clue.id === clue.id).predicate;
        const result = predicate(pm, true);
        puzzle.clues = puzzle.clues.filter((c) => c.id !== clue.id);
        return result;
      };
      const at = (ra, rb) => ({ [a.id]: [ra, 0], [b.id]: [rb, 1] });
      assertEqual(holds("sameFloor", { targetId: b.id }, at(0, 1)), true);
      assertEqual(holds("sameFloor", { targetId: b.id }, at(1, 2)), false);
      assertEqual(holds("sameFloor", { targetId: b.id }, at(1, 2), true), true, "la negazione");
      assertEqual(holds("floorOrder", { relation: "higher", targetId: b.id }, at(0, 3)), true, "A è più in alto di B");
      assertEqual(holds("floorOrder", { relation: "higher", targetId: b.id }, at(3, 0)), false);
      assertEqual(holds("floorOrder", { relation: "higher", targetId: b.id }, at(0, 1)), false, "stesso piano: non è più in alto");
      assertEqual(holds("floorOrder", { relation: "lower", targetId: b.id }, at(5, 3)), true);
      assertEqual(holds("floorOrder", { relation: "justAbove", targetId: b.id }, at(1, 2)), true, "attico sopra primo");
      assertEqual(holds("floorOrder", { relation: "justAbove", targetId: b.id }, at(1, 4)), false, "due piani sopra non è subito sopra");
      assertEqual(holds("floorOrder", { relation: "justBelow", targetId: b.id }, at(4, 3)), true);
      assertEqual(holds("onFloor", { floorId: ground.id }, at(4, 0)), true);
      assertEqual(holds("onFloor", { floorId: ground.id }, at(3, 0)), false);
      assertEqual(holds("onFloor", { floorId: mid.id }, at(3, 0), true), false, "negata, sul piano che è");
      assertEqual(holds("onFloor", { floorId: top.id }, at(3, 0), true), true);
      // in the editor and in the suggestions only when there are floors
      const offered = (p) => new Set(typeIdsFor(a.id, p));
      for (const id of ["sameFloor", "floorOrder", "onFloor"]) assert(offered(puzzle).has(id), `${id} si offre coi piani`);
      assert(offered(puzzle).has("extremeInDirection"), "«il più a nord di tutti» e «del suo piano» si offrono coi piani");
      assert(!offered(puzzle).has("roleDirection"), "senza ruoli «a nord di tutti i…» non si offre");
      const plain = createPuzzle("Piano");
      addCharacter(plain, "A");
      for (const id of ["sameFloor", "floorOrder", "onFloor"])
        assert(!new Set(typeIdsFor(plain.characters[0].id, plain)).has(id), `${id} no senza piani`);
      // the text, with the names of the floors
      const clue = { id: "x", characterId: a.id, type: "onFloor", params: { floorId: ground.id }, negate: false };
      assertEqual(describeClue(clue, puzzle), "È al piano «Terra».");
      assertEqual(describeClue({ ...clue, negate: true }, puzzle), "Non è al piano «Terra».");
      // the count of the solver is the one of the brute force
      const cube = createPuzzle("Cubo");
      cube.grid = resizeGrid(cube.grid, 4, 2);
      assert(setSectors(cube.grid, [2, 2], ["Alto", "Basso"], "row"));
      for (const [i, floor] of cube.grid.sectors.entries()) {
        const zone = addZone(cube.grid, `Piano ${i}`, "#c2e0f4");
        for (let r = floor.first; r <= floor.last; r++) for (let c = 0; c < 2; c++) paintCellZone(cube.grid, r, c, zone.id);
      }
      const people = [0, 1, 2, 3].map((i) => addCharacter(cube, `P${i}`, undefined, i === 3));
      cube.solution = { placements: [] };
      const [p0, p1] = people;
      addClue(cube, p0.id, "sameFloor", { targetId: p1.id });
      addClue(cube, p1.id, "onFloor", { floorId: cube.grid.sectors[1].id });
      addClue(cube, people[2].id, "floorOrder", { relation: "lower", targetId: p0.id }).negate = true;
      const expected = referenceSolutions(cube).length;
      assert(expected > 0 && expected < 48, `i tre indizi tolgono qualche soluzione (${expected})`);
      assertEqual(solvePuzzle(cube, { maxSolutions: 1000 }).length, expected);
    },
  },
  {
    name: "vagoni: sul tavolo da gioco la riga conta dentro il vagone; le X automatiche e le righe riservate pure",
    fn: () => {
      const grid = createGrid(3, 6);
      setSectors(grid, [3, 3]);
      const state = createBoardState();
      const a = { kind: "character", id: "a" };
      const b = { kind: "character", id: "b" };
      assert(handleCellHold(state, grid, 1, 0, a).ok);
      assertEqual(handleCellHold(state, grid, 1, 2, b).reason, "row-col-conflict", "stessa riga, stesso vagone");
      assertEqual(handleCellHold(state, grid, 2, 0, b).reason, "row-col-conflict", "stessa colonna");
      const crossed = [...state.xMarks];
      assert(crossed.includes("1,1") && crossed.includes("1,2"), "le X coprono la riga dentro il vagone");
      assert(!crossed.includes("1,3") && !crossed.includes("1,5"), "e non quella degli altri vagoni");
      assert(handleCellHold(state, grid, 1, 4, b).ok, "stessa riga ma nell'altro vagone");
      assertEqual(cellsText(lineCells(grid, "row", 64 + 1)), "1,3 1,4 1,5", "la riga R2 del secondo vagone");
      assertEqual(cellsText(lineCells(grid, "row", 1)), "1,0 1,1 1,2");
    },
  },
];
