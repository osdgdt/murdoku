// The page's door to the shared case database (the data model and the rules are in functions/src/handlers.js and
// firestore.rules, "Shared cases"). Loaded only when somebody publishes or opens a case by its code: the editor and
// the player do not touch Firebase otherwise (they work offline and with no sign-in).
//   reading  a case is open to everybody, signed in or not (Firestore, straight from the page)
//   writing  goes through the Cloud Functions only (publish, update, withdraw, delete): they check everything again
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { FUNCTIONS_REGION } from "./config.js";
import { CommunityError, toCommunityError } from "./errors.js";

export { CommunityError };
import { isCaseCode, sharedPuzzleId, LIMITS } from "./casePolicy.js";
import { migratePuzzle } from "../model/migrations.js";
import { validatePuzzleShape } from "../model/puzzle.js";

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);

async function call(name, data) {
  try {
    const result = await httpsCallable(functions, name)(data);
    return result.data;
  } catch (error) {
    throw toCommunityError(error);
  }
}

// ---- writing (the author) ---------------------------------------------------------------------------------------------
// -> { code, revision }
export const publishCase = ({ puzzle, puzzleId, meta, remixOf }) =>
  call("publishCase", { puzzle, puzzleId, meta, ...(remixOf ? { remixOf } : {}) });
// -> { code, revision }
export const updateCase = ({ code, puzzle, meta }) => call("updateCase", { code, puzzle, meta });
// -> { code, status }
export const withdrawCase = (code, withdrawn = true) => call("withdrawCase", { code, withdrawn });
// -> { code, deleted: true }
export const deleteCase = (code) => call("deleteCase", { code });

// ---- the social side (signed in; the functions count, the page only asks) ------------------------------------------------
// -> { code, liked, likes }
export const setLike = (code, liked = true) => call("setLike", { code, liked });
// event: "opened" | "solved" -> { counted, stats } (nothing is counted for the author's own plays or a case that is not public)
export const recordPlay = (code, event) => call("recordPlay", { code, event });
// -> { authorUid, following, followers }
export const followAuthor = (authorUid, follow = true) => call("followAuthor", { authorUid, follow });
// -> { bio }
export const setAuthorProfile = (bio) => call("setAuthorProfile", { bio });
// -> { code, reported, hidden }
export const reportCase = ({ code, reason, note }) => call("reportCase", { code, reason, note });
// the administrator's: action "hide" | "restore" | "delete" -> { code, status } or { code, deleted }
export const moderateCase = (code, action) => call("moderateCase", { code, action });
export const dismissReports = (code) => call("dismissReports", { code });
// keepCases: true keeps the person's cases signed "Account eliminato"; false deletes them. -> what was done
export const prepareAccountDeletion = (keepCases) => call("prepareAccountDeletion", { keepCases });

// ---- reading (everybody) ------------------------------------------------------------------------------------------------
// The card of a case: title, author, licence, revision... (small). Throws no-such-case / not-available. `any`: also
// a case that is not online (withdrawn): only its author can read it (the rules), and the author's own dialog wants to.
export async function fetchCard(code, { any = false } = {}) {
  if (!isCaseCode(code)) throw new CommunityError("no-such-case");
  let snap;
  try {
    snap = await getDoc(doc(db, "cases", code));
  } catch (error) {
    throw toCommunityError(error);
  }
  if (!snap.exists()) throw new CommunityError("no-such-case");
  const card = snap.data();
  // the rules already refuse a withdrawn or hidden case to anybody but its author; this is for the author reading their own
  if (card.status !== "active" && !any) throw new CommunityError("not-available", { status: card.status });
  return { code, ...card };
}

// The case itself, at the revision the card names: -> { card, puzzle } (the puzzle migrated, checked and with the id
// every reader gives it: `shared_<CODE>`). The text is untrusted: size-capped and run through the shape check.
export async function fetchCase(code, { any = false } = {}) {
  const card = await fetchCard(code, { any });
  let snap;
  try {
    snap = await getDoc(doc(db, "cases", code, "revisions", String(card.revision)));
  } catch (error) {
    throw toCommunityError(error);
  }
  if (!snap.exists()) throw new CommunityError("no-such-case");
  const json = snap.data()?.json;
  if (typeof json !== "string" || json.length > LIMITS.bodyMaxBytes) throw new CommunityError("bad-body");
  let puzzle;
  try {
    puzzle = JSON.parse(json);
    migratePuzzle(puzzle);
  } catch {
    throw new CommunityError("bad-body");
  }
  const { valid } = validatePuzzleShape(puzzle);
  if (!valid) throw new CommunityError("bad-body");
  puzzle.id = sharedPuzzleId(code);
  return { card, puzzle };
}
