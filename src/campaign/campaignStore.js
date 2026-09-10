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

export async function getCampaign(id) {
  const snap = await getDoc(doc(db, "campaigns", id));
  return snap.exists() ? snap.data() : null;
}

export async function saveCampaign(campaign) {
  const { valid, errors } = validateCampaignShape(campaign);
  if (!valid) throw new Error(errors.join(" "));
  await setDoc(doc(db, "campaigns", campaign.id), campaign);
}
