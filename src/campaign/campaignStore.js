import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { validateCampaignShape } from "./campaignModel.js";

const db = getFirestore(firebaseApp);

// Any signed-in user may read (see firestore.rules); only the owner's writes
// are accepted — a non-owner's saveCampaign() rejects with a Firestore
// "permission-denied" error, which callers surface to the UI as-is.
export async function listCampaigns() {
  const snap = await getDocs(collection(db, "campaigns"));
  return snap.docs.map((d) => d.data());
}

// The site's original owner. firestore.rules keeps this uid as a permanent
// bootstrap admin so a misconfigured `admins` collection can never lock the
// owner out; everyone else is an admin only if an `admins/{uid}` document
// exists (created by hand in the Firebase console — rules forbid client writes).
export const BOOTSTRAP_OWNER_UID = "say3jOf6WkaXDmjyn3kmAKNYbCh1";

// UX gate for the campaign editor only — the real boundary is firestore.rules,
// which re-checks the same condition on every write.
export async function isCampaignAdmin(uid) {
  if (!uid) return false;
  if (uid === BOOTSTRAP_OWNER_UID) return true;
  try {
    return (await getDoc(doc(db, "admins", uid))).exists();
  } catch {
    return false;
  }
}

export async function getCampaign(id) {
  const snap = await getDoc(doc(db, "campaigns", id));
  return snap.exists() ? snap.data() : null;
}

export async function saveCampaign(campaign) {
  const { valid, errors } = validateCampaignShape(campaign);
  if (!valid) throw new Error(errors.join(" "));
  await setDoc(doc(db, "campaigns", campaign.id), campaign);
}
