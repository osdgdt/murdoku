// The server side of the shared case database: publish a case, publish a new revision of it, withdraw or delete it.
// Everything that matters is decided HERE, with the same rules module the page uses (casePolicy.js, copied into
// functions/shared by tools/build-functions.mjs): the page's own checks are a courtesy to the author.
//
// The handlers know nothing about Firebase: they get a `store` and a `policy` (dependency injection), so that they are
// tested without any emulator (test/test-community-handlers.js, against a fake store) and run for real on the
// Firestore adapter of functions/index.js.
//
//   store.get(path)                    -> { exists, data }
//   store.runTransaction(async (tx))   tx.get(path) -> { exists, data }; tx.create(path, data) (fails if it exists);
//                                      tx.set(path, data); tx.update(path, patch); tx.delete(path)
//   store.deleteTree(path)             deletes a document and everything below it
//
// Paths written (see firestore.rules, "Shared cases"):
//   cases/{CODE}                       the public card of the case (title, summary, author, counters, status...)
//   cases/{CODE}/revisions/{n}         the case itself, as a JSON string (Firestore has no arrays inside arrays)
//   caseHashes/{hash}                  claims a content fingerprint: the same case cannot be published twice
//   authors/{uid}                      the author's public name and number of active cases
//   users/{uid}/published/{CODE}       the author's own list (also what the account deletion needs)
//   users/{uid}/publishLog/{day}       how many times today (the per-day limits)

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
const fail = (code, reason, details) => {
  throw new CaseError(code, reason, details);
};

export const DEFAULT_LIMITS = {
  publishPerDay: 5,
  updatePerDay: 20,
  activeCasesMax: 100,
  revisionsMax: 50,
};

const casePath = (code) => `cases/${code}`;
const revisionPath = (code, n) => `cases/${code}/revisions/${n}`;
const hashPath = (hash) => `caseHashes/${hash}`;
const authorPath = (uid) => `authors/${uid}`;
const publishedPath = (uid, code) => `users/${uid}/published/${code}`;
const logPath = (uid, day) => `users/${uid}/publishLog/${day}`;

export function createHandlers({ store, policy, now = () => new Date(), randomInt, limitsOverride = null }) {
  const {
    LIMITS,
    isCaseCode,
    generateCode,
    validatePublishMeta,
    validatePuzzleForPublish,
    preparePuzzleForPublish,
    contentHash,
    serializeBody,
    summarizePuzzle,
  } = policy;
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

  // The case as it will be stored, or a refusal that names what is wrong.
  function checkInput(data) {
    const meta = validatePublishMeta(data?.meta);
    if (!meta.ok) fail("invalid-argument", "invalid-meta", { errors: meta.errors });
    const puzzle = validatePuzzleForPublish(data?.puzzle);
    if (!puzzle.ok) fail("invalid-argument", "invalid-puzzle", { errors: puzzle.errors });
    return { meta: meta.meta, puzzle: puzzle.puzzle };
  }

  // Did the author play this very case to the end? The proof is the summary of their solves that the app syncs
  // to the cloud (self-reported: a filter against careless or throw-away cases, not a guarantee).
  async function requireSolvedByAuthor(uid, localPuzzleId) {
    if (typeof localPuzzleId !== "string" || !localPuzzleId) fail("failed-precondition", "not-solved");
    const summary = await store.get(`users/${uid}/achievements/summary`);
    const solves = summary.exists && summary.data && typeof summary.data.solves === "object" ? summary.data.solves : {};
    if (!solves[`puzzle:${localPuzzleId}`]) fail("failed-precondition", "not-solved");
  }

  // What the card of a case carries besides what the author wrote.
  const cardFields = (meta, summary) => ({
    title: meta.title,
    titleLower: meta.titleLower,
    blurb: meta.blurb,
    lang: meta.lang,
    difficulty: meta.difficulty,
    tags: meta.tags,
    rows: summary.rows,
    cols: summary.cols,
    characters: summary.characters,
    clues: summary.clues,
    sizeBand: summary.sizeBand,
  });

  // ---- publish ------------------------------------------------------------------------------------------------------
  async function publishCase(data, ctx) {
    const uid = requireUser(ctx);
    const { meta, puzzle } = checkInput(data);
    const nickname = await requireNickname(uid);
    await requireSolvedByAuthor(uid, data.puzzleId);
    const limits = await readLimits();
    const hash = await contentHash(puzzle);
    const when = now();
    const day = dayKey();

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateCode(randomInt);
      const body = serializeBody(
        preparePuzzleForPublish(puzzle, code, { author: nickname, title: meta.title, difficulty: meta.difficulty })
      );
      if (body.bytes > LIMITS.bodyMaxBytes) fail("invalid-argument", "too-big", { bytes: body.bytes, max: LIMITS.bodyMaxBytes });
      try {
        return await store.runTransaction(async (tx) => {
          const taken = await tx.get(casePath(code));
          if (taken.exists) throw new CaseError("aborted", "code-taken");
          const claim = await tx.get(hashPath(hash));
          if (claim.exists) fail("already-exists", "duplicate", { code: claim.data.code, yours: claim.data.authorUid === uid });
          const log = await tx.get(logPath(uid, day));
          const published = log.exists ? log.data.publishes || 0 : 0;
          if (published >= limits.publishPerDay) fail("resource-exhausted", "limit-per-day", { max: limits.publishPerDay });
          const author = await tx.get(authorPath(uid));
          const active = author.exists ? author.data.caseCount || 0 : 0;
          if (active >= limits.activeCasesMax) fail("resource-exhausted", "limit-active", { max: limits.activeCasesMax });

          let remixOf = null;
          if (data.remixOf !== undefined && data.remixOf !== null) {
            if (!isCaseCode(data.remixOf)) fail("invalid-argument", "remix-not-allowed");
            const source = await tx.get(casePath(data.remixOf));
            if (!source.exists || source.data.status !== "active" || source.data.license !== "cc-by")
              fail("failed-precondition", "remix-not-allowed");
            remixOf = { code: data.remixOf, nick: source.data.authorNick ?? null };
          }

          const card = {
            ...cardFields(meta, summarizePuzzle(puzzle)),
            license: meta.license,
            revision: 1,
            authorUid: uid,
            authorNick: nickname,
            contentHash: hash,
            status: "active",
            createdAt: when,
            updatedAt: when,
            stats: { opened: 0, solved: 0, likes: 0 },
            reportsOpen: 0,
          };
          if (remixOf) card.remixOf = remixOf;
          tx.create(casePath(code), card);
          tx.create(revisionPath(code, 1), { json: body.json, bytes: body.bytes, createdAt: when });
          tx.create(hashPath(hash), { code, authorUid: uid });
          tx.create(publishedPath(uid, code), { code, title: meta.title, puzzleId: String(data.puzzleId).slice(0, 80), createdAt: when });
          tx.set(authorPath(uid), {
            nick: nickname,
            nickLower: nickname.toLowerCase(),
            caseCount: active + 1,
            ...(author.exists ? {} : { createdAt: when }),
          });
          tx.set(logPath(uid, day), { ...(log.exists ? log.data : {}), publishes: published + 1 });
          return { code, revision: 1 };
        });
      } catch (error) {
        if (error instanceof CaseError && error.reason === "code-taken") continue; // an astronomically rare collision: another code
        throw error;
      }
    }
    return fail("internal", "no-free-code");
  }

  // ---- a new revision -------------------------------------------------------------------------------------------------
  async function updateCase(data, ctx) {
    const uid = requireUser(ctx);
    if (!isCaseCode(data?.code)) fail("invalid-argument", "bad-code");
    const code = data.code;
    const { meta, puzzle } = checkInput(data);
    const nickname = await requireNickname(uid);
    const limits = await readLimits();
    const hash = await contentHash(puzzle);
    const when = now();
    const day = dayKey();

    return store.runTransaction(async (tx) => {
      const card = await tx.get(casePath(code));
      if (!card.exists) fail("not-found", "no-such-case");
      if (card.data.authorUid !== uid) fail("permission-denied", "not-the-author");
      if (card.data.status === "hidden") fail("failed-precondition", "hidden-by-moderation");
      if (meta.license !== card.data.license) fail("failed-precondition", "license-immutable", { license: card.data.license });
      const revision = (card.data.revision || 1) + 1;
      if (revision > limits.revisionsMax) fail("resource-exhausted", "limit-revisions", { max: limits.revisionsMax });
      // every read comes before the first write (a rule of Firestore transactions)
      const log = await tx.get(logPath(uid, day));
      const author = await tx.get(authorPath(uid));
      const updates = log.exists ? log.data.updates || 0 : 0;
      if (updates >= limits.updatePerDay) fail("resource-exhausted", "limit-per-day", { max: limits.updatePerDay });
      // the same content as the revision now published is not a revision
      if (hash === card.data.contentHash) fail("already-exists", "unchanged", { code, yours: true });
      const claim = await tx.get(hashPath(hash));
      if (claim.exists) fail("already-exists", "duplicate", { code: claim.data.code, yours: claim.data.authorUid === uid });

      const body = serializeBody(
        preparePuzzleForPublish(puzzle, code, { author: nickname, title: meta.title, difficulty: meta.difficulty })
      );
      if (body.bytes > LIMITS.bodyMaxBytes) fail("invalid-argument", "too-big", { bytes: body.bytes, max: LIMITS.bodyMaxBytes });
      const wasWithdrawn = card.data.status === "withdrawn";
      tx.update(casePath(code), {
        ...cardFields(meta, summarizePuzzle(puzzle)),
        revision,
        contentHash: hash,
        status: "active",
        updatedAt: when,
        authorNick: nickname,
      });
      tx.create(revisionPath(code, revision), { json: body.json, bytes: body.bytes, createdAt: when });
      tx.delete(hashPath(card.data.contentHash));
      tx.create(hashPath(hash), { code, authorUid: uid });
      tx.update(publishedPath(uid, code), { title: meta.title, updatedAt: when });
      if (wasWithdrawn) tx.update(authorPath(uid), { caseCount: (author.exists ? author.data.caseCount || 0 : 0) + 1 });
      tx.set(logPath(uid, day), { ...(log.exists ? log.data : {}), updates: updates + 1 });
      return { code, revision };
    });
  }

  // ---- withdraw (reversible) and delete (for good) -----------------------------------------------------------------------
  async function withdrawCase(data, ctx) {
    const uid = requireUser(ctx);
    if (!isCaseCode(data?.code)) fail("invalid-argument", "bad-code");
    const code = data.code;
    const withdrawn = data.withdrawn !== false;
    const limits = await readLimits();
    return store.runTransaction(async (tx) => {
      const card = await tx.get(casePath(code));
      if (!card.exists) fail("not-found", "no-such-case");
      if (card.data.authorUid !== uid) fail("permission-denied", "not-the-author");
      if (card.data.status === "hidden") fail("failed-precondition", "hidden-by-moderation");
      const author = await tx.get(authorPath(uid));
      const active = author.exists ? author.data.caseCount || 0 : 0;
      if (withdrawn && card.data.status === "active") {
        tx.update(casePath(code), { status: "withdrawn", updatedAt: now() });
        tx.update(authorPath(uid), { caseCount: Math.max(0, active - 1) });
      } else if (!withdrawn && card.data.status === "withdrawn") {
        if (active >= limits.activeCasesMax) fail("resource-exhausted", "limit-active", { max: limits.activeCasesMax });
        tx.update(casePath(code), { status: "active", updatedAt: now() });
        tx.update(authorPath(uid), { caseCount: active + 1 });
      }
      return { code, status: withdrawn ? "withdrawn" : "active" };
    });
  }

  async function deleteCase(data, ctx) {
    const uid = requireUser(ctx);
    if (!isCaseCode(data?.code)) fail("invalid-argument", "bad-code");
    const code = data.code;
    const card = await store.get(casePath(code));
    if (!card.exists) fail("not-found", "no-such-case");
    if (card.data.authorUid !== uid) fail("permission-denied", "not-the-author");
    await store.runTransaction(async (tx) => {
      const author = await tx.get(authorPath(uid));
      if (card.data.status === "active" && author.exists)
        tx.update(authorPath(uid), { caseCount: Math.max(0, (author.data.caseCount || 0) - 1) });
      tx.delete(hashPath(card.data.contentHash));
      tx.delete(publishedPath(uid, code));
    });
    await store.deleteTree(casePath(code)); // the card and all its revisions
    return { code, deleted: true };
  }

  return { publishCase, updateCase, withdrawCase, deleteCase };
}
