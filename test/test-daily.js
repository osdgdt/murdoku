import {
  utcDateKey,
  previousDateKey,
  isDateKey,
  validateNickname,
  nicknameKey,
  entryFromRun,
  rankEntries,
  positionOf,
  LIMITS,
} from "../src/daily/dailyMath.js";
import { caseOfTheDay } from "../src/player/libraryPanel.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "sfida del giorno: la chiave del giorno è la data UTC, uguale per tutti, e il giorno prima si calcola anche a cavallo di mese e anno",
    fn: () => {
      assertEqual(utcDateKey(new Date("2026-03-05T23:59:59Z")), "2026-03-05");
      assertEqual(utcDateKey(new Date("2026-03-06T00:00:00Z")), "2026-03-06");
      assertEqual(previousDateKey("2026-03-01"), "2026-02-28");
      assertEqual(previousDateKey("2026-01-01"), "2025-12-31");
      assertEqual(previousDateKey("2028-03-01"), "2028-02-29", "anno bisestile");
      assert(isDateKey("2026-03-05") && !isDateKey("2026-3-5") && !isDateKey("2026-13-40") && !isDateKey(null));
    },
  },
  {
    name: "sfida del giorno: la chiave del giorno e il caso del giorno cambiano alla stessa ora (mezzanotte UTC)",
    fn: () => {
      const entries = [{ id: "a" }, { id: "b" }, { id: "c" }];
      const before = new Date("2026-03-05T23:59:59Z");
      const after = new Date("2026-03-06T00:00:01Z");
      assert(utcDateKey(before) !== utcDateKey(after));
      assert(caseOfTheDay(entries, before).id !== caseOfTheDay(entries, after).id);
      assertEqual(
        caseOfTheDay(entries, new Date("2026-03-05T00:00:00Z")).id,
        caseOfTheDay(entries, before).id,
        "stesso giorno, stesso caso"
      );
    },
  },
  {
    name: "nickname: 3-20 caratteri, lettere/cifre/spazio/. _ ' -, spazi sistemati; rifiuta vuoto, troppo corto/lungo e simboli",
    fn: () => {
      assertEqual(validateNickname("  Sherlock   H.  ").nickname, "Sherlock H.");
      assert(validateNickname("Zoë").ok && validateNickname("名探偵").ok && validateNickname("Agatha_C-1").ok);
      assertEqual(validateNickname("ab").error, "too-short");
      assertEqual(validateNickname("   ").error, "too-short");
      assertEqual(validateNickname("a".repeat(21)).error, "too-long");
      assertEqual(validateNickname("<script>").error, "characters");
      assertEqual(validateNickname("...").error, "characters", "solo punteggiatura non è un nome");
      assertEqual(validateNickname("a@b.it").error, "characters");
      assertEqual(validateNickname(null).error, "too-short");
    },
  },
  {
    name: "nickname: due scritture che differiscono solo per le maiuscole hanno la stessa chiave",
    fn: () => assertEqual(nicknameKey("Poirot"), nicknameKey("POIROT")),
  },
  {
    name: "voce della classifica: tempo e verifiche sbagliate restano nei limiti, il caso è accorciato",
    fn: () => {
      const e = entryFromRun({ nickname: "x", seconds: 1, checks: -4, caseId: "c".repeat(500) });
      assertEqual(e.seconds, LIMITS.minSeconds);
      assertEqual(e.checks, 0);
      assertEqual(e.caseId.length, 100);
      assertEqual(entryFromRun({ nickname: "x", seconds: 10 ** 9, checks: 9999, caseId: "c" }).seconds, LIMITS.maxSeconds);
      assertEqual(entryFromRun({ nickname: "x", seconds: 100, checks: 9999, caseId: "c" }).checks, LIMITS.maxChecks);
    },
  },
  {
    name: "classifica: prima il tempo, poi meno verifiche sbagliate, poi chi ha finito prima; i pari merito dividono la posizione",
    fn: () => {
      const entries = [
        { uid: "d", seconds: 300, checks: 0, createdAt: 40 },
        { uid: "a", seconds: 120, checks: 2, createdAt: 10 },
        { uid: "b", seconds: 120, checks: 2, createdAt: 20 },
        { uid: "c", seconds: 120, checks: 0, createdAt: 30 },
      ];
      const ranked = rankEntries(entries);
      assertEqual(ranked.map((e) => e.uid).join(""), "cabd");
      assertEqual(ranked.map((e) => e.rank).join(","), "1,2,2,4", "a e b hanno lo stesso tempo e le stesse verifiche: pari merito");
      assertEqual(JSON.stringify(positionOf(entries, "d")), JSON.stringify({ rank: 4, of: 4 }));
      assertEqual(positionOf(entries, "zzz"), null);
    },
  },
  {
    name: "classifica: legge anche la data di creazione come timestamp di Firestore ({seconds})",
    fn: () => {
      const ranked = rankEntries([
        { uid: "b", seconds: 100, checks: 0, createdAt: { seconds: 20 } },
        { uid: "a", seconds: 100, checks: 0, createdAt: { seconds: 10 } },
      ]);
      assertEqual(ranked[0].uid, "a");
      assertEqual(ranked.map((e) => e.rank).join(), "1,1");
      assertEqual(rankEntries([]).length, 0);
    },
  },
];
