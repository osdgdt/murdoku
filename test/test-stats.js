import { createActiveClock } from "../src/player/activeClock.js";
import { MIN_PLAYERS_TO_SHOW, LIMITS, caseStatsKey, solveContribution, summarizeCaseStats } from "../src/campaign/statsMath.js";
import { createBoardState, serializeBoardState, deserializeBoardState } from "../src/player/board.js";
import { toFirestoreSafe, fromFirestoreSafe } from "../src/campaign/progressCodec.js";
import * as history from "../src/storage/solveHistoryStore.js";
import { remove } from "../src/storage/storage.js";
import { assert, assertEqual } from "./assert.js";

const freshHistory = () => {
  remove("murdoku:solve-history");
  remove("murdoku:case-starts");
};

function clockAt(initialSeconds) {
  let t = 1_000_000;
  const clock = createActiveClock({ initialSeconds, now: () => t });
  return { clock, advance: (ms) => (t += ms) };
}

export const tests = [
  {
    name: "activeClock: conta solo mentre la pagina è visibile e riparte dai secondi già salvati",
    fn: () => {
      const { clock, advance } = clockAt(100);
      assertEqual(clock.tick(true), 100, "il primo tick non aggiunge niente");
      advance(1000);
      assertEqual(clock.tick(true), 101);
      advance(1000);
      assertEqual(clock.tick(false), 101, "pagina nascosta: non conta");
      advance(1000);
      assertEqual(clock.tick(true), 102, "visibile di nuovo: riprende");
    },
  },
  {
    name: "activeClock: un'interruzione lunga (computer in sospensione) conta al massimo il limite",
    fn: () => {
      const { clock, advance } = clockAt(0);
      clock.tick(true);
      advance(3 * 60 * 60 * 1000);
      assertEqual(clock.tick(true), 5, "al massimo 5 secondi");
    },
  },
  {
    name: "activeClock: valori iniziali non validi ripartono da zero",
    fn: () => {
      assertEqual(createActiveClock({ initialSeconds: -5 }).seconds(), 0);
      assertEqual(createActiveClock({ initialSeconds: "x" }).seconds(), 0);
    },
  },
  {
    name: "statsMath: il contributo di una risoluzione resta nei limiti",
    fn: () => {
      const huge = solveContribution({ seconds: 10 ** 9, hints: 999, checks: 9999 });
      assertEqual(huge.seconds, LIMITS.maxSeconds);
      assertEqual(huge.hints, LIMITS.maxHints);
      assertEqual(huge.checks, LIMITS.maxChecks);
      const tiny = solveContribution({ seconds: 0, hints: -3, checks: "x" });
      assertEqual(tiny.seconds, 1, "almeno un secondo");
      assertEqual(tiny.hints, 0);
      assertEqual(tiny.checks, 0);
    },
  },
  {
    name: "statsMath: i dati globali si mostrano solo da abbastanza giocatori",
    fn: () => {
      assertEqual(summarizeCaseStats(null), null);
      assertEqual(summarizeCaseStats({ starts: MIN_PLAYERS_TO_SHOW - 1, solves: 2, totalSeconds: 100 }), null, "troppo pochi");
      assertEqual(summarizeCaseStats({ starts: 10, solves: 0, totalSeconds: 0 }), null, "nessuno l'ha risolto");
      const s = summarizeCaseStats({ starts: 10, solves: 5, totalSeconds: 3000, totalHints: 7, totalChecks: 10 });
      assertEqual(s.players, 10);
      assertEqual(s.avgSeconds, 600);
      assertEqual(s.avgHints, 1.4);
      assertEqual(s.completionRate, 0.5);
    },
  },
  {
    name: "statsMath: la chiave di un caso unisce campagna e caso",
    fn: () => assertEqual(caseStatsKey("campaign_a", "case_b"), "campaign_a__case_b"),
  },
  {
    name: "board: tempo attivo e verifiche sbagliate sopravvivono a salva/ricarica e alla sincronizzazione",
    fn: () => {
      const state = createBoardState();
      state.activeSeconds = 321;
      state.checks = 4;
      const back = deserializeBoardState(JSON.parse(JSON.stringify(serializeBoardState(state))));
      assertEqual(back.activeSeconds, 321);
      assertEqual(back.checks, 4);
      const cloud = fromFirestoreSafe(toFirestoreSafe(serializeBoardState(state)));
      assertEqual(cloud.activeSeconds, 321, "anche nel cloud");
      assertEqual(cloud.checks, 4);
    },
  },
  {
    name: "board: uno stato salvato prima delle statistiche riparte da zero, senza errori",
    fn: () => {
      const state = deserializeBoardState({ placements: [], xMarks: [], candidates: [], autoXByCharacter: [], hintsUsed: 2 });
      assertEqual(state.activeSeconds, 0);
      assertEqual(state.checks, 0);
      assertEqual(state.hintsUsed, 2);
      assertEqual(deserializeBoardState({ activeSeconds: -3, checks: "x" }).activeSeconds, 0);
    },
  },
  {
    name: "solveHistory: un caso iniziato conta una volta sola e resta «lasciato a metà» finché non è risolto",
    fn: () => {
      freshHistory();
      assert(history.recordStart({ key: "puzzle:a", title: "A", at: 1 }), "la prima volta è un inizio");
      assert(!history.recordStart({ key: "puzzle:a", title: "A", at: 2 }), "la seconda no");
      history.recordStart({ key: "puzzle:b", title: "B", at: 3 });
      assertEqual(history.startedCount(), 2);
      assertEqual(history.abandonedCases().length, 2);
      history.recordSolveEntry({ key: "puzzle:a", title: "A", elapsedSeconds: 60, hintsUsed: 0, checks: 2, at: 10 });
      assertEqual(
        history
          .abandonedCases()
          .map((c) => c.key)
          .join(","),
        "puzzle:b"
      );
      assertEqual(history.recentSolves()[0].checks, 2, "le verifiche sbagliate restano nello storico");
    },
  },
];
