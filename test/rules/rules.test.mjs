// firestore.rules against the Firebase emulator (`npm run test:rules`). Covers what the app relies on for its data:
// the global case statistics (caseStats) and the daily challenge (profiles, nicknames, daily entries). Nothing
// else in the rules file is tested here (campaign progress/achievements are plain "owner only" rules).
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const PROJECT = "demo-murdoku";
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  // a campaign must exist for its case statistics to be accepted
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "campaigns", "campaign_a"), { title: "A" }));
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));

// UTC date as the server sees it
const today = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400_000).toISOString().slice(0, 10);

// ============================================================================================ caseStats

const statsKey = "campaign_a__case_1";
const newPlayer = (db, uid, key = statsKey) => {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid, "caseStats", key), { started: true, solved: false });
  batch.set(
    doc(db, "caseStats", key),
    { starts: increment(1), solves: increment(0), totalSeconds: increment(0), totalHints: increment(0), totalChecks: increment(0) },
    { merge: true }
  );
  return batch.commit();
};
const solve = (db, uid, add, key = statsKey) => {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid, "caseStats", key), { solved: true });
  batch.set(
    doc(db, "caseStats", key),
    {
      starts: increment(0),
      solves: increment(1),
      totalSeconds: increment(add.seconds),
      totalHints: increment(add.hints),
      totalChecks: increment(add.checks),
    },
    { merge: true }
  );
  return batch.commit();
};

test("caseStats: a new player is counted once, together with their own marker", async () => {
  await assertSucceeds(newPlayer(as("u1"), "u1"));
  await assertFails(newPlayer(as("u1"), "u1")); // the marker exists now: cannot count again
  await assertSucceeds(newPlayer(as("u2"), "u2")); // another player can
});

test("caseStats: nobody changes the totals without creating their marker in the same batch", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "caseStats", statsKey), { starts: 5, solves: 0, totalSeconds: 0, totalHints: 0, totalChecks: 0 }));
  const batch = writeBatch(db);
  batch.set(
    doc(db, "caseStats", statsKey),
    { starts: increment(1), solves: increment(0), totalSeconds: increment(0), totalHints: increment(0), totalChecks: increment(0) },
    { merge: true }
  );
  await assertFails(batch.commit());
});

test("caseStats: a known player's solve adds one solve inside the bounds; too much or twice is refused", async () => {
  await assertSucceeds(newPlayer(as("u1"), "u1"));
  await assertFails(solve(as("u1"), "u1", { seconds: 86401, hints: 0, checks: 0 }));
  await assertFails(solve(as("u1"), "u1", { seconds: 100, hints: 51, checks: 0 }));
  await assertFails(solve(as("u1"), "u1", { seconds: 100, hints: 0, checks: 201 }));
  await assertSucceeds(solve(as("u1"), "u1", { seconds: 600, hints: 2, checks: 1 }));
  await assertFails(solve(as("u1"), "u1", { seconds: 600, hints: 2, checks: 1 })); // already solved
});

test("caseStats: unknown campaign, bad key, and reading rules", async () => {
  await assertFails(newPlayer(as("u1"), "u1", "campaign_zzz__case_1"));
  await assertFails(newPlayer(as("u1"), "u1", "not-a-key"));
  await assertSucceeds(newPlayer(as("u1"), "u1"));
  await assertSucceeds(getDoc(doc(as("u9"), "caseStats", statsKey))); // any signed-in player reads one case
  await assertFails(getDoc(doc(anon(), "caseStats", statsKey)));
  await assertFails(getDocs(collection(as("u9"), "caseStats"))); // never the list
  await assertFails(deleteDoc(doc(as("u1"), "caseStats", statsKey)));
});

test("caseStats: a player's marker is theirs alone", async () => {
  await assertSucceeds(newPlayer(as("u1"), "u1"));
  await assertSucceeds(getDoc(doc(as("u1"), "users", "u1", "caseStats", statsKey)));
  await assertFails(getDoc(doc(as("u2"), "users", "u1", "caseStats", statsKey)));
});

// ============================================================================================ nicknames

const choose = (db, uid, nickname, key = nickname.toLowerCase()) => {
  const batch = writeBatch(db);
  batch.set(doc(db, "nicknames", key), { uid });
  batch.set(doc(db, "profiles", uid), { nickname, key });
  return batch.commit();
};

test("nickname: choosing one reserves it; the same one (any case) is refused to another player", async () => {
  await assertSucceeds(choose(as("u1"), "u1", "Poirot"));
  await assertFails(choose(as("u2"), "u2", "POIROT")); // same reservation key
  await assertFails(choose(as("u2"), "u2", "poirot"));
  await assertSucceeds(choose(as("u2"), "u2", "Marple"));
});

test("nickname: only 3-20 letters, digits, spaces and . _ ' - are accepted", async () => {
  await assertFails(choose(as("u1"), "u1", "ab"));
  await assertFails(choose(as("u1"), "u1", "a".repeat(21)));
  await assertFails(choose(as("u1"), "u1", "<script>"));
  await assertFails(choose(as("u1"), "u1", "..."));
  await assertSucceeds(choose(as("u1"), "u1", "Zoë d'Arc-1"));
});

test("nickname: a profile needs its reservation, and the key must be the lower-case nickname", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "profiles", "u1"), { nickname: "Poirot", key: "poirot" }));
  const batch = writeBatch(db);
  batch.set(doc(db, "nicknames", "poirot"), { uid: "u1" });
  batch.set(doc(db, "profiles", "u1"), { nickname: "Poirot", key: "other" });
  await assertFails(batch.commit());
  // a reservation made for someone else's uid
  const b2 = writeBatch(db);
  b2.set(doc(db, "nicknames", "poirot"), { uid: "u2" });
  b2.set(doc(db, "profiles", "u1"), { nickname: "Poirot", key: "poirot" });
  await assertFails(b2.commit());
});

test("nickname: renaming moves the reservation; nobody deletes or edits another player's", async () => {
  await assertSucceeds(choose(as("u1"), "u1", "Poirot"));
  const db = as("u1");
  const rename = writeBatch(db);
  rename.set(doc(db, "nicknames", "hastings"), { uid: "u1" });
  rename.set(doc(db, "profiles", "u1"), { nickname: "Hastings", key: "hastings" });
  rename.delete(doc(db, "nicknames", "poirot"));
  await assertSucceeds(rename.commit());
  await assertSucceeds(choose(as("u2"), "u2", "Poirot")); // free again
  await assertFails(deleteDoc(doc(db, "nicknames", "poirot"))); // now u2's
  await assertFails(setDoc(doc(db, "nicknames", "hastings"), { uid: "u3" }));
  await assertFails(getDocs(collection(db, "nicknames"))); // never the list
  await assertSucceeds(getDoc(doc(db, "nicknames", "hastings"))); // availability check
});

test("nickname: a profile is private to its player, who can delete it", async () => {
  await assertSucceeds(choose(as("u1"), "u1", "Poirot"));
  await assertSucceeds(getDoc(doc(as("u1"), "profiles", "u1")));
  await assertFails(getDoc(doc(as("u2"), "profiles", "u1")));
  await assertFails(getDoc(doc(anon(), "profiles", "u1")));
  await assertSucceeds(deleteDoc(doc(as("u1"), "profiles", "u1")));
});

// ============================================================================================ daily challenge

const run = (overrides = {}) => ({
  nickname: "Poirot",
  seconds: 300,
  checks: 1,
  caseId: "faro",
  createdAt: serverTimestamp(),
  ...overrides,
});
const submit = (db, uid, data, dateKey = today()) => {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid, "dailyEntries", dateKey), data);
  batch.set(doc(db, "daily", dateKey, "entries", uid), data);
  return batch.commit();
};
const withProfile = async (uid = "u1", nickname = "Poirot") =>
  seed((db) => setDoc(doc(db, "profiles", uid), { nickname, key: nickname.toLowerCase() }));

test("daily: a signed-in player with a nickname records today's run, once", async () => {
  await withProfile();
  await assertSucceeds(submit(as("u1"), "u1", run()));
  await assertFails(submit(as("u1"), "u1", run({ seconds: 100 }))); // a second run for the day: no
});

test("daily: the run's numbers stay inside the bounds, with no extra fields (no hints)", async () => {
  await withProfile();
  await assertFails(submit(as("u1"), "u1", run({ seconds: 19 })));
  await assertFails(submit(as("u1"), "u1", run({ seconds: 86401 })));
  await assertFails(submit(as("u1"), "u1", run({ seconds: 100.5 })));
  await assertFails(submit(as("u1"), "u1", run({ checks: 201 })));
  await assertFails(submit(as("u1"), "u1", run({ checks: -1 })));
  await assertFails(submit(as("u1"), "u1", run({ hints: 0 })));
  await assertFails(submit(as("u1"), "u1", run({ caseId: "x".repeat(101) })));
  await assertSucceeds(submit(as("u1"), "u1", run({ seconds: 20, checks: 0 })));
});

test("daily: the time of the entry is the server's, and only today (UTC) can be played", async () => {
  await withProfile();
  await assertFails(submit(as("u1"), "u1", run({ createdAt: Timestamp.fromDate(new Date(Date.now() - 3600_000)) })));
  await assertFails(submit(as("u1"), "u1", run(), today(-1)));
  await assertFails(submit(as("u1"), "u1", run(), today(1)));
  await assertSucceeds(submit(as("u1"), "u1", run()));
});

test("daily: the nickname on the entry must be the player's own reserved one", async () => {
  await withProfile();
  await assertFails(submit(as("u1"), "u1", run({ nickname: "Someone else" })));
  await assertFails(submit(as("u2"), "u2", run())); // u2 has no profile at all
});

test("daily: an entry belongs to its player; the public one needs the player's own copy", async () => {
  await withProfile();
  await assertFails(setDoc(doc(as("u2"), "daily", today(), "entries", "u1"), run())); // someone else's uid
  await assertFails(setDoc(doc(as("u1"), "daily", today(), "entries", "u1"), run())); // no private copy in the same batch
  await assertFails(submit(anon(), "u1", run()));
  const db = as("u1");
  const batch = writeBatch(db);
  batch.set(doc(db, "users", "u1", "dailyEntries", today()), run());
  await assertSucceeds(batch.commit()); // the private copy alone is allowed (it is the player's own)
});

test("daily: the board is readable by signed-in players, in pages of at most 50; nobody edits it", async () => {
  await withProfile();
  await assertSucceeds(submit(as("u1"), "u1", run()));
  const entries = (db, ...extra) => query(collection(db, "daily", today(), "entries"), orderBy("seconds"), ...extra);
  await assertSucceeds(getDocs(entries(as("u2"), limit(50))));
  await assertFails(getDocs(entries(as("u2")))); // no limit
  await assertFails(getDocs(entries(as("u2"), limit(51))));
  await assertFails(getDocs(entries(anon(), limit(50))));
  await assertSucceeds(getDoc(doc(as("u2"), "daily", today(), "entries", "u1")));
  await assertFails(setDoc(doc(as("u1"), "daily", today(), "entries", "u1"), run({ seconds: 25 }))); // no changes
  await assertFails(setDoc(doc(as("u2"), "daily", today(), "entries", "u1"), run({ seconds: 25 })));
});

test("daily: a player deletes their own entries (the public one too) and nobody else's", async () => {
  await withProfile();
  await assertSucceeds(submit(as("u1"), "u1", run()));
  await assertFails(deleteDoc(doc(as("u2"), "daily", today(), "entries", "u1")));
  await assertFails(getDoc(doc(as("u2"), "users", "u1", "dailyEntries", today())));
  await assertSucceeds(getDoc(doc(as("u1"), "users", "u1", "dailyEntries", today())));
  await assertSucceeds(deleteDoc(doc(as("u1"), "daily", today(), "entries", "u1")));
  await assertSucceeds(deleteDoc(doc(as("u1"), "users", "u1", "dailyEntries", today())));
});
