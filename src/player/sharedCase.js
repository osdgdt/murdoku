// Opening a case of the shared database by its code (`player.html?c=ABCD2345`, a QR, or the code typed in the picker).
// The case is saved in this browser as `shared_<CODE>` the first time (so that it works offline afterwards and the
// progress of the player is never overwritten by opening the link again), together with what the browser must remember
// about it: author, licence, revision (src/community/localRegistry.js). Firebase is loaded only when something has to be
// fetched; a case already saved opens at once, even with no connection.
import * as store from "../storage/puzzleStore.js";
import { isCaseCode, normalizeCode, sharedPuzzleId } from "../community/casePolicy.js";
import * as registry from "../community/localRegistry.js";
import { describeReason } from "../community/messages.js";

const loadCommunity = () => import("../community/communityStore.js");
const reasonOf = (err) => err?.reason ?? "network"; // a module that cannot even be loaded is a connection problem

function saveCopy(code, card, puzzle) {
  puzzle.completed = false;
  puzzle.bestTimeSeconds = null;
  puzzle.createdAt ??= Date.now();
  puzzle.updatedAt = Date.now();
  store.save(puzzle);
  registry.setShared(code, {
    code,
    revision: card.revision,
    authorNick: card.authorNick ?? "",
    license: card.license,
    title: card.title,
    savedAt: Date.now(),
    remixOf: card.remixOf ?? null,
    status: card.status ?? "active", // not "active" when it is the author or an administrator looking at a case that is not public
  });
}

// -> { puzzleId, code } or { error: "<a sentence>" }
export async function openSharedCode(raw) {
  const code = normalizeCode(raw);
  if (!isCaseCode(code)) return { error: describeReason("bad-code") };
  const puzzleId = sharedPuzzleId(code);
  if (store.get(puzzleId)) return { puzzleId, code };
  try {
    const { fetchCase } = await loadCommunity();
    let found;
    try {
      found = await fetchCase(code);
    } catch (err) {
      // A case that is withdrawn or hidden is readable by its author and by the administrators (the rules decide): they are
      // tried only by a browser that has seen a signed-in account, with the sign-in module loaded so that the request carries it.
      if (reasonOf(err) !== "not-available" || !registry.wasSignedIn()) throw err;
      await import("../auth/googleAuth.js");
      found = await fetchCase(code, { any: true });
    }
    saveCopy(code, found.card, found.puzzle);
    return { puzzleId, code };
  } catch (err) {
    return { error: describeReason(reasonOf(err), err?.details) };
  }
}

// Is there a newer revision of the copy this browser holds? -> the new card, or null (also when it cannot be known).
export async function newerRevision(code) {
  const info = registry.getShared(code);
  if (!info) return null;
  try {
    const { fetchCard } = await loadCommunity();
    const card = await fetchCard(code);
    return card.revision > info.revision ? card : null;
  } catch {
    return null;
  }
}

// Replaces the copy by the newer revision. The progress on the old one is dropped (the case may be different now).
export async function applyNewerRevision(code) {
  const { fetchCase } = await loadCommunity();
  const { card, puzzle } = await fetchCase(code); // fetched first: if it fails, nothing is lost
  store.remove(sharedPuzzleId(code));
  saveCopy(code, card, puzzle);
  return card;
}

// The card of a case, for the panel above the board: the counters, the author. null when it cannot be read.
export async function loadCard(code) {
  try {
    if (registry.wasSignedIn()) await import("../auth/googleAuth.js"); // so that the request carries the account (a case that is not public)
    const { fetchCard } = await loadCommunity();
    return await fetchCard(code, { any: registry.wasSignedIn() });
  } catch {
    return null;
  }
}
