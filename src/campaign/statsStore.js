// Global statistics of the campaign cases: one small aggregate per case in `caseStats/{key}`
// (how many players started it and solved it, and the totals of time, hints and wrong checks), fed
// by every signed-in player ONCE per case. The once-only part is a marker the player owns,
// `users/{uid}/caseStats/{key}`, created in the same batch as the aggregate's increment: the
// Firestore rules (firestore.rules) accept the increment only together with that new marker, so
// a player cannot count twice. The numbers are self-reported: indicative, not exact.
//
// Everything here is best-effort: a failure (rules not published yet, offline) never gets in the
// way of playing, so callers just log it. The maths and the bounds are in statsMath.js.
import { getFirestore, doc, getDoc, writeBatch, increment } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { caseStatsKey, solveContribution } from "./statsMath.js";
import { readJson, tryWriteJson } from "../storage/storage.js";

const db = getFirestore(firebaseApp);

const aggregateRef = (key) => doc(db, "caseStats", key);
const markerRef = (uid, key) => doc(db, "users", uid, "caseStats", key);

// What this device already knows it has sent, so a case is not looked up on every visit.
const SENT_KEY = "murdoku:case-stats-sent";
const sentKey = (uid, key, what) => `${uid}:${key}:${what}`;
const wasSent = (uid, key, what) => !!readJson(SENT_KEY, {})[sentKey(uid, key, what)];
function markSent(uid, key, what) {
  const sent = readJson(SENT_KEY, {});
  sent[sentKey(uid, key, what)] = 1;
  tryWriteJson(SENT_KEY, sent);
}

// The player opens a case for the first time (ever, for this account): counts one player.
export async function recordCaseStart(uid, campaignId, caseId) {
  const key = caseStatsKey(campaignId, caseId);
  if (wasSent(uid, key, "start")) return;
  const marker = await getDoc(markerRef(uid, key));
  if (!marker.exists()) {
    const batch = writeBatch(db);
    batch.set(markerRef(uid, key), { started: true, solved: false });
    batch.set(
      aggregateRef(key),
      { starts: increment(1), solves: increment(0), totalSeconds: increment(0), totalHints: increment(0), totalChecks: increment(0) },
      { merge: true }
    );
    await batch.commit();
  }
  markSent(uid, key, "start");
}

// The player solves a case for the first time: adds this solve to the totals.
export async function recordCaseSolved(uid, campaignId, caseId, { seconds, hints, checks }) {
  const key = caseStatsKey(campaignId, caseId);
  if (wasSent(uid, key, "solve")) return;
  const marker = await getDoc(markerRef(uid, key));
  if (marker.exists() && marker.data().solved === true) {
    markSent(uid, key, "solve");
    return;
  }
  const add = solveContribution({ seconds, hints, checks });
  const batch = writeBatch(db);
  if (marker.exists()) batch.update(markerRef(uid, key), { solved: true });
  else batch.set(markerRef(uid, key), { started: true, solved: true });
  batch.set(
    aggregateRef(key),
    {
      starts: increment(marker.exists() ? 0 : 1),
      solves: increment(1),
      totalSeconds: increment(add.seconds),
      totalHints: increment(add.hints),
      totalChecks: increment(add.checks),
    },
    { merge: true }
  );
  await batch.commit();
  markSent(uid, key, "solve");
}

// The aggregate of a case, or null.
export async function getCaseStats(campaignId, caseId) {
  const snap = await getDoc(aggregateRef(caseStatsKey(campaignId, caseId)));
  return snap.exists() ? snap.data() : null;
}
