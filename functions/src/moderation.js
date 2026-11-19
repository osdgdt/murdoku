// Reports of a case, what an administrator does with them, and deleting an account. As everywhere, the page asks and the server
// decides (functions/src/handlers.js explains the arrangement): the reports and who is an administrator are never trusted from
// the page.
import { fail, makeContext, casePath, revisionPath, hashPath, authorPath, publishedPath, logPath, reportPath, statsOf } from "./common.js";

export function createModerationHandlers(deps) {
  const { store, policy, now = () => new Date() } = deps;
  const { isCaseCode, validateReport, inGallery } = policy;
  const { dayKey, readLimits, requireUser, requireNickname, requireAdmin } = makeContext(deps);

  const codeOf = (data) => {
    if (!isCaseCode(data?.code)) fail("invalid-argument", "bad-code");
    return data.code;
  };

  // ---- a report --------------------------------------------------------------------------------------------------------
  // { code, reason, note } -> { code, reported, hidden }. One report per person per case; when `reportThreshold` different people
  // have reported a case it is hidden at once (nobody but its author and the administrators can open it) until an administrator
  // looks at it.
  async function reportCase(data, ctx) {
    const uid = requireUser(ctx);
    await requireNickname(uid);
    const code = codeOf(data);
    const checked = validateReport(data);
    if (!checked.ok) fail("invalid-argument", "invalid-report", { errors: checked.errors });
    const limits = await readLimits();
    const when = now();
    const day = dayKey();
    return store.runTransaction(async (tx) => {
      const card = await tx.get(casePath(code));
      if (!card.exists || card.data.status !== "active") fail("not-found", "no-such-case");
      if (card.data.authorUid === uid) fail("failed-precondition", "own-case");
      if ((await tx.get(reportPath(code, uid))).exists) fail("already-exists", "already-reported");
      const log = await tx.get(logPath(uid, day));
      const sent = log.exists ? log.data.reports || 0 : 0;
      if (sent >= limits.reportsPerDay) fail("resource-exhausted", "limit-per-day", { max: limits.reportsPerDay });
      const author = await tx.get(authorPath(card.data.authorUid));
      const open = (card.data.reportsOpen || 0) + 1;
      const hide = open >= limits.reportThreshold;
      tx.create(reportPath(code, uid), { caseCode: code, reporterUid: uid, ...checked.report, status: "open", createdAt: when });
      tx.update(casePath(code), {
        reportsOpen: open,
        ...(hide ? { status: "hidden", inGallery: false, hiddenBy: "reports", updatedAt: when } : {}),
      });
      if (hide && author.exists) tx.update(authorPath(card.data.authorUid), { caseCount: Math.max(0, (author.data.caseCount || 0) - 1) });
      tx.set(logPath(uid, day), { ...(log.exists ? log.data : {}), reports: sent + 1 });
      return { code, reported: true, hidden: hide };
    });
  }

  // A case gone for good: its card, revisions, likes, claimed fingerprint, its entry in the author's list, its reports.
  async function removeCase(code, card) {
    await store.runTransaction(async (tx) => {
      const author = await tx.get(authorPath(card.authorUid));
      if (card.status === "active" && author.exists)
        tx.update(authorPath(card.authorUid), { caseCount: Math.max(0, (author.data.caseCount || 0) - 1) });
      if (card.contentHash) tx.delete(hashPath(card.contentHash));
      tx.delete(publishedPath(card.authorUid, code));
    });
    await store.deleteTree(casePath(code));
    for (const report of await store.where("reports", "caseCode", code)) await store.runTransaction((tx) => tx.delete(report.path));
  }

  async function closeReports(code) {
    for (const report of await store.where("reports", "caseCode", code))
      if (report.data.status === "open") await store.runTransaction((tx) => tx.update(report.path, { status: "dismissed" }));
  }

  // ---- the administrator's actions -------------------------------------------------------------------------------------
  // { code, action: "hide" | "restore" | "delete" } -> { code, status } or { code, deleted }
  async function moderateCase(data, ctx) {
    await requireAdmin(ctx);
    const code = codeOf(data);
    const action = data?.action;
    if (!["hide", "restore", "delete"].includes(action)) fail("invalid-argument", "bad-action");
    const card = await store.get(casePath(code));
    if (!card.exists) fail("not-found", "no-such-case");
    if (action === "delete") {
      await removeCase(code, card.data);
      return { code, deleted: true };
    }
    const result = await store.runTransaction(async (tx) => {
      const current = await tx.get(casePath(code));
      if (!current.exists) fail("not-found", "no-such-case");
      const author = await tx.get(authorPath(current.data.authorUid));
      const count = author.exists ? author.data.caseCount || 0 : 0;
      if (action === "hide" && current.data.status !== "hidden") {
        tx.update(casePath(code), { status: "hidden", inGallery: false, hiddenBy: "admin", updatedAt: now() });
        if (current.data.status === "active" && author.exists)
          tx.update(authorPath(current.data.authorUid), { caseCount: Math.max(0, count - 1) });
        return { code, status: "hidden" };
      }
      if (action === "restore" && current.data.status === "hidden") {
        tx.update(casePath(code), {
          status: "active",
          inGallery: inGallery("active", current.data.listed),
          hiddenBy: null,
          reportsOpen: 0,
          updatedAt: now(),
        });
        if (author.exists) tx.update(authorPath(current.data.authorUid), { caseCount: count + 1 });
        return { code, status: "active" };
      }
      return { code, status: current.data.status };
    });
    if (action === "restore") await closeReports(code);
    return result;
  }

  // { code } -> { code, status }: the reports were not right; if they are what hid the case it comes back.
  async function dismissReports(data, ctx) {
    await requireAdmin(ctx);
    const code = codeOf(data);
    const result = await store.runTransaction(async (tx) => {
      const card = await tx.get(casePath(code));
      if (!card.exists) fail("not-found", "no-such-case");
      const author = await tx.get(authorPath(card.data.authorUid));
      const restore = card.data.status === "hidden" && card.data.hiddenBy === "reports";
      tx.update(casePath(code), {
        reportsOpen: 0,
        ...(restore ? { status: "active", inGallery: inGallery("active", card.data.listed), hiddenBy: null, updatedAt: now() } : {}),
      });
      if (restore && author.exists) tx.update(authorPath(card.data.authorUid), { caseCount: (author.data.caseCount || 0) + 1 });
      return { code, status: restore ? "active" : card.data.status };
    });
    await closeReports(code);
    return result;
  }

  // ---- deleting an account ---------------------------------------------------------------------------------------------
  // The cases stay, signed "Account eliminato", with nothing of the person in them (not in the card, not in the text of any
  // revision); or they are deleted with everything else.
  async function anonymizeCase(code, card) {
    for (let n = 1; n <= (card.revision || 1); n++) {
      const revision = await store.get(revisionPath(code, n));
      if (!revision.exists) continue;
      try {
        const body = JSON.parse(revision.data.json);
        body.author = "";
        const json = JSON.stringify(body);
        await store.runTransaction((tx) => tx.update(revisionPath(code, n), { json, bytes: new TextEncoder().encode(json).length }));
      } catch {
        // a body that is not JSON cannot have been written by the server: left alone
      }
    }
    await store.runTransaction(async (tx) => {
      tx.update(casePath(code), { authorNick: "Account eliminato", authorUid: "deleted", authorDeleted: true });
      if (card.contentHash) tx.update(hashPath(card.contentHash), { authorUid: "deleted" });
      tx.delete(publishedPath(card.authorUid, code));
    });
  }

  // { keepCases } -> what was done. Everything of this person that only the server can delete: the cases (kept anonymously or
  // deleted), the author's page, who they follow (and the followers counts), their likes (and the likes counts), their plays and
  // reports. The page runs this BEFORE it deletes the rest (src/auth/cloudData.js), and stops if it fails.
  async function prepareAccountDeletion(data, ctx) {
    const uid = requireUser(ctx);
    const keep = data?.keepCases === true;
    const done = { casesKept: 0, casesDeleted: 0, follows: 0, likes: 0 };
    for (const entry of await store.list(`users/${uid}/published`)) {
      const code = entry.data.code;
      const card = isCaseCode(code) ? await store.get(casePath(code)) : { exists: false };
      if (!card.exists || card.data.authorUid !== uid) continue;
      if (keep) {
        await anonymizeCase(code, card.data);
        done.casesKept++;
      } else {
        await removeCase(code, card.data);
        done.casesDeleted++;
      }
    }
    for (const link of await store.list(`users/${uid}/following`)) {
      await store.runTransaction(async (tx) => {
        const author = await tx.get(authorPath(link.data.authorUid));
        if (author.exists) tx.update(authorPath(link.data.authorUid), { followers: Math.max(0, (author.data.followers || 0) - 1) });
        tx.delete(link.path);
      });
      done.follows++;
    }
    for (const like of await store.groupWhere("likes", "uid", uid)) {
      const code = like.path.split("/")[1];
      await store.runTransaction(async (tx) => {
        const card = await tx.get(casePath(code));
        if (card.exists) tx.update(casePath(code), { stats: { ...statsOf(card.data), likes: Math.max(0, statsOf(card.data).likes - 1) } });
        tx.delete(like.path);
      });
      done.likes++;
    }
    for (const play of await store.groupWhere("plays", "uid", uid)) await store.runTransaction((tx) => tx.delete(play.path));
    for (const report of await store.where("reports", "reporterUid", uid)) await store.runTransaction((tx) => tx.delete(report.path));
    const leftovers = [
      ...(await store.list(`users/${uid}/published`)),
      ...(await store.list(`users/${uid}/publishLog`)),
      ...(await store.list(`users/${uid}/social`)),
    ];
    await store.runTransaction((tx) => {
      tx.delete(authorPath(uid));
      for (const doc of leftovers) tx.delete(doc.path);
    });
    return done;
  }

  return { reportCase, moderateCase, dismissReports, prepareAccountDeletion };
}
