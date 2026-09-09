import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import * as achievementsStore from "./achievementsStore.js";

const db = getFirestore(firebaseApp);

function achievementsRef(uid) {
  return doc(db, "users", uid, "achievements", "summary");
}

// Pull → merge into the local copy → push the (now-complete) merged copy
// back, so both sides converge to the same union. Safe to call repeatedly
// (idempotent, since merging is associative) — achievements.html calls this
// every time it loads while signed in, so playing on one device and then
// checking achievements.html on another always reconciles correctly,
// without needing any real-time sync while actually playing.
export async function syncAchievements(uid) {
  const snap = await getDoc(achievementsRef(uid));
  const newlyUnlocked = achievementsStore.mergeRemote(snap.exists() ? snap.data() : null);
  await setDoc(achievementsRef(uid), achievementsStore.getRawData());
  return newlyUnlocked;
}
