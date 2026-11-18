// "Duplica" for cases that come from the shared database: a copy of somebody else's case may be kept and edited only when
// the author allowed it (licence "cc-by", a remix); a case that is "play only" can be played, not copied. The copy of a
// remixable case remembers where it comes from (`community.remixOf`, kept out of what is published), and publishing it
// later says so on its card. No Firebase here.
import { duplicatePuzzle } from "../model/puzzle.js";
import { isSharedPuzzleId, SHARED_PREFIX } from "./casePolicy.js";
import { getShared } from "./localRegistry.js";

// -> { ok: true, copy } (an ordinary duplicate for a case of one's own) or { ok: false } (the author does not allow it).
export function duplicateCase(puzzle) {
  const copy = duplicatePuzzle(puzzle);
  if (!isSharedPuzzleId(puzzle.id)) return { ok: true, copy };
  const info = getShared(puzzle.id.slice(SHARED_PREFIX.length));
  // no memory of the licence (the browser data was cleared): the safe answer is the strict one
  if (info?.license !== "cc-by") return { ok: false };
  copy.community = { remixOf: { code: info.code, nick: info.authorNick || "" } };
  return { ok: true, copy };
}
