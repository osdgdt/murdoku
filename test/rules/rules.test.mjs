// firestore.rules against the Firebase emulator (`npm run test:rules`). Covers what the app relies on for its data:
// the global case statistics (caseStats) and the daily challenge (profiles, nicknames, daily entries). Nothing
// else in the rules file is tested here (campaign progress/achievements are plain "owner only" rules).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
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
  where,
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

// ============================================================================================ shared cases
// (published through the Cloud Functions, which bypass these rules: the page only reads)

const card = (over = {}) => ({
  title: "Il faro",
  titleLower: "il faro",
  status: "active",
  authorUid: "author",
  authorNick: "Gianna",
  license: "cc-by",
  revision: 1,
  createdAt: 1, // (a query that orders by a field only returns the documents that have it)
  ...over,
});
const seedCase = (code, over = {}) =>
  seed(async (db) => {
    await setDoc(doc(db, "cases", code), card(over));
    await setDoc(doc(db, "cases", code, "revisions", "1"), { json: "{}", bytes: 2 });
  });

test("shared cases: anybody, signed in or not, reads an active case and its revision; nobody writes them from the page", async () => {
  await seedCase("ACDEFGHJ");
  for (const db of [anon(), as("reader")]) {
    await assertSucceeds(getDoc(doc(db, "cases", "ACDEFGHJ")));
    await assertSucceeds(getDoc(doc(db, "cases", "ACDEFGHJ", "revisions", "1")));
  }
  for (const db of [anon(), as("author"), as("reader")]) {
    await assertFails(setDoc(doc(db, "cases", "NEWCODE1"), card()));
    await assertFails(setDoc(doc(db, "cases", "ACDEFGHJ"), card({ title: "Altro" }), { merge: true }));
    await assertFails(deleteDoc(doc(db, "cases", "ACDEFGHJ")));
    await assertFails(setDoc(doc(db, "cases", "ACDEFGHJ", "revisions", "2"), { json: "{}" }));
    await assertFails(deleteDoc(doc(db, "cases", "ACDEFGHJ", "revisions", "1")));
  }
});

test("shared cases: anybody lists what is in the gallery, 30 at a time; the revisions are never listed", async () => {
  await seedCase("ACDEFGHJ", { inGallery: true, listed: true });
  await seedCase("KMNPQRTU", { status: "withdrawn", inGallery: false });
  await seedCase("VWXY3469", { listed: false, inGallery: false }); // active, but only with its code
  const db = anon();
  const cases = collection(db, "cases");
  const gallery = where("inGallery", "==", true);
  const found = await assertSucceeds(getDocs(query(cases, gallery, orderBy("createdAt", "desc"), limit(30))));
  assert.deepEqual(
    found.docs.map((d) => d.id),
    ["ACDEFGHJ"]
  );
  await assertSucceeds(getDocs(query(cases, gallery, where("lang", "==", "it"), where("tags", "array-contains", "mistero"), limit(12))));
  await assertSucceeds(
    getDocs(query(cases, gallery, where("titleLower", ">=", "il"), where("titleLower", "<", "il\uf8ff"), orderBy("titleLower"), limit(12)))
  );
  await assertFails(getDocs(query(cases, gallery, limit(31))));
  await assertFails(getDocs(query(cases, gallery))); // no limit: refused
  await assertFails(getDocs(query(cases, limit(10)))); // not restricted to the gallery: would show the others
  await assertFails(getDocs(query(cases, where("status", "==", "active"), limit(10)))); // active is not enough: it may be unlisted
  await assertFails(getDocs(query(cases, where("inGallery", "==", false), limit(10))));
  await assertFails(getDocs(query(cases, where("listed", "==", false), limit(10))));
  await assertFails(getDocs(collection(db, "cases", "ACDEFGHJ", "revisions")));
  await assertFails(getDocs(query(collection(db, "cases", "ACDEFGHJ", "revisions"), limit(5))));
  // an unlisted case is still read by whoever has its code
  await assertSucceeds(getDoc(doc(db, "cases", "VWXY3469")));
  await assertSucceeds(getDoc(doc(db, "cases", "VWXY3469", "revisions", "1")));
});

test("shared cases: an author lists all their own cases (listed or not, withdrawn too), nobody else's; an admin lists everything", async () => {
  await seedCase("ACDEFGHJ", { inGallery: true });
  await seedCase("KMNPQRTU", { status: "withdrawn", inGallery: false });
  await seedCase("VWXY3469", { listed: false, inGallery: false });
  await seedCase("CDEFGHJK", { authorUid: "other", listed: false, inGallery: false });
  await seed((db) => setDoc(doc(db, "admins", "moderator"), { since: 1 }));
  const cases = (db) => collection(db, "cases");
  const mine = await assertSucceeds(
    getDocs(query(cases(as("author")), where("authorUid", "==", "author"), orderBy("createdAt", "desc"), limit(30)))
  );
  assert.deepEqual(mine.docs.map((d) => d.id).sort(), ["ACDEFGHJ", "KMNPQRTU", "VWXY3469"]);
  await assertFails(getDocs(query(cases(as("author")), where("authorUid", "==", "other"), limit(10)))); // somebody else's
  await assertFails(getDocs(query(cases(anon()), where("authorUid", "==", "author"), limit(10)))); // not signed in
  await assertFails(getDocs(query(cases(as("author")), limit(10)))); // "mine" has to be said
  await assertFails(getDocs(query(cases(as("reader")), where("authorUid", "==", "author"), limit(10))));
  // the author's own cases through the gallery's filters are fine too (they are in it)
  await assertSucceeds(getDocs(query(cases(as("reader")), where("inGallery", "==", true), where("authorUid", "==", "author"), limit(10))));
  const everything = await assertSucceeds(getDocs(query(cases(as("moderator")), orderBy("createdAt", "desc"), limit(30))));
  assert.equal(everything.size, 4);
  await assertFails(getDocs(query(cases(as("moderator")), limit(31))));
});

test("shared cases: a withdrawn or hidden case, and its revisions, are for its author and the admins only", async () => {
  await seedCase("KMNPQRTU", { status: "withdrawn" });
  await seedCase("VWXY3469", { status: "hidden" });
  await seed((db) => setDoc(doc(db, "admins", "moderator"), { since: 1 }));
  for (const code of ["KMNPQRTU", "VWXY3469"]) {
    await assertFails(getDoc(doc(anon(), "cases", code)));
    await assertFails(getDoc(doc(as("reader"), "cases", code)));
    await assertFails(getDoc(doc(anon(), "cases", code, "revisions", "1")));
    await assertFails(getDoc(doc(as("reader"), "cases", code, "revisions", "1")));
    await assertSucceeds(getDoc(doc(as("author"), "cases", code)));
    await assertSucceeds(getDoc(doc(as("author"), "cases", code, "revisions", "1")));
    await assertSucceeds(getDoc(doc(as("moderator"), "cases", code)));
    await assertSucceeds(getDoc(doc(as("moderator"), "cases", code, "revisions", "1")));
  }
});

test("shared cases: a person reads only their own 'I like it' marker; who played, the reports and the follow summary are not for the page", async () => {
  await seedCase("ACDEFGHJ", { inGallery: true });
  await seed(async (db) => {
    await setDoc(doc(db, "cases", "ACDEFGHJ", "likes", "reader"), { uid: "reader" });
    await setDoc(doc(db, "cases", "ACDEFGHJ", "plays", "reader"), { uid: "reader", opened: true });
    await setDoc(doc(db, "reports", "ACDEFGHJ_reader"), { caseCode: "ACDEFGHJ", reporterUid: "reader", reason: "spam", status: "open" });
    await setDoc(doc(db, "admins", "moderator"), { since: 1 });
    await setDoc(doc(db, "users", "reader", "following", "author"), { authorUid: "author", nick: "Gianna" });
    await setDoc(doc(db, "users", "reader", "social", "summary"), { following: 1 });
  });
  await assertSucceeds(getDoc(doc(as("reader"), "cases", "ACDEFGHJ", "likes", "reader")));
  await assertFails(getDoc(doc(as("author"), "cases", "ACDEFGHJ", "likes", "reader")));
  await assertFails(getDoc(doc(anon(), "cases", "ACDEFGHJ", "likes", "reader")));
  await assertFails(getDocs(query(collection(as("reader"), "cases", "ACDEFGHJ", "likes"), limit(5))));
  await assertFails(setDoc(doc(as("reader"), "cases", "ACDEFGHJ", "likes", "reader"), { uid: "reader" }));
  await assertFails(deleteDoc(doc(as("reader"), "cases", "ACDEFGHJ", "likes", "reader")));
  for (const who of [anon(), as("reader"), as("author"), as("moderator")]) {
    await assertFails(getDoc(doc(who, "cases", "ACDEFGHJ", "plays", "reader")));
    await assertFails(getDoc(doc(who, "users", "reader", "social", "summary")));
  }
  // reports: the administrators only, and nobody writes them from the page
  await assertSucceeds(getDoc(doc(as("moderator"), "reports", "ACDEFGHJ_reader")));
  await assertSucceeds(getDocs(query(collection(as("moderator"), "reports"), where("caseCode", "==", "ACDEFGHJ"), limit(50))));
  await assertFails(getDocs(query(collection(as("moderator"), "reports"), limit(51))));
  for (const who of [anon(), as("reader"), as("author")]) {
    await assertFails(getDoc(doc(who, "reports", "ACDEFGHJ_reader")));
    await assertFails(getDocs(query(collection(who, "reports"), limit(10))));
  }
  await assertFails(setDoc(doc(as("reader"), "reports", "ACDEFGHJ_reader2"), { caseCode: "ACDEFGHJ", reporterUid: "reader" }));
  await assertFails(setDoc(doc(as("moderator"), "reports", "ACDEFGHJ_x"), { caseCode: "ACDEFGHJ" }));
  // who a person follows: theirs to read (30 at a time), nobody writes it from the page
  await assertSucceeds(getDoc(doc(as("reader"), "users", "reader", "following", "author")));
  await assertSucceeds(getDocs(query(collection(as("reader"), "users", "reader", "following"), limit(30))));
  await assertFails(getDocs(query(collection(as("reader"), "users", "reader", "following"), limit(31))));
  await assertFails(getDoc(doc(as("author"), "users", "reader", "following", "author")));
  await assertFails(getDoc(doc(anon(), "users", "reader", "following", "author")));
  await assertFails(setDoc(doc(as("reader"), "users", "reader", "following", "other"), { authorUid: "other" }));
  await assertFails(deleteDoc(doc(as("reader"), "users", "reader", "following", "author")));
});

test("shared cases: the feed of the authors a person follows is a query on the gallery (in list, 30 authors)", async () => {
  await seedCase("ACDEFGHJ", { inGallery: true, authorUid: "a1" });
  await seedCase("KMNPQRTU", { inGallery: false, listed: false, authorUid: "a1" });
  await seedCase("VWXY3466", { inGallery: true, authorUid: "a2" });
  const feed = await assertSucceeds(
    getDocs(
      query(
        collection(as("reader"), "cases"),
        where("inGallery", "==", true),
        where("authorUid", "in", ["a1", "a2"]),
        orderBy("createdAt", "desc"),
        limit(12)
      )
    )
  );
  assert.deepEqual(feed.docs.map((d) => d.id).sort(), ["ACDEFGHJ", "VWXY3466"]);
  await assertFails(getDocs(query(collection(as("reader"), "cases"), where("authorUid", "in", ["a1", "a2"]), limit(12)))); // without the gallery
});

test("shared cases: authors are public (listed 30 at a time), the author's own list is private, the server's bookkeeping is out of reach", async () => {
  await seed(async (db) => {
    await setDoc(doc(db, "authors", "author"), { nick: "Gianna", nickLower: "gianna", caseCount: 1 });
    await setDoc(doc(db, "users", "author", "published", "ACDEFGHJ"), { code: "ACDEFGHJ", title: "Il faro" });
    await setDoc(doc(db, "users", "author", "publishLog", "2026-11-20"), { publishes: 1 });
    await setDoc(doc(db, "caseHashes", "abc"), { code: "ACDEFGHJ" });
    await setDoc(doc(db, "config", "limits"), { publishPerDay: 5 });
  });
  await assertSucceeds(getDoc(doc(anon(), "authors", "author")));
  await assertSucceeds(getDocs(query(collection(anon(), "authors"), limit(30))));
  await assertFails(getDocs(query(collection(anon(), "authors"), limit(31))));
  await assertFails(setDoc(doc(as("author"), "authors", "author"), { nick: "X", caseCount: 99 }));
  await assertFails(deleteDoc(doc(as("author"), "authors", "author")));

  await assertSucceeds(getDoc(doc(as("author"), "users", "author", "published", "ACDEFGHJ")));
  await assertSucceeds(getDocs(collection(as("author"), "users", "author", "published")));
  await assertFails(getDoc(doc(as("other"), "users", "author", "published", "ACDEFGHJ")));
  await assertFails(getDoc(doc(anon(), "users", "author", "published", "ACDEFGHJ")));
  await assertFails(setDoc(doc(as("author"), "users", "author", "published", "NEWCODE1"), { code: "NEWCODE1" }));
  await assertFails(deleteDoc(doc(as("author"), "users", "author", "published", "ACDEFGHJ")));

  for (const path of [
    ["users", "author", "publishLog", "2026-11-20"],
    ["caseHashes", "abc"],
    ["config", "limits"],
  ]) {
    await assertFails(getDoc(doc(as("author"), ...path)));
    await assertFails(setDoc(doc(as("author"), ...path), { publishes: 0 }));
    await assertFails(getDoc(doc(anon(), ...path)));
  }
});
