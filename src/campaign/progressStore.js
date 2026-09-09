import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";

const db = getFirestore(firebaseApp);

function progressRef(uid, campaignId) {
  return doc(db, "users", uid, "campaignProgress", campaignId);
}

// serializeBoardState() (board.js) produces arrays-of-pairs (Map.entries()
// shape) for placements/candidates/autoXByCharacter — Firestore rejects
// nested arrays outright. Converted to arrays-of-objects here, on the way
// in/out, so board.js itself never needs to know Firestore exists.
// NOTE: this is a strict field allowlist, not a shallow passthrough — a new
// scalar field added to serializeBoardState()'s output (e.g. hintsUsed)
// still has to be listed here explicitly in both directions, or it's
// silently dropped before ever reaching Firestore.
function toFirestoreSafe(serialized) {
  return {
    placements: serialized.placements.map(([charId, pos]) => ({ charId, row: pos.row, col: pos.col })),
    xMarks: serialized.xMarks,
    candidates: serialized.candidates.map(([key, ids]) => ({ key, ids })),
    autoXByCharacter: serialized.autoXByCharacter.map(([charId, cells]) => ({ charId, cells })),
    hintsUsed: serialized.hintsUsed,
  };
}

// Inverse of toFirestoreSafe — output matches exactly what
// deserializeBoardState() (board.js, unmodified) already expects.
function fromFirestoreSafe(saved) {
  if (!saved) return undefined;
  return {
    placements: (saved.placements || []).map((p) => [p.charId, { row: p.row, col: p.col }]),
    xMarks: saved.xMarks || [],
    candidates: (saved.candidates || []).map((c) => [c.key, c.ids]),
    autoXByCharacter: (saved.autoXByCharacter || []).map((a) => [a.charId, a.cells]),
    hintsUsed: typeof saved.hintsUsed === "number" ? saved.hintsUsed : 0,
  };
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
export async function markCaseCompleted(uid, campaignId, caseId, caseIndex, elapsedSeconds) {
  const current = await getCampaignProgress(uid, campaignId);
  const completedCaseIds = current.completedCaseIds.includes(caseId)
    ? current.completedCaseIds
    : [...current.completedCaseIds, caseId];
  const unlockedCaseIndex = Math.max(current.unlockedCaseIndex, caseIndex + 1);
  const update = { completedCaseIds, unlockedCaseIndex };
  if (typeof elapsedSeconds === "number") {
    const previousBest = current.cases[caseId]?.bestTimeSeconds;
    const bestTimeSeconds = previousBest == null ? elapsedSeconds : Math.min(previousBest, elapsedSeconds);
    update.cases = { [caseId]: { bestTimeSeconds } };
  }
  await setDoc(progressRef(uid, campaignId), update, { merge: true });
}
