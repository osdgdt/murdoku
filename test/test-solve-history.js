import * as history from "../src/storage/solveHistoryStore.js";
import { writeRaw, remove } from "../src/storage/storage.js";
import { assert, assertEqual } from "./assert.js";

// Each test starts from an empty history: the browser runner shares localStorage
// with everything else on the origin (the other tests, a page opened by hand).
const fresh = () => remove("murdoku:solve-history");

export const tests = [
  {
    name: "solveHistory: registra ogni risoluzione, anche dello stesso caso, e restituisce le più recenti per prime",
    fn: () => {
      fresh();
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
      fresh();
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
      fresh();
      assertEqual(history.averageSolveSeconds(), null);
      history.recordSolveEntry({ key: "k1", title: "1", elapsedSeconds: 100, hintsUsed: 0, at: 1 });
      history.recordSolveEntry({ key: "k2", title: "2", elapsedSeconds: 200, hintsUsed: 0, at: 2 });
      history.recordSolveEntry({ key: "k3", title: "3", elapsedSeconds: null, hintsUsed: 0, at: 3 });
      assertEqual(history.averageSolveSeconds(), 150);
    },
  },
  {
    name: "solveHistory: la serie conta i giorni consecutivi (viva se l'ultimo è oggi o ieri) e ricorda il record",
    fn: () => {
      fresh();
      const day = (d) => new Date(2026, 5, d, 12, 0).getTime(); // local noon of June d
      for (const d of [5, 6, 10, 11, 12])
        history.recordSolveEntry({ key: `k${d}`, title: "t", elapsedSeconds: 1, hintsUsed: 0, at: day(d) });
      history.recordSolveEntry({ key: "again", title: "t", elapsedSeconds: 1, hintsUsed: 0, at: day(12) + 1000 }); // same day: counts once
      assertEqual(JSON.stringify(history.solveStreak(day(12) + 3_600_000)), JSON.stringify({ current: 3, best: 3 }), "10, 11 e 12 di fila");
      assertEqual(history.solveStreak(day(13)).current, 3, "ieri conta ancora: la serie è viva fino a fine giornata");
      assertEqual(history.solveStreak(day(14)).current, 0, "due giorni di pausa: la serie è finita");
      assertEqual(history.solveStreak(day(14)).best, 3, "ma il record resta");
      assertEqual(history.solvesInLastDays(3, day(12)), 4, "10, 11, 12 (due il 12)");
      fresh();
      assertEqual(JSON.stringify(history.solveStreak()), JSON.stringify({ current: 0, best: 0 }), "senza dati");
    },
  },
  {
    name: "solveHistory: il log è limitato alle ultime MAX_HISTORY_ENTRIES voci",
    fn: () => {
      fresh();
      for (let i = 0; i < history.MAX_HISTORY_ENTRIES + 25; i++)
        history.recordSolveEntry({ key: `k${i}`, title: "t", elapsedSeconds: 1, hintsUsed: 0, at: i });
      const all = history.recentSolves(10_000);
      assertEqual(all.length, history.MAX_HISTORY_ENTRIES);
      assertEqual(all[0].at, history.MAX_HISTORY_ENTRIES + 24);
    },
  },
  {
    name: "solveHistory: dati corrotti o voci malformate vengono ignorati senza lanciare",
    fn: () => {
      fresh();
      writeRaw("murdoku:solve-history", "{non json");
      assertEqual(history.recentSolves().length, 0);
      writeRaw(
        "murdoku:solve-history",
        JSON.stringify([null, { key: 1 }, { key: "ok", at: 5, title: "x", elapsedSeconds: 3, hintsUsed: 0 }])
      );
      assertEqual(history.recentSolves().length, 1);
      assert(history.summaryByCase()[0].key === "ok");
    },
  },
];
