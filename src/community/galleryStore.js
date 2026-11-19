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
import { OWNER_UIDS } from "./casePolicy.js";
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

// Is this signed-in account an administrator: the original owner, or a document in `admins` (each account may read about itself)?
export async function isAdmin(uid) {
  if (OWNER_UIDS.includes(uid)) return true;
  try {
    return (await getDoc(doc(db, "admins", uid))).exists();
  } catch {
    return false;
  }
}

// ---- the signed-in person's own marks and follows -----------------------------------------------------------------------
// Which of these cases does this person like? -> Set of codes (one small read each; the page asks for the cards it shows).
export async function fetchLiked(uid, codes) {
  const found = await Promise.all(
    codes.map(async (code) => {
      try {
        return (await getDoc(doc(db, "cases", code, "likes", uid))).exists() ? code : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(found.filter(Boolean));
}

// The public page of an author: { uid, nick, bio, caseCount, followers } or null.
export async function fetchAuthor(authorUid) {
  try {
    const snap = await getDoc(doc(db, "authors", authorUid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: authorUid,
      nick: String(d.nick ?? ""),
      bio: String(d.bio ?? ""),
      caseCount: Number(d.caseCount) || 0,
      followers: Number(d.followers) || 0,
    };
  } catch (error) {
    throw toCommunityError(error);
  }
}

// The authors this person follows: -> [{ uid, nick }] (at most 30).
export async function fetchFollowing(uid) {
  try {
    const snap = await getDocs(query(collection(db, "users", uid, "following"), limit(30)));
    return snap.docs.map((d) => ({ uid: d.id, nick: String(d.data().nick ?? "") }));
  } catch {
    return [];
  }
}

// Is this author one of the ones the person follows?
export async function isFollowing(uid, authorUid) {
  try {
    return (await getDoc(doc(db, "users", uid, "following", authorUid))).exists();
  } catch {
    return false;
  }
}

// ---- the administrator's ---------------------------------------------------------------------------------------------------
// Cases with open reports, most reported first; and the ones hidden: -> [{ code, ...card }]
export async function fetchReportedCases() {
  try {
    const reported = await getDocs(query(collection(db, "cases"), where("reportsOpen", ">", 0), orderBy("reportsOpen", "desc"), limit(30)));
    const hidden = await getDocs(query(collection(db, "cases"), where("status", "==", "hidden"), limit(30)));
    const seen = new Map();
    for (const d of [...reported.docs, ...hidden.docs]) seen.set(d.id, { code: d.id, ...d.data() });
    return [...seen.values()];
  } catch (error) {
    throw toCommunityError(error);
  }
}

// The reports of one case: -> [{ id, reporterUid, reason, note, status }]
export async function fetchReports(code) {
  try {
    const snap = await getDocs(query(collection(db, "reports"), where("caseCode", "==", code), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    throw toCommunityError(error);
  }
}
