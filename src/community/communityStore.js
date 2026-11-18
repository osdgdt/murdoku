// The page's door to the shared case database (the data model and the rules are in functions/src/handlers.js and
// firestore.rules, "Shared cases"). Loaded only when somebody publishes or opens a case by its code: the editor and
// the player do not touch Firebase otherwise (they work offline and with no sign-in).
//   reading  a case is open to everybody, signed in or not (Firestore, straight from the page)
//   writing  goes through the Cloud Functions only (publish, update, withdraw, delete): they check everything again
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseApp } from "../firebaseConfig.js";
import { FUNCTIONS_REGION } from "./config.js";
import { isCaseCode, sharedPuzzleId, LIMITS } from "./casePolicy.js";
import { migratePuzzle } from "../model/migrations.js";
import { validatePuzzleShape } from "../model/puzzle.js";

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);

// A refusal, in words the page can turn into a sentence: `reason` is one of the codes of functions/src/handlers.js
// (sign-in-required, no-nickname, not-solved, invalid-meta, duplicate, limit-per-day, ...) or one of ours:
//   network          the server could not be reached
//   not-available    the case is not readable (withdrawn, hidden by moderation)
//   no-such-case     there is no such code
//   bad-body         the stored case is not a valid case
export class CommunityError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = "CommunityError";
    this.reason = reason;
    this.details = details;
  }
}

function toCommunityError(error) {
  if (error instanceof CommunityError) return error;
  const reason = error?.details?.reason;
  if (typeof reason === "string") return new CommunityError(reason, error.details);
  const code = String(error?.code ?? "");
  if (code.endsWith("unavailable") || code.endsWith("deadline-exceeded") || code.includes("network")) return new CommunityError("network");
  if (code.endsWith("unauthenticated")) return new CommunityError("sign-in-required");
  if (code.endsWith("permission-denied")) return new CommunityError("not-available");
  return new CommunityError("internal", { message: error?.message });
}

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
export async function fetchCase(code) {
  const card = await fetchCard(code);
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
