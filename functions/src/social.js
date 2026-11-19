// Likes, who played, following an author, the author's own page. Everything is a call to a function (and not a document the page
// writes) because only a server can keep the counters honest: one like, one "played", one "solved" per person per case,
// whatever the page sends. Counters count signed-in people only, and never the author's own plays and likes.
import { fail, makeContext, casePath, markerPath, authorPath, followingPath, socialPath, statsOf } from "./common.js";

export function createSocialHandlers(deps) {
  const { store, policy, now = () => new Date() } = deps;
  const { isCaseCode, validateBio } = policy;
  const { requireUser, requireNickname, readLimits } = makeContext(deps);

  const codeOf = (data) => {
    if (!isCaseCode(data?.code)) fail("invalid-argument", "bad-code");
    return data.code;
  };

  // ---- likes -----------------------------------------------------------------------------------------------------------
  // { code, liked } -> { code, liked, likes }: `liked` is how it should be afterwards, so repeating a call changes nothing.
  async function setLike(data, ctx) {
    const uid = requireUser(ctx);
    const code = codeOf(data);
    const liked = data?.liked !== false;
    await requireNickname(uid);
    return store.runTransaction(async (tx) => {
      const card = await tx.get(casePath(code));
      if (!card.exists || card.data.status !== "active") fail("not-found", "no-such-case");
      if (card.data.authorUid === uid) fail("failed-precondition", "own-case");
      const marker = await tx.get(markerPath(code, "likes", uid));
      const stats = statsOf(card.data);
      if (liked && !marker.exists) {
        stats.likes += 1;
        tx.create(markerPath(code, "likes", uid), { uid, at: now() });
        tx.update(casePath(code), { stats });
      } else if (!liked && marker.exists) {
        stats.likes = Math.max(0, stats.likes - 1);
        tx.delete(markerPath(code, "likes", uid));
        tx.update(casePath(code), { stats });
      }
      return { code, liked, likes: stats.likes };
    });
  }

  // ---- played and solved -----------------------------------------------------------------------------------------------
  // { code, event: "opened" | "solved" } -> { counted, stats }. A person counts once as having opened a case and once as having
  // solved it (a solve counts as an open too); the author's own plays and a case that is not public are not counted.
  async function recordPlay(data, ctx) {
    const uid = requireUser(ctx);
    const code = codeOf(data);
    if (data?.event !== "opened" && data?.event !== "solved") fail("invalid-argument", "bad-event");
    return store.runTransaction(async (tx) => {
      const card = await tx.get(casePath(code));
      if (!card.exists || card.data.status !== "active" || card.data.authorUid === uid) return { counted: false };
      const marker = await tx.get(markerPath(code, "plays", uid));
      const mark = marker.exists ? { ...marker.data } : { uid, opened: false, solved: false };
      const stats = statsOf(card.data);
      let changed = false;
      if (!mark.opened) {
        mark.opened = true;
        stats.opened += 1;
        changed = true;
      }
      if (data.event === "solved" && !mark.solved) {
        mark.solved = true;
        stats.solved += 1;
        changed = true;
      }
      if (changed) {
        tx.set(markerPath(code, "plays", uid), { ...mark, uid, at: now() });
        tx.update(casePath(code), { stats });
      }
      return { counted: changed, stats };
    });
  }

  // ---- following -------------------------------------------------------------------------------------------------------
  // { authorUid, follow } -> { authorUid, following, followers }. At most `followMax` authors.
  async function followAuthor(data, ctx) {
    const uid = requireUser(ctx);
    await requireNickname(uid);
    const authorUid = typeof data?.authorUid === "string" ? data.authorUid : "";
    if (!authorUid || authorUid.length > 128 || authorUid.includes("/")) fail("invalid-argument", "bad-author");
    if (authorUid === uid) fail("failed-precondition", "own-case");
    const follow = data?.follow !== false;
    const limits = await readLimits();
    return store.runTransaction(async (tx) => {
      const author = await tx.get(authorPath(authorUid));
      if (!author.exists) fail("not-found", "no-such-author");
      const link = await tx.get(followingPath(uid, authorUid));
      const summary = await tx.get(socialPath(uid));
      const following = summary.exists ? summary.data.following || 0 : 0;
      let followers = author.data.followers || 0;
      if (follow && !link.exists) {
        if (following >= limits.followMax) fail("resource-exhausted", "follow-limit", { max: limits.followMax });
        followers += 1;
        tx.create(followingPath(uid, authorUid), { authorUid, nick: author.data.nick ?? "", at: now() });
        tx.set(socialPath(uid), { following: following + 1 });
        tx.update(authorPath(authorUid), { followers });
      } else if (!follow && link.exists) {
        followers = Math.max(0, followers - 1);
        tx.delete(followingPath(uid, authorUid));
        tx.set(socialPath(uid), { following: Math.max(0, following - 1) });
        tx.update(authorPath(authorUid), { followers });
      }
      return { authorUid, following: follow, followers };
    });
  }

  // ---- the author's own page -------------------------------------------------------------------------------------------
  // { bio } -> { bio }: the few lines about oneself that the page of an author shows (only authors have a page).
  async function setAuthorProfile(data, ctx) {
    const uid = requireUser(ctx);
    await requireNickname(uid);
    const checked = validateBio(data?.bio);
    if (!checked.ok) fail("invalid-argument", "invalid-bio");
    return store.runTransaction(async (tx) => {
      const author = await tx.get(authorPath(uid));
      if (!author.exists) fail("failed-precondition", "no-cases");
      tx.update(authorPath(uid), { bio: checked.bio });
      return { bio: checked.bio };
    });
  }

  return { setLike, recordPlay, followAuthor, setAuthorProfile };
}
