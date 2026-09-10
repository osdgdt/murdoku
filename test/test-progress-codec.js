import { toFirestoreSafe, fromFirestoreSafe } from "../src/campaign/progressCodec.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "toFirestoreSafe/fromFirestoreSafe fanno un round-trip fedele di uno stato tavola serializzato",
    fn: () => {
      const serialized = {
        placements: [["char_1", { row: 0, col: 1 }], ["char_2", { row: 2, col: 0 }]],
        xMarks: ["0,0", "1,1"],
        candidates: [["1,2", ["char_1", "char_2"]]],
        autoXByCharacter: [["char_1", [{ row: 0, col: 2 }]]],
        hintsUsed: 3,
      };
      const safe = toFirestoreSafe(serialized);
      assert(safe.placements.every((p) => !Array.isArray(p)), "placements non deve contenere array annidati");
      assert(safe.candidates.every((c) => !Array.isArray(c)), "candidates non deve contenere array annidati");
      assert(safe.autoXByCharacter.every((a) => !Array.isArray(a)), "autoXByCharacter non deve contenere array annidati");
      assertEqual(JSON.stringify(fromFirestoreSafe(safe)), JSON.stringify(serialized), "il round-trip deve riprodurre esattamente lo stato di partenza");
    },
  },
  {
    name: "fromFirestoreSafe restituisce undefined per un valore assente (nessun progresso salvato)",
    fn: () => {
      assertEqual(fromFirestoreSafe(null), undefined);
      assertEqual(fromFirestoreSafe(undefined), undefined);
    },
  },
  {
    name: "fromFirestoreSafe torna a hintsUsed 0 per un salvataggio precedente a questo campo",
    fn: () => {
      const saved = { placements: [], xMarks: [], candidates: [], autoXByCharacter: [] }; // niente hintsUsed
      assertEqual(fromFirestoreSafe(saved).hintsUsed, 0);
    },
  },
];
