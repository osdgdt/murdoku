import { ACHIEVEMENTS, achievementById } from "../src/model/achievements.js";
import * as achievementsStore from "../src/storage/achievementsStore.js";
import { assert, assertEqual } from "./assert.js";

// achievementsStore persists to real localStorage (this suite runs in an
// actual browser tab) — every test clears the key first so they don't leak
// state into each other or into a later run.
function reset() {
  localStorage.removeItem("murdoku:achievements");
}

export const tests = [
  {
    name: "getStats su uno storage vuoto restituisce zeri e nessun tempo migliore",
    fn: () => {
      reset();
      const stats = achievementsStore.getStats();
      assertEqual(stats.totalSolved, 0);
      assertEqual(stats.totalSolvedWithoutHints, 0);
      assertEqual(stats.fastestSolveSeconds, null);
    },
  },
  {
    name: "recordSolve incrementa totalSolved e, solo senza indizi, anche totalSolvedWithoutHints",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ elapsedSeconds: 300, hintsUsed: 2 });
      achievementsStore.recordSolve({ elapsedSeconds: 200, hintsUsed: 0 });
      const stats = achievementsStore.getStats();
      assertEqual(stats.totalSolved, 2);
      assertEqual(stats.totalSolvedWithoutHints, 1, "solo la seconda risoluzione è senza indizi");
    },
  },
  {
    name: "recordSolve tiene traccia del tempo più veloce, non dell'ultimo",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ elapsedSeconds: 150, hintsUsed: 0 });
      achievementsStore.recordSolve({ elapsedSeconds: 90, hintsUsed: 1 });
      achievementsStore.recordSolve({ elapsedSeconds: 200, hintsUsed: 0 });
      assertEqual(achievementsStore.getStats().fastestSolveSeconds, 90);
    },
  },
  {
    name: "recordSolve restituisce ogni traguardo raggiunto solo la prima volta che viene sbloccato",
    fn: () => {
      reset();
      const first = achievementsStore.recordSolve({ elapsedSeconds: 300, hintsUsed: 0 });
      assert(first.some((a) => a.id === "first_solve"), "il primo caso risolto deve sbloccare first_solve");
      assert(first.some((a) => a.id === "no_hints"), "risolvere senza indizi deve sbloccare no_hints subito");
      const second = achievementsStore.recordSolve({ elapsedSeconds: 300, hintsUsed: 0 });
      assert(!second.some((a) => a.id === "first_solve"), "first_solve non deve essere ri-annunciato");
      assert(!second.some((a) => a.id === "no_hints"), "no_hints non deve essere ri-annunciato");
    },
  },
  {
    name: "under_2_minutes si sblocca solo sotto i 120 secondi",
    fn: () => {
      reset();
      const slow = achievementsStore.recordSolve({ elapsedSeconds: 121, hintsUsed: 0 });
      assert(!slow.some((a) => a.id === "under_2_minutes"), "121s non deve sbloccarlo");
      const fast = achievementsStore.recordSolve({ elapsedSeconds: 119, hintsUsed: 0 });
      assert(fast.some((a) => a.id === "under_2_minutes"), "119s deve sbloccarlo");
    },
  },
  {
    name: "isUnlocked riflette lo stato persistito",
    fn: () => {
      reset();
      assert(!achievementsStore.isUnlocked("first_solve"));
      achievementsStore.recordSolve({ elapsedSeconds: 300, hintsUsed: 0 });
      assert(achievementsStore.isUnlocked("first_solve"));
    },
  },
  {
    name: "i predicati del registro sono funzioni pure su uno stats sintetico",
    fn: () => {
      assert(!achievementById("ten_solves").check({ totalSolved: 9, totalSolvedWithoutHints: 0, fastestSolveSeconds: null }));
      assert(achievementById("ten_solves").check({ totalSolved: 10, totalSolvedWithoutHints: 0, fastestSolveSeconds: null }));
      assert(achievementById("no_hints").check({ totalSolved: 1, totalSolvedWithoutHints: 1, fastestSolveSeconds: null }));
      assert(!achievementById("no_hints").check({ totalSolved: 1, totalSolvedWithoutHints: 0, fastestSolveSeconds: null }));
      assertEqual(ACHIEVEMENTS.length, 5);
    },
  },
  {
    name: "getStats/getUnlocked su un valore corrotto in localStorage non lanciano",
    fn: () => {
      localStorage.setItem("murdoku:achievements", "{not json");
      assertEqual(achievementsStore.getStats().totalSolved, 0);
      assertEqual(Object.keys(achievementsStore.getUnlocked()).length, 0);
      reset();
    },
  },
];
