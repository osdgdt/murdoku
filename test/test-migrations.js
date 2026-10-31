import { migratePuzzle, CURRENT_SCHEMA_VERSION } from "../src/model/migrations.js";
import { validatePuzzleShape, createPuzzle } from "../src/model/puzzle.js";
import * as store from "../src/storage/puzzleStore.js";
import { readJson, writeRaw, StorageFullError, useBackendForTests } from "../src/storage/storage.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "migratePuzzle porta un documento senza schemaVersion alla versione corrente riempiendo i campi mancanti",
    fn: () => {
      const legacy = { id: "p1", title: "Vecchio", grid: { size: { rows: 3, cols: 3 }, cells: [], zones: [{ id: "z1", name: "A", color: "#fff" }], objects: [] }, characters: [{ id: "c1", name: "X", isVictim: true }], clues: [], solution: { placements: [] } };
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
      useBackendForTests({ setItem() { throw new Error("QuotaExceededError"); }, getItem() { return null; }, removeItem() {} });
      try {
        let thrown = null;
        try { writeRaw("k", "v"); } catch (e) { thrown = e; }
        assert(thrown instanceof StorageFullError, "atteso StorageFullError");
      } finally {
        useBackendForTests(null);
      }
    },
  },
];
