// Deleting what a signed-in player has stored in the cloud: campaign progress
// and synced achievements (both live under users/{uid}/, which firestore.rules
// lets only that user read and write). Optionally also removes the Firebase
// sign-in record itself.
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAuth, deleteUser } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { firebaseApp } from "../firebaseConfig.js";

const db = getFirestore(firebaseApp);
// (`caseStats`: the markers that stop a case being counted twice in the global statistics; the
// aggregates in the top-level `caseStats` collection hold no personal data and stay.)
const SUBCOLLECTIONS = ["campaignProgress", "achievements", "caseStats", "dailyEntries"];

// Returns the number of documents removed.
export async function deleteCloudData(uid) {
  let removed = 0;
  // The daily challenge keeps a PUBLIC copy of each run (daily/{day}/entries/{uid}) and the nickname's reservation
  // outside users/{uid}: they go first, found through the player's own copies (which are deleted below).
  const runs = await getDocs(collection(db, "users", uid, "dailyEntries"));
  for (const run of runs.docs) {
    await deleteDoc(doc(db, "daily", run.id, "entries", uid));
    removed++;
  }
  const profile = await getDoc(doc(db, "profiles", uid));
  if (profile.exists()) {
    if (profile.data().key) await deleteDoc(doc(db, "nicknames", profile.data().key));
    await deleteDoc(profile.ref);
    removed++;
  }
  for (const name of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, "users", uid, name));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
      removed++;
    }
  }
  return removed;
}

// Removes the account's sign-in record. Firebase refuses with
// `auth/requires-recent-login` when the sign-in is old; the caller then asks
// the user to sign in again and retries.
export async function deleteSignInAccount() {
  const user = getAuth(firebaseApp).currentUser;
  if (!user) return false;
  await deleteUser(user);
  return true;
}
