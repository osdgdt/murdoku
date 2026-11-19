// What the three groups of handlers share (handlers.js: publish/update/withdraw/delete a case; social.js: likes, who played,
// following, the author's page; moderation.js: reports, the administrator's actions, the deletion of an account): the error
// type, the limits, the paths of the documents and the checks of who is asking. Nothing here knows about Firebase.

export class CaseError extends Error {
  // `code` is a Firebase callable error code ("invalid-argument", "failed-precondition", ...), `reason` says what
  // exactly, for the page to word it.
  constructor(code, reason, details = {}) {
    super(`${code}: ${reason}`);
    this.name = "CaseError";
    this.code = code;
    this.reason = reason;
    this.details = { reason, ...details };
  }
}
export const fail = (code, reason, details) => {
  throw new CaseError(code, reason, details);
};

// Adjustable without a new release: the document config/limits (see docs/community-setup.md).
export const DEFAULT_LIMITS = {
  publishPerDay: 5,
  updatePerDay: 20,
  activeCasesMax: 100,
  revisionsMax: 50,
  reportsPerDay: 20, // reports one account can send in a day
  reportThreshold: 3, // distinct people reporting a case that hide it until an administrator looks
  followMax: 30, // authors one account can follow
};

// The same account as isOwner() in firestore.rules: an administrator even if `admins` is empty or mistyped.
export const OWNER_UIDS = ["say3jOf6WkaXDmjyn3kmAKNYbCh1"];

//   cases/{CODE}                       the public card of the case (title, summary, author, counters, status...)
//   cases/{CODE}/revisions/{n}         the case itself, as a JSON string (Firestore has no arrays inside arrays)
//   cases/{CODE}/likes/{uid}           this person likes the case                          { uid, at }
//   cases/{CODE}/plays/{uid}           this person opened / solved it (counted once)     { uid, opened, solved }
//   caseHashes/{hash}                  claims a content fingerprint: the same case cannot be published twice
//   authors/{uid}                      the author's public name, bio, number of active cases and followers
//   reports/{CODE_uid}                 one report of a case by one person                  (admins only)
//   users/{uid}/published/{CODE}       the author's own list (also what the account deletion needs)
//   users/{uid}/publishLog/{day}       how many times today (the per-day limits)
//   users/{uid}/following/{authorUid}  who this person follows
//   users/{uid}/social/summary         how many authors this person follows
export const casePath = (code) => `cases/${code}`;
export const revisionPath = (code, n) => `cases/${code}/revisions/${n}`;
export const markerPath = (code, kind, uid) => `cases/${code}/${kind}/${uid}`;
export const hashPath = (hash) => `caseHashes/${hash}`;
export const authorPath = (uid) => `authors/${uid}`;
export const publishedPath = (uid, code) => `users/${uid}/published/${code}`;
export const logPath = (uid, day) => `users/${uid}/publishLog/${day}`;
export const followingPath = (uid, authorUid) => `users/${uid}/following/${authorUid}`;
export const socialPath = (uid) => `users/${uid}/social/summary`;
export const reportPath = (code, uid) => `reports/${code}_${uid}`;

export const emptyStats = () => ({ opened: 0, solved: 0, likes: 0 });
export const statsOf = (card) => ({ ...emptyStats(), ...(card?.stats ?? {}) });

// The checks of who is asking, shared by every handler.
export function makeContext({ store, now = () => new Date(), limitsOverride = null }) {
  const dayKey = () => now().toISOString().slice(0, 10);

  async function readLimits() {
    if (limitsOverride) return { ...DEFAULT_LIMITS, ...limitsOverride };
    const config = await store.get("config/limits");
    return { ...DEFAULT_LIMITS, ...(config.exists ? config.data : {}) };
  }

  const requireUser = (ctx) => {
    if (!ctx?.uid) fail("unauthenticated", "sign-in-required");
    return ctx.uid;
  };

  async function requireNickname(uid) {
    const profile = await store.get(`profiles/${uid}`);
    if (!profile.exists || typeof profile.data.nickname !== "string" || !profile.data.nickname) fail("failed-precondition", "no-nickname");
    return profile.data.nickname;
  }

  async function isAdmin(uid) {
    if (OWNER_UIDS.includes(uid)) return true;
    return (await store.get(`admins/${uid}`)).exists;
  }

  async function requireAdmin(ctx) {
    const uid = requireUser(ctx);
    if (!(await isAdmin(uid))) fail("permission-denied", "not-an-admin");
    return uid;
  }

  return { dayKey, readLimits, requireUser, requireNickname, isAdmin, requireAdmin };
}
