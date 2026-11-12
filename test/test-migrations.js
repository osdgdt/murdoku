import { migratePuzzle, CURRENT_SCHEMA_VERSION } from "../src/model/migrations.js";
import { validatePuzzleShape, createPuzzle } from "../src/model/puzzle.js";
import * as store from "../src/storage/puzzleStore.js";
import { readJson, writeRaw, StorageFullError, useBackendForTests } from "../src/storage/storage.js";
import { isOccupiable } from "../src/model/grid.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "migratePuzzle porta un documento senza schemaVersion alla versione corrente riempiendo i campi mancanti",
    fn: () => {
      const legacy = {
        id: "p1",
        title: "Vecchio",
        grid: { size: { rows: 3, cols: 3 }, cells: [], zones: [{ id: "z1", name: "A", color: "#fff" }], objects: [] },
        characters: [{ id: "c1", name: "X", isVictim: true }],
        clues: [],
        solution: { placements: [] },
      };
      migratePuzzle(legacy);
      assertEqual(legacy.schemaVersion, CURRENT_SCHEMA_VERSION);
      assertEqual(legacy.difficulty, "");
      assertEqual(legacy.manualHints.length, 0);
      assertEqual(legacy.characters[0].gender, null);
      assertEqual(legacy.grid.zones[0].textureId, "hatch");
    },
  },
  {
    name: "migratePuzzle è idempotente e non sovrascrive campi già presenti",
    fn: () => {
      const p = createPuzzle("Nuovo");
      p.difficulty = "hard";
      const before = JSON.stringify(p);
      migratePuzzle(p);
      migratePuzzle(p);
      assertEqual(JSON.stringify(p), before);
    },
  },
  {
    name: "migratePuzzle: una vecchia porta a tutta cella passa sul lato Nord e libera la cella; è idempotente",
    fn: () => {
      const puzzle = createPuzzle("Vecchia porta");
      puzzle.schemaVersion = 2;
      const g = puzzle.grid;
      g.objects.push({ id: "objDoor", typeId: "door", row: 1, col: 2 });
      g.cells[1][2].objectId = "objDoor";
      g.objects.push({ id: "objTable", typeId: "table", row: 0, col: 2 });
      g.cells[0][2].objectId = "objTable";
      migratePuzzle(puzzle);
      assertEqual(puzzle.schemaVersion, CURRENT_SCHEMA_VERSION);
      const door = g.objects.find((o) => o.id === "objDoor");
      assertEqual(door.side, "N");
      assertEqual(g.cells[1][2].objectId, null);
      assert(isOccupiable(g, 1, 2), "la cella della vecchia porta ora è libera");
      assertEqual(g.objects.find((o) => o.id === "objTable").side, undefined, "i mobili non si toccano");
      assertEqual(g.cells[0][2].objectId, "objTable");
      const before = JSON.stringify(puzzle);
      migratePuzzle(puzzle);
      assertEqual(JSON.stringify(puzzle), before, "seconda migrazione = nessun cambiamento");
    },
  },
  {
    name: "migratePuzzle: una porta che ha già un lato non viene toccata; input malformato non lancia",
    fn: () => {
      const puzzle = createPuzzle("Porta con lato");
      puzzle.schemaVersion = 2;
      puzzle.grid.objects.push({ id: "objDoor", typeId: "door", row: 0, col: 0, side: "E" });
      migratePuzzle(puzzle);
      assertEqual(puzzle.grid.objects[0].side, "E");
      assertEqual(migratePuzzle(null), null);
      migratePuzzle({ schemaVersion: 2, grid: { objects: "no", cells: [] } });
    },
  },
  {
    name: "un puzzle di una versione futura viene rifiutato dalla validazione, non migrato",
    fn: () => {
      const p = createPuzzle("Futuro");
      p.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
      migratePuzzle(p);
      assertEqual(p.schemaVersion, CURRENT_SCHEMA_VERSION + 1);
      assert(!validatePuzzleShape(p).valid);
    },
  },
  {
    name: "puzzleStore.get migra al volo un documento salvato nel vecchio formato",
    fn: () => {
      writeRaw("murdoku:puzzle:old1", JSON.stringify({ id: "old1", title: "Vecchio", characters: [], clues: [] }));
      const p = store.get("old1");
      assertEqual(p.schemaVersion, CURRENT_SCHEMA_VERSION);
      assertEqual(p.manualHints.length, 0);
    },
  },
  {
    name: "readJson restituisce il fallback su JSON corrotto invece di lanciare",
    fn: () => {
      writeRaw("murdoku:test", "{non json");
      assertEqual(readJson("murdoku:test", "fb"), "fb");
    },
  },
  {
    name: "writeRaw lancia StorageFullError quando lo storage rifiuta la scrittura",
    fn: () => {
      useBackendForTests({
        setItem() {
          throw new Error("QuotaExceededError");
        },
        getItem() {
          return null;
        },
        removeItem() {},
      });
      try {
        let thrown = null;
        try {
          writeRaw("k", "v");
        } catch (e) {
          thrown = e;
        }
        assert(thrown instanceof StorageFullError, "atteso StorageFullError");
      } finally {
        useBackendForTests(null);
      }
    },
  },
];
