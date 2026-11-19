// The page's door to the list of cases (the page is community.html; the rules are in firestore.rules, "Shared cases"). Reading is
// open to everybody; what a query may ask for is decided in galleryQuery.js and checked again by the rules. Needs Firebase, so
// only the gallery page loads it.
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { buildCaseQuery, normalizeSearch } from "./galleryQuery.js";
import { toCommunityError } from "./errors.js";

const db = getFirestore(firebaseApp);

// One page of cards: -> { cards: [{ code, ...card }], cursor, done }. `cursor` (from the page before) asks for the next one.
export async function fetchCards(filters, cursor = null, pageSize = undefined) {
  const shape = buildCaseQuery(filters, pageSize);
  const parts = [...shape.where.map(([field, op, value]) => where(field, op, value)), orderBy(...shape.orderBy)];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limit(shape.limit));
  let snap;
  try {
    snap = await getDocs(query(collection(db, "cases"), ...parts));
  } catch (error) {
    throw toCommunityError(error);
  }
  const cards = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
  return { cards, cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor, done: snap.docs.length < shape.limit };
}

// Authors whose nickname starts with `text`: -> [{ uid, nick, caseCount }] (at most 8).
export async function searchAuthors(text) {
  const prefix = normalizeSearch(text);
  if (!prefix) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "authors"),
        where("nickLower", ">=", prefix),
        where("nickLower", "<", `${prefix}`),
        orderBy("nickLower"),
        limit(8)
      )
    );
    return snap.docs.map((d) => ({ uid: d.id, nick: String(d.data().nick ?? ""), caseCount: Number(d.data().caseCount) || 0 }));
  } catch (error) {
    throw toCommunityError(error);
  }
}

// Is this signed-in account an administrator (a document in `admins`, which each account may read about itself)?
export async function isAdmin(uid) {
  try {
    return (await getDoc(doc(db, "admins", uid))).exists();
  } catch {
    return false;
  }
}
