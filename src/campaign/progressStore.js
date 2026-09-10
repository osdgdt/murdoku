import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { toFirestoreSafe, fromFirestoreSafe } from "./progressCodec.js";

const db = getFirestore(firebaseApp);

function progressRef(uid, campaignId) {
  return doc(db, "users", uid, "campaignProgress", campaignId);
}

// { unlockedCaseIndex, completedCaseIds: [...], cases: { [caseId]: { board, updatedAt } } }
// A fresh default (case 0 unlocked, nothing completed) when the player has
// never touched this campaign before — never null, so callers don't need a
// separate "no progress yet" branch.
export async function getCampaignProgress(uid, campaignId) {
  const snap = await getDoc(progressRef(uid, campaignId));
  if (!snap.exists()) return { unlockedCaseIndex: 0, completedCaseIds: [], cases: {} };
  const data = snap.data();
  return {
    unlockedCaseIndex: data.unlockedCaseIndex || 0,
    completedCaseIds: data.completedCaseIds || [],
    cases: data.cases || {},
  };
}

export function boardStateFromProgress(progress, caseId) {
  return fromFirestoreSafe(progress.cases[caseId]?.board);
}

// Merges just this one case's board under `cases.<caseId>` — Firestore's
// `merge:true` recurses into nested map fields, so sibling cases already
// saved under `cases` are left untouched. Called behind a debounce (see
// campaignApp.js's createDebouncedSaver) — never called on every keystroke.
export async function saveCaseBoardState(uid, campaignId, caseId, boardSnapshot) {
  await setDoc(
    progressRef(uid, campaignId),
    { cases: { [caseId]: { board: toFirestoreSafe(boardSnapshot), updatedAt: Date.now() } } },
    { merge: true }
  );
}

// Always called immediately (never debounced, unlike saveCaseBoardState) —
// a rare, high-value write, not part of the continuous placement/note flow.
// `elapsedSeconds` is optional (gameScreen.js's onSolved callback signature
// is shared with playerApp.js, which does track it) — when present, keeps a
// running best time per case under `cases.<caseId>.bestTimeSeconds`, parity
// with the same feature already shipped for single-puzzle play. Firestore's
// `merge:true` recurses into nested map fields, so this write never touches
// `cases.<caseId>.board`/`updatedAt` (already read once above, no extra
// round trip) or any other case's entry.
// A plain getDoc-then-setDoc here would race: setDoc({merge:true}) replaces
// array fields wholesale rather than unioning them, so two concurrent calls
// (two tabs/devices completing different cases near-simultaneously, or a
// retry after a slow network) both reading the same stale doc can have one
// write silently clobber the other's completedCaseIds/unlockedCaseIndex.
// runTransaction makes the read+compute+write atomic instead.
export async function markCaseCompleted(uid, campaignId, caseId, caseIndex, elapsedSeconds) {
  const ref = progressRef(uid, campaignId);
  await runTransaction(db, async (transaction) => {
    // Deliberately transaction.get(ref), not getCampaignProgress(uid,
    // campaignId) — that issues its own untracked getDoc, which the
    // transaction can't use for conflict detection, defeating this fix.
    const snap = await transaction.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const completedCaseIds = data.completedCaseIds || [];
    const nextCompletedCaseIds = completedCaseIds.includes(caseId) ? completedCaseIds : [...completedCaseIds, caseId];
    const unlockedCaseIndex = Math.max(data.unlockedCaseIndex || 0, caseIndex + 1);
    const update = { completedCaseIds: nextCompletedCaseIds, unlockedCaseIndex };
    if (typeof elapsedSeconds === "number") {
      const previousBest = data.cases?.[caseId]?.bestTimeSeconds;
      const bestTimeSeconds = previousBest == null ? elapsedSeconds : Math.min(previousBest, elapsedSeconds);
      update.cases = { [caseId]: { bestTimeSeconds } };
    }
    transaction.set(ref, update, { merge: true });
  });
}
