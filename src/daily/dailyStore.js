// The daily challenge's data in Firestore (the rules are in firestore.rules, "Daily challenge"):
//   profiles/{uid}                         { nickname, key }        the player's nickname (only they read it)
//   nicknames/{key}                        { uid }                  reserves the nickname (lower case) so it is unique
//   users/{uid}/dailyEntries/{dateKey}     { nickname, seconds, checks, caseId, createdAt }   the player's own copy
//   daily/{dateKey}/entries/{uid}          the same, public to signed-in players: the day's board
// A run is written to both entries in one batch; the public one is created once and never changed. Times are
// self-reported (no server checks the solve): a friendly board, not a proof.
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { nicknameKey, validateNickname, entryFromRun } from "./dailyMath.js";

const db = getFirestore(firebaseApp);

export const BOARD_SIZE = 50;

const profileRef = (uid) => doc(db, "profiles", uid);
const reservationRef = (key) => doc(db, "nicknames", key);
const privateEntryRef = (uid, dateKey) => doc(db, "users", uid, "dailyEntries", dateKey);
const publicEntryRef = (uid, dateKey) => doc(db, "daily", dateKey, "entries", uid);

// The player's nickname, or null when they have not chosen one.
export async function getNickname(uid) {
  const snap = await getDoc(profileRef(uid));
  return snap.exists() ? snap.data().nickname : null;
}

// Reserves `raw` as the player's nickname (replacing their old one). Returns { ok: true, nickname } or
// { ok: false, error: "too-short" | "too-long" | "characters" | "taken" }.
export async function chooseNickname(uid, raw) {
  const checked = validateNickname(raw);
  if (!checked.ok) return checked;
  const key = nicknameKey(checked.nickname);
  const taken = await getDoc(reservationRef(key));
  if (taken.exists() && taken.data().uid !== uid) return { ok: false, error: "taken" };
  const old = await getDoc(profileRef(uid));
  const batch = writeBatch(db);
  if (!taken.exists()) batch.set(reservationRef(key), { uid });
  batch.set(profileRef(uid), { nickname: checked.nickname, key });
  if (old.exists() && old.data().key && old.data().key !== key) batch.delete(reservationRef(old.data().key));
  await batch.commit();
  return { ok: true, nickname: checked.nickname };
}

// The player's own run of that day, or null.
export async function getMyEntry(uid, dateKey) {
  const snap = await getDoc(privateEntryRef(uid, dateKey));
  return snap.exists() ? snap.data() : null;
}

// Records a finished run: { nickname, seconds, checks, caseId } (forced inside the bounds). Fails (the rules
// refuse it) when the day is not today in UTC, when a run for that day already exists, or when the nickname is
// not the reserved one.
export async function submitRun(uid, dateKey, run) {
  const entry = { ...entryFromRun(run), createdAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(privateEntryRef(uid, dateKey), entry);
  batch.set(publicEntryRef(uid, dateKey), entry);
  await batch.commit();
}

// The day's board: the fastest `BOARD_SIZE` entries, each with its player's uid and `createdAt` as a number.
export async function getBoard(dateKey) {
  const snap = await getDocs(query(collection(db, "daily", dateKey, "entries"), orderBy("seconds"), limit(BOARD_SIZE)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      nickname: data.nickname,
      seconds: data.seconds,
      checks: data.checks,
      caseId: data.caseId,
      createdAt: data.createdAt?.seconds ?? 0,
    };
  });
}
