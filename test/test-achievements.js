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
    name: "recordSolve incrementa totalSolved per chiavi diverse, ma non ririsolvendo la stessa chiave",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 2 });
      achievementsStore.recordSolve({ key: "puzzle:b", elapsedSeconds: 200, hintsUsed: 0 });
      assertEqual(achievementsStore.getStats().totalSolved, 2);
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 250, hintsUsed: 1 });
      assertEqual(achievementsStore.getStats().totalSolved, 2, "ririsolvere \"a\" non deve aggiungere una nuova voce");
    },
  },
  {
    name: "totalSolvedWithoutHints conta solo le chiavi il cui MIGLIOR tentativo è senza indizi",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 2 });
      achievementsStore.recordSolve({ key: "puzzle:b", elapsedSeconds: 200, hintsUsed: 0 });
      assertEqual(achievementsStore.getStats().totalSolvedWithoutHints, 1, "solo b è stata risolta senza indizi");
    },
  },
  {
    name: "ririsolvere senza indizi una chiave prima risolta con un suggerimento la fa contare retroattivamente",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 2 });
      assertEqual(achievementsStore.getStats().totalSolvedWithoutHints, 0);
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 250, hintsUsed: 0 });
      assertEqual(achievementsStore.getStats().totalSolvedWithoutHints, 1, "il miglior tentativo di \"a\" ora è senza indizi");
      assertEqual(achievementsStore.getStats().totalSolved, 1, "resta comunque una sola chiave");
    },
  },
  {
    name: "recordSolve tiene traccia del tempo più veloce tra tutte le chiavi, non dell'ultimo",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 150, hintsUsed: 0 });
      achievementsStore.recordSolve({ key: "puzzle:b", elapsedSeconds: 90, hintsUsed: 1 });
      achievementsStore.recordSolve({ key: "puzzle:c", elapsedSeconds: 200, hintsUsed: 0 });
      assertEqual(achievementsStore.getStats().fastestSolveSeconds, 90);
    },
  },
  {
    name: "recordSolve restituisce ogni traguardo raggiunto solo la prima volta che viene sbloccato",
    fn: () => {
      reset();
      const first = achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 0 });
      assert(first.some((a) => a.id === "first_solve"), "il primo caso risolto deve sbloccare first_solve");
      assert(first.some((a) => a.id === "no_hints"), "risolvere senza indizi deve sbloccare no_hints subito");
      const second = achievementsStore.recordSolve({ key: "puzzle:b", elapsedSeconds: 300, hintsUsed: 0 });
      assert(!second.some((a) => a.id === "first_solve"), "first_solve non deve essere ri-annunciato");
      assert(!second.some((a) => a.id === "no_hints"), "no_hints non deve essere ri-annunciato");
    },
  },
  {
    name: "under_2_minutes si sblocca solo sotto i 120 secondi",
    fn: () => {
      reset();
      const slow = achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 121, hintsUsed: 0 });
      assert(!slow.some((a) => a.id === "under_2_minutes"), "121s non deve sbloccarlo");
      const fast = achievementsStore.recordSolve({ key: "puzzle:b", elapsedSeconds: 119, hintsUsed: 0 });
      assert(fast.some((a) => a.id === "under_2_minutes"), "119s deve sbloccarlo");
    },
  },
  {
    name: "isUnlocked riflette lo stato persistito",
    fn: () => {
      reset();
      assert(!achievementsStore.isUnlocked("first_solve"));
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 0 });
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
    name: "getStats/getUnlocked su un valore corrotto o nel vecchio formato in localStorage non lanciano",
    fn: () => {
      localStorage.setItem("murdoku:achievements", "{not json");
      assertEqual(achievementsStore.getStats().totalSolved, 0);
      assertEqual(Object.keys(achievementsStore.getUnlocked()).length, 0);
      // Vecchio formato a contatori grezzi (prima di questa estensione) —
      // niente `solves`, deve ricadere su uno stato vuoto invece di lanciare.
      localStorage.setItem("murdoku:achievements", JSON.stringify({ stats: { totalSolved: 3 }, unlocked: {} }));
      assertEqual(achievementsStore.getStats().totalSolved, 0);
      reset();
    },
  },
  {
    name: "mergeRemote unisce le chiavi senza doppio conteggio e prende il minimo tra hint/tempo sulle chiavi in comune",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 2 });
      achievementsStore.mergeRemote({
        solves: {
          "puzzle:a": { firstSolvedAt: 1000, bestHintsUsed: 0, bestElapsedSeconds: 250 }, // stessa chiave, dati migliori
          "puzzle:b": { firstSolvedAt: 2000, bestHintsUsed: 1, bestElapsedSeconds: 400 }, // chiave nuova
        },
        unlocked: {},
      });
      const stats = achievementsStore.getStats();
      assertEqual(stats.totalSolved, 2, "\"a\" in comune non deve contare due volte, \"b\" si aggiunge");
      assertEqual(stats.totalSolvedWithoutHints, 1, "il lato remoto aveva 0 indizi per \"a\": deve vincere il minimo");
      assertEqual(stats.fastestSolveSeconds, 250, "il minimo tra 300 (locale) e 250 (remoto) per \"a\", contro i 400 di \"b\"");
    },
  },
  {
    name: "mergeRemote può sbloccare un traguardo che nessuno dei due lati raggiungeva da solo",
    fn: () => {
      reset();
      for (let i = 0; i < 6; i++) {
        achievementsStore.recordSolve({ key: `puzzle:local-${i}`, elapsedSeconds: 300, hintsUsed: 1 });
      }
      assertEqual(achievementsStore.getStats().totalSolved, 6);
      const remoteSolves = {};
      for (let i = 0; i < 5; i++) remoteSolves[`puzzle:remote-${i}`] = { firstSolvedAt: 1000, bestHintsUsed: 1, bestElapsedSeconds: 300 };
      const newlyUnlocked = achievementsStore.mergeRemote({ solves: remoteSolves, unlocked: {} });
      assertEqual(achievementsStore.getStats().totalSolved, 11, "6 locali + 5 remoti, nessuna chiave in comune");
      assert(newlyUnlocked.some((a) => a.id === "ten_solves"), "solo l'unione supera la soglia di 10, né i 6 né i 5 da soli");
    },
  },
  {
    name: "mergeRemote su un traguardo sbloccato da entrambi i lati tiene la data più antica",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 300, hintsUsed: 0 });
      const localUnlockedAt = achievementsStore.getUnlocked().first_solve;
      achievementsStore.mergeRemote({ solves: {}, unlocked: { first_solve: localUnlockedAt - 5000 } });
      assertEqual(achievementsStore.getUnlocked().first_solve, localUnlockedAt - 5000, "la data remota, più antica, deve vincere");
    },
  },
  {
    name: "getRawData espone la stessa forma consumata da mergeRemote (round-trip locale)",
    fn: () => {
      reset();
      achievementsStore.recordSolve({ key: "puzzle:a", elapsedSeconds: 111, hintsUsed: 0 });
      const raw = achievementsStore.getRawData();
      assert(raw.solves["puzzle:a"], "getRawData deve includere le chiavi risolte");
      assertEqual(raw.solves["puzzle:a"].bestElapsedSeconds, 111);
      assert(raw.unlocked.first_solve, "getRawData deve includere i traguardi sbloccati");
    },
  },
];
