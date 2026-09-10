import { createPuzzle, addCharacter, addClue, setVictim } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid, setBlocked } from "../src/model/grid.js";
import { objectTypeTargetId } from "../src/model/icons.js";
import { resolveClueHoverCells } from "../src/solver/hoverTargets.js";
import { assert, assertEqual } from "./assert.js";

function basePuzzle(rows = 4, cols = 4) {
  const puzzle = createPuzzle("Test hover targets");
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  return puzzle;
}

function mapOf(entries) {
  return new Map(entries);
}

function cellSet(cells) {
  return new Set(cells.map((c) => `${c.row},${c.col}`));
}

export const tests = [
  {
    name: "resolveClueHoverCells: bersaglio characterOrObject diretto (adjacent) risolve alla cella del personaggio bersaglio",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([[b.id, { row: 1, col: 2 }]]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 1);
      assertEqual(cells[0].col, 2);
    },
  },
  {
    name: "resolveClueHoverCells: bersaglio personaggio non ancora piazzato risolve ad array vuoto, senza lanciare",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 0);
    },
  },
  {
    name: "resolveClueHoverCells: characterOrObjectMulti (inRowOrColWithAny) unisce i bersagli",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const clue = addClue(puzzle, a.id, "inRowOrColWithAny", { axis: "row", targetIds: [b.id, c.id] });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([[b.id, { row: 0, col: 0 }], [c.id, { row: 2, col: 3 }]]));
      assertEqual(cellSet(cells).size, 2, "entrambi i bersagli devono essere evidenziati");
      assert(cellSet(cells).has("0,0"));
      assert(cellSet(cells).has("2,3"));
    },
  },
  {
    name: "resolveClueHoverCells: bersaglio zona (inRoom) risolve a tutte le celle della stanza",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      const clue = addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cellSet(cells).size, 2);
      assert(cellSet(cells).has("0,0") && cellSet(cells).has("0,1"));
    },
  },
  {
    name: "resolveClueHoverCells: objtype generico (onObjectType) risolve a tutte le istanze presenti sulla mappa",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "door", 0, 0);
      placeObject(puzzle.grid, "door", 3, 3);
      placeObject(puzzle.grid, "window", 1, 1);
      const clue = addClue(puzzle, a.id, "onObjectType", { objectTypeId: "door" });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cellSet(cells).size, 2, "solo le porte, non la finestra");
      assert(cellSet(cells).has("0,0") && cellSet(cells).has("3,3"));
    },
  },
  {
    name: "resolveClueHoverCells: objtype generico senza istanze sulla mappa risolve ad array vuoto",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "onObjectType", { objectTypeId: "door" });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 0);
    },
  },
  {
    name: 'resolveClueHoverCells: proprietà "adjacentTo" risolve al bersaglio annidato',
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "adjacentTo", targetId: b.id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([[b.id, { row: 2, col: 1 }]]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 2);
      assertEqual(cells[0].col, 1);
    },
  },
  {
    name: 'resolveClueHoverCells: proprietà "sittingOn" risolve solo alle istanze del tipo di oggetto scelto',
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "chair", 0, 0);
      placeObject(puzzle.grid, "stool", 1, 1);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "sittingOn", objectTypeId: "chair" });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 1, "solo la sedia, non lo sgabello");
      assertEqual(cells[0].row, 0);
      assertEqual(cells[0].col, 0);
    },
  },
  {
    name: 'resolveClueHoverCells: proprietà "seated" (l\'esempio dell\'utente) evidenzia OGNI oggetto occupabile, non solo un tipo specifico',
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "chair", 0, 0);
      placeObject(puzzle.grid, "stool", 1, 1);
      placeObject(puzzle.grid, "table", 2, 2); // non occupabile, non deve comparire
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", { property: "seated" });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cellSet(cells).size, 2, "sedia e sgabello, non il tavolo");
      assert(cellSet(cells).has("0,0") && cellSet(cells).has("1,1"));
      assert(!cellSet(cells).has("2,2"));
    },
  },
  {
    name: 'resolveClueHoverCells: il tipo di indizio "seated" a sé stante (senza parametri) evidenzia gli stessi bersagli della proprietà "seated"',
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "chair", 0, 0);
      const clue = addClue(puzzle, a.id, "seated", {});
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 0);
      assertEqual(cells[0].col, 0);
    },
  },
  {
    name: 'resolveClueHoverCells: proprietà "custom" ricorre sull\'indizio annidato',
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "door", 3, 0);
      const clue = addClue(puzzle, a.id, "someoneInRoomWithProperty", {
        property: "custom",
        customClue: { type: "onObjectType", params: { objectTypeId: "door" } },
      });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 3);
      assertEqual(cells[0].col, 0);
    },
  },
  {
    name: "resolveClueHoverCells: aloneWithVictim risolve alla cella della vittima (bersaglio implicito)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const victim = addCharacter(puzzle, "Vittima", "person1");
      setVictim(puzzle, victim.id);
      const clue = addClue(puzzle, a.id, "aloneWithVictim", {});
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([[victim.id, { row: 1, col: 3 }]]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 1);
      assertEqual(cells[0].col, 3);
    },
  },
  {
    name: "resolveClueHoverCells: un tipo puramente geometrico senza bersaglio esterno (inRowOrCol) risolve ad array vuoto",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const clue = addClue(puzzle, a.id, "inRowOrCol", { axis: "row", index: 1 });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([[a.id, { row: 0, col: 0 }]]));
      assertEqual(cells.length, 0, "non c'è nessun bersaglio esterno sulla mappa da evidenziare");
    },
  },
  {
    name: "resolveClueHoverCells: noOneInRowOrCol (riga) risolve a tutte le celle occupabili di quella riga (indice 1-based)",
    fn: () => {
      const puzzle = basePuzzle(); // 4x4
      const clue = addClue(puzzle, null, "noOneInRowOrCol", { axis: "row", index: 2 }); // riga 2 -> indice 0-based 1
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cellSet(cells).size, 4);
      for (let c = 0; c < 4; c++) assert(cellSet(cells).has(`1,${c}`), `manca la cella 1,${c}`);
    },
  },
  {
    name: "resolveClueHoverCells: noOneInRowOrCol (colonna) esclude le celle bloccate, come positionsInZone",
    fn: () => {
      const puzzle = basePuzzle(); // 4x4
      setBlocked(puzzle.grid, 1, 2, true); // riga 1, colonna 2 (indice 0-based) bloccata
      const clue = addClue(puzzle, null, "noOneInRowOrCol", { axis: "col", index: 3 }); // colonna 3 -> indice 0-based 2
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cellSet(cells).size, 3, "3 celle su 4: quella bloccata non deve comparire");
      assert(!cellSet(cells).has("1,2"), "la cella bloccata non deve comparire");
    },
  },
  {
    name: "resolveClueHoverCells: due parametri che risolvono alla stessa cella producono un solo risultato (dedup)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const obj = placeObject(puzzle.grid, "table", 2, 2);
      const clue = addClue(puzzle, a.id, "between", { targetAId: obj.id, targetBId: obj.id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 1, "la stessa cella risolta due volte non deve comparire due volte");
    },
  },
  {
    name: "resolveClueHoverCells: orClue unisce i bersagli dei due sotto-indizi annidati",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "door", 0, 0);
      placeObject(puzzle.grid, "window", 3, 3);
      const clue = addClue(puzzle, a.id, "orClue", {
        a: { type: "onObjectType", params: { objectTypeId: "door" } },
        b: { type: "onObjectType", params: { objectTypeId: "window" } },
      });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cellSet(cells).size, 2);
      assert(cellSet(cells).has("0,0") && cellSet(cells).has("3,3"));
    },
  },
  {
    name: "resolveClueHoverCells: un indizio con tipo sconosciuto non lancia, restituisce array vuoto",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const cells = resolveClueHoverCells({ type: "nonEsiste", characterId: a.id, params: {} }, puzzle, mapOf([]));
      assertEqual(cells.length, 0);
    },
  },
  {
    name: "resolveClueHoverCells: bersaglio objtype: generico usato come targetId ordinario risolve tramite objectTypeTargetId",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      placeObject(puzzle.grid, "plant", 1, 2);
      const clue = addClue(puzzle, a.id, "adjacent", { targetId: objectTypeTargetId("plant") });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 1);
      assertEqual(cells[0].col, 2);
    },
  },
  {
    name: "resolveClueHoverCells: noOneWithProperty unisce la stanza (kind zone, non escluso dal walker generico) con il bersaglio della proprietà",
    fn: () => {
      const puzzle = basePuzzle();
      const zone = addZone(puzzle.grid, "Salotto", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      placeObject(puzzle.grid, "window", 3, 3);
      // Generico (characterId: null): zoneId (kind "zone", fuori dalla
      // famiglia "proprietà", risolto dal cammino generico) + property
      // "adjacentTo" (risolto da resolvePropertyTargets) nello stesso
      // indizio — l'unico tipo che combina le due cose.
      const clue = addClue(puzzle, null, "noOneWithProperty", { zoneId: zone.id, property: "adjacentTo", targetId: puzzle.grid.objects[0].id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      const set = cellSet(cells);
      assertEqual(set.size, 3, "le 2 celle della stanza più la cella della finestra");
      assert(set.has("0,0") && set.has("0,1"), "le celle della stanza devono comparire");
      assert(set.has("3,3"), "il bersaglio della proprietà 'adjacentTo' deve comparire insieme alla stanza");
    },
  },
  {
    name: "resolveClueHoverCells: exactlyOneNear (generico) risolve al bersaglio come qualunque altro characterOrObject",
    fn: () => {
      const puzzle = basePuzzle();
      placeObject(puzzle.grid, "door", 1, 2);
      const clue = addClue(puzzle, null, "exactlyOneNear", { targetId: puzzle.grid.objects[0].id });
      const cells = resolveClueHoverCells(clue, puzzle, mapOf([]));
      assertEqual(cells.length, 1);
      assertEqual(cells[0].row, 1);
      assertEqual(cells[0].col, 2);
    },
  },
];
