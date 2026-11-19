// The refusals of the shared case database, in a form the page can turn into a sentence (messages.js). No Firebase here: the
// stores (communityStore.js, galleryStore.js) and the pages can all use it.
// A refusal, in words the page can turn into a sentence: `reason` is one of the codes of functions/src/handlers.js
// (sign-in-required, no-nickname, not-solved, invalid-meta, duplicate, limit-per-day, ...) or one of ours:
//   network          the server could not be reached
//   not-available    the case is not readable (withdrawn, hidden by moderation)
//   no-such-case     there is no such code
//   bad-body         the stored case is not a valid case
//   index-missing    the list's index is not ready yet (right after a new release Firestore builds them for a few minutes)
export class CommunityError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = "CommunityError";
    this.reason = reason;
    this.details = details;
  }
}

export function toCommunityError(error) {
  if (error instanceof CommunityError) return error;
  const reason = error?.details?.reason;
  if (typeof reason === "string") return new CommunityError(reason, error.details);
  const code = String(error?.code ?? "");
  if (code.endsWith("unavailable") || code.endsWith("deadline-exceeded") || code.includes("network")) return new CommunityError("network");
  if (code.endsWith("unauthenticated")) return new CommunityError("sign-in-required");
  if (code.endsWith("permission-denied")) return new CommunityError("not-available");
  if (code.endsWith("failed-precondition") && /index/i.test(String(error?.message ?? ""))) return new CommunityError("index-missing");
  return new CommunityError("internal", { message: error?.message });
}
