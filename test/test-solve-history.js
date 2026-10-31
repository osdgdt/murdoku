import * as history from "../src/storage/solveHistoryStore.js";
import { writeRaw } from "../src/storage/storage.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "solveHistory: registra ogni risoluzione, anche dello stesso caso, e restituisce le più recenti per prime",
    fn: () => {
      history.recordSolveEntry({ key: "puzzle:a", title: "A", elapsedSeconds: 120, hintsUsed: 2, at: 1000 });
      history.recordSolveEntry({ key: "puzzle:a", title: "A", elapsedSeconds: 90, hintsUsed: 0, at: 3000 });
      history.recordSolveEntry({ key: "puzzle:b", title: "B", elapsedSeconds: 300, hintsUsed: 1, at: 2000 });
      const recent = history.recentSolves();
      assertEqual(recent.map((e) => e.at).join(","), "3000,2000,1000");
    },
  },
  {
    name: "solveHistory: il riepilogo per caso aggrega volte, miglior tempo e meno suggerimenti",
    fn: () => {
      history.recordSolveEntry({ key: "puzzle:a", title: "A", elapsedSeconds: 120, hintsUsed: 2, at: 1000 });
      history.recordSolveEntry({ key: "puzzle:a", title: "A (rinominato)", elapsedSeconds: 90, hintsUsed: 0, at: 3000 });
      history.recordSolveEntry({ key: "puzzle:b", title: "B", elapsedSeconds: null, hintsUsed: 1, at: 2000 });
      const [a, b] = history.summaryByCase();
      assertEqual(a.key, "puzzle:a");
      assertEqual(a.solves, 2);
      assertEqual(a.bestElapsedSeconds, 90);
      assertEqual(a.bestHintsUsed, 0);
      assertEqual(a.title, "A (rinominato)", "vince il titolo più recente");
      assertEqual(b.bestElapsedSeconds, null, "nessun tempo registrato");
    },
  },
  {
    name: "solveHistory: la media considera solo le risoluzioni con tempo; senza dati è null",
    fn: () => {
      assertEqual(history.averageSolveSeconds(), null);
      history.recordSolveEntry({ key: "k1", title: "1", elapsedSeconds: 100, hintsUsed: 0, at: 1 });
      history.recordSolveEntry({ key: "k2", title: "2", elapsedSeconds: 200, hintsUsed: 0, at: 2 });
      history.recordSolveEntry({ key: "k3", title: "3", elapsedSeconds: null, hintsUsed: 0, at: 3 });
      assertEqual(history.averageSolveSeconds(), 150);
    },
  },
  {
    name: "solveHistory: il log è limitato alle ultime MAX_HISTORY_ENTRIES voci",
    fn: () => {
      for (let i = 0; i < history.MAX_HISTORY_ENTRIES + 25; i++) history.recordSolveEntry({ key: `k${i}`, title: "t", elapsedSeconds: 1, hintsUsed: 0, at: i });
      const all = history.recentSolves(10_000);
      assertEqual(all.length, history.MAX_HISTORY_ENTRIES);
      assertEqual(all[0].at, history.MAX_HISTORY_ENTRIES + 24);
    },
  },
  {
    name: "solveHistory: dati corrotti o voci malformate vengono ignorati senza lanciare",
    fn: () => {
      writeRaw("murdoku:solve-history", "{non json");
      assertEqual(history.recentSolves().length, 0);
      writeRaw("murdoku:solve-history", JSON.stringify([null, { key: 1 }, { key: "ok", at: 5, title: "x", elapsedSeconds: 3, hintsUsed: 0 }]));
      assertEqual(history.recentSolves().length, 1);
      assert(history.summaryByCase()[0].key === "ok");
    },
  },
];
