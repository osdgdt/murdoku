// `npm run e2e:social`: what people do with the cases of other people, with a stand-in for Firebase whose "Cloud Functions" are the
// real handlers (test/e2e/lib/fakeFirebase.mjs): likes and the counters, the page of an author and following, the feed of the
// authors followed, reports (three people hide a case), the administrators' page, and deleting an account with a choice about
// the cases. The rules are not exercised here (test/rules) and neither are the real functions (functions/test).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installFakeFirebase } from "./lib/fakeFirebase.mjs";
import { sampleCases } from "./lib/sampleCases.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

// the shared "database": the sample cards, their authors, one case that can be played, some readers and an administrator
const faro = JSON.parse(await readFile(path.join(root, "test/fixtures/faro.en.murdoku.json"), "utf8"));
const seed = () => {
  const docs = sampleCases();
  docs["authors/uid-author"] = { nick: "Maigret", nickLower: "maigret", caseCount: 1, followers: 0, bio: "Casi di mare e di nebbia." };
  docs["authors/uid-other"] = { nick: "Poirot", nickLower: "poirot", caseCount: 1, followers: 0 };
  docs["users/uid-author/published/ACDEFGHJ"] = { code: "ACDEFGHJ", title: "Il faro nella tempesta" };
  docs["caseHashes/hash"] = { code: "ACDEFGHJ", authorUid: "uid-author" };
  docs["cases/ACDEFGHJ/revisions/1"] = { json: JSON.stringify({ ...faro, id: "shared_ACDEFGHJ", author: "Maigret" }), bytes: 10 };
  docs["cases/KMNPQRTU"].stats = { opened: 7, solved: 3, likes: 5 };
  for (const [uid, nick] of [
    ["uid-r", "Lettore"],
    ["uid-r2", "Due"],
    ["uid-r3", "Tre"],
    ["adm", "Capo"],
    ["uid-author", "Maigret"],
  ])
    docs[`profiles/${uid}`] = { nickname: nick, key: nick.toLowerCase() };
  docs["admins/adm"] = { since: 1 };
  return docs;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const contexts = [];
async function person(uid, db) {
  const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${uid}: ${e}`));
  page.on("dialog", (d) => d.accept());
  await installFakeFirebase(page);
  await context.addInitScript(
    ([id, value]) => {
      if (localStorage.getItem("__fake_db") === null) localStorage.setItem("__fake_db", value);
      localStorage.setItem("__fake_uid", id);
      if (id) localStorage.setItem("__fake_user", JSON.stringify({ uid: id, email: `${id}@esempio.test` }));
    },
    [uid, JSON.stringify(db)]
  );
  return page;
}
const database = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("__fake_db")));
const card = (db, code) => db[`cases/${code}`];

try {
  let db = seed();

  // ===== a reader likes, and sees the counters =====
  const r = await person("uid-r", db);
  await r.goto(`${base}/community.html`);
  await r.waitForSelector(".case-card");
  const first = r.locator(".case-card[data-code=ACDEFGHJ]");
  check(
    "social: every card shows the counters and a heart",
    /0 hanno provato/.test(await first.innerText()) && (await first.locator("[data-key=like]").innerText()) === "♡ 0"
  );
  await first.locator("[data-key=like]").click();
  await r.waitForFunction(() => document.querySelector(".case-card[data-code=ACDEFGHJ] [data-key=like]")?.textContent === "♥ 1");
  check(
    "social: a like is counted and the heart is filled",
    (await first.locator("[data-key=like]").getAttribute("aria-pressed")) === "true"
  );
  await r.reload();
  await r.waitForSelector(".case-card");
  check(
    "social: after a reload the heart is still theirs",
    (await r.locator(".case-card[data-code=ACDEFGHJ] [data-key=like]").innerText()) === "♥ 1"
  );
  await r.locator(".case-card[data-code=ACDEFGHJ] [data-key=like]").click();
  await r.waitForFunction(() => document.querySelector(".case-card[data-code=ACDEFGHJ] [data-key=like]")?.textContent === "♡ 0");
  check("social: and it can be taken back", true);
  // ordered by the most liked
  await r.selectOption("[data-key=filter-sort]", "liked");
  await r.waitForFunction(() => document.querySelector(".case-card")?.getAttribute("data-code") === "KMNPQRTU");
  check("social: 'Più apprezzati' puts the most liked case first", true);
  await r.selectOption("[data-key=filter-sort]", "played");
  await r.waitForFunction(() => document.querySelector(".case-card")?.getAttribute("data-code") === "KMNPQRTU");
  check("social: 'Più giocati' too", /7 hanno provato · ✓ 3 risolti/.test(await r.locator(".case-card").first().innerText()));
  await r.selectOption("[data-key=filter-sort]", "new");

  // ===== the page of an author, following, the feed =====
  await r.locator(".case-card[data-code=ACDEFGHJ] [data-key=author-link]").click();
  await r.waitForSelector("[data-key=profile]:not([hidden])");
  const profile = await r.innerText("[data-key=profile]");
  check(
    "author: the page shows the name, the introduction, the cases and the followers",
    /Maigret/.test(profile) && /Casi di mare e di nebbia/.test(profile) && /1 caso · 0 follower/.test(profile),
    profile
  );
  check("author: and lists his cases", (await r.locator(".case-card").count()) === 1);
  await r.click("[data-key=follow]");
  await r.waitForFunction(() => document.querySelector("[data-key=follow]")?.getAttribute("aria-pressed") === "true");
  check("author: following is counted", /1 follower/.test(await r.innerText("[data-key=profile-counts]")));
  await r.goto(`${base}/community.html`);
  await r.waitForSelector("[data-key=feed-dot]:not([hidden])");
  check("feed: a new case of a followed author puts a dot on the tab", true);
  await r.click("[data-key=tab-feed]");
  await r.waitForSelector(".case-card");
  check(
    "feed: 'Novità' shows the cases of the authors followed, and only theirs",
    (await r.locator(".case-card").count()) === 1 && (await r.locator("[data-key=feed-dot]").isHidden())
  );
  await r.goto(`${base}/community.html?author=uid-author`);
  await r.waitForSelector("[data-key=profile]:not([hidden])");
  await r.waitForFunction(() => document.querySelector("[data-key=follow]")?.getAttribute("aria-pressed") === "true");
  await r.click("[data-key=follow]");
  await r.waitForFunction(() => document.querySelector("[data-key=follow]")?.getAttribute("aria-pressed") === "false");
  check(
    "author: a link to the page opens it, and following can be undone",
    /0 follower/.test(await r.innerText("[data-key=profile-counts]"))
  );
  // the author edits their introduction
  const a = await person("uid-author", await database(r));
  await a.goto(`${base}/community.html?author=uid-author`);
  await a.waitForSelector("[data-key=bio-edit]");
  await a.click("[data-key=bio-edit]");
  await a.fill("[data-key=bio-input]", "Nuova presentazione.");
  await a.click("[data-key=bio-save]");
  await a.waitForSelector("[data-key=profile-bio] >> text=Nuova presentazione.");
  check(
    "author: the author edits their own introduction (and cannot follow themselves)",
    (await a.locator("[data-key=follow]").count()) === 0
  );

  // ===== the player counts and shows the heart =====
  db = await database(r);
  await r.goto(`${base}/player.html?c=ACDEFGHJ`);
  await r.waitForSelector("#board [role=gridcell]");
  await r.waitForSelector("[data-key=shared-like]");
  check(
    "player: the panel shows who played, the heart, 'Segnala' and the author's page",
    /Altri casi di Maigret/.test(await r.innerText("[data-key=shared-social]")) &&
      !/null|undefined/.test(await r.innerText("[data-key=shared-social]")) &&
      (await r.locator("[data-key=shared-report]").count()) === 1
  );
  await r.click("[data-key=shared-like]");
  await r.waitForFunction(() => document.querySelector("[data-key=shared-like]")?.textContent === "♥ 1");
  db = await database(r);
  check(
    "player: opening counted the person once, the like is counted",
    card(db, "ACDEFGHJ").stats.opened === 1 && card(db, "ACDEFGHJ").stats.likes === 1,
    JSON.stringify(card(db, "ACDEFGHJ").stats)
  );
  await r.reload();
  await r.waitForSelector("[data-key=shared-like]");
  await r.waitForFunction(() => document.querySelector("[data-key=shared-like]")?.textContent === "♥ 1");
  db = await database(r);
  check("player: opening it again does not count again", card(db, "ACDEFGHJ").stats.opened === 1);

  // ===== reports: three different people hide a case =====
  await r.goto(`${base}/community.html`);
  await r.waitForSelector(".case-card[data-code=ACDEFGHJ]");
  await r.locator(".case-card[data-code=ACDEFGHJ] [data-key=report]").click();
  await r.click("[data-key=report-go]");
  check("report: a reason is needed", /Scegli un motivo/.test(await r.innerText("dialog")));
  await r.selectOption("[data-key=report-reason]", "spam");
  await r.click("[data-key=report-go]");
  await r.waitForSelector("[data-key=report-done]");
  check("report: the report goes through and says so", true);
  await r.locator(".case-card[data-code=ACDEFGHJ] [data-key=report]").click();
  await r.selectOption("[data-key=report-reason]", "spam");
  await r.click("[data-key=report-go]");
  await r.waitForSelector("dialog [data-key=report-go]:not([disabled])");
  check("report: the same person cannot report the same case twice", /già segnalato/.test(await r.innerText("dialog")));
  await r.click("dialog >> text=Annulla");
  db = await database(r);
  for (const uid of ["uid-r2", "uid-r3"]) {
    const p = await person(uid, db);
    await p.goto(`${base}/community.html`);
    await p.waitForSelector(".case-card[data-code=ACDEFGHJ]");
    await p.locator(".case-card[data-code=ACDEFGHJ] [data-key=report]").click();
    await p.selectOption("[data-key=report-reason]", "offensive");
    await p.click("[data-key=report-go]");
    await p.waitForSelector("[data-key=report-done]");
    db = await database(p);
  }
  check(
    "report: three different people hide the case",
    card(db, "ACDEFGHJ").status === "hidden" && card(db, "ACDEFGHJ").inGallery === false,
    JSON.stringify(card(db, "ACDEFGHJ"))
  );
  const visitor = await person("", db);
  await visitor.goto(`${base}/community.html`);
  await visitor.waitForSelector(".case-card");
  check("report: a hidden case is gone from the list", (await visitor.locator(".case-card[data-code=ACDEFGHJ]").count()) === 0);
  await visitor.goto(`${base}/player.html?c=ACDEFGHJ`);
  await visitor.waitForSelector(".result-banner.hint-error");
  check("report: and does not open for a stranger", /Non trovo questo caso/.test(await visitor.innerText(".result-banner")));

  // ===== the administrators' page =====
  const nonAdmin = await person("uid-r", db);
  await nonAdmin.goto(`${base}/moderation.html`);
  await nonAdmin.waitForSelector("[data-key=mod-notice] p");
  check(
    "moderation: an ordinary account is told the page is not for them, with no controls",
    /riservata agli amministratori/.test(await nonAdmin.innerText("[data-key=mod-notice]")) &&
      (await nonAdmin.locator("[data-key=mod-hide], [data-key=mod-restore]").count()) === 0
  );
  const adm = await person("adm", db);
  await adm.goto(`${base}/community.html`);
  await adm.waitForSelector("[data-key=mod-link]:not([hidden])");
  check("moderation: an administrator sees the link to the page", true);
  await adm.goto(`${base}/moderation.html`);
  await adm.waitForSelector("[data-key=mod-list] .case-card");
  const item = await adm.innerText("[data-key=mod-list] .case-card");
  check("moderation: the hidden case is listed with its open reports", /Nascosto/.test(item) && /3 segnalazioni aperte/.test(item), item);
  await adm.click("[data-key=mod-show-reports]");
  await adm.waitForSelector(".mod-report");
  check(
    "moderation: the reports show reason and who sent how many",
    (await adm.locator(".mod-report").count()) === 3 && /Pubblicità o spam/.test(await adm.innerText("[data-key=mod-reports]"))
  );
  await adm.click("[data-key=mod-restore]");
  await adm.waitForSelector("[data-key=mod-status] >> text=Nessun caso segnalato o nascosto.");
  db = await database(adm);
  check(
    "moderation: restoring puts the case back and closes the reports",
    card(db, "ACDEFGHJ").status === "active" && card(db, "ACDEFGHJ").inGallery === true && card(db, "ACDEFGHJ").reportsOpen === 0
  );
  check(
    "moderation: the reports are closed",
    Object.entries(db)
      .filter(([k]) => k.startsWith("reports/"))
      .every(([, v]) => v.status === "dismissed")
  );

  // ===== deleting an account, keeping the cases =====
  const au = await person("uid-author", db);
  await au.goto(`${base}/privacy.html`);
  await au.click("#clear-cloud-btn");
  await au.waitForSelector("[data-key=keep-keep]");
  check("account: an author is asked what to do with the cases", /Cosa faccio dei tuoi casi pubblicati/.test(await au.innerText("dialog")));
  await au.click("[data-key=keep-keep]");
  await au.waitForSelector("#privacy-status p");
  db = await database(au);
  check(
    "account: the cases stay, signed 'Account eliminato', without the nickname inside",
    card(db, "ACDEFGHJ").authorNick === "Account eliminato" &&
      JSON.parse(db["cases/ACDEFGHJ/revisions/1"].json).author === "" &&
      !db["authors/uid-author"],
    card(db, "ACDEFGHJ").authorNick
  );
  const list = await person("", db);
  await list.goto(`${base}/community.html`);
  await list.waitForSelector(".case-card[data-code=ACDEFGHJ]");
  const kept = await list.innerText(".case-card[data-code=ACDEFGHJ]");
  check(
    "account: and in the list the author is 'Account eliminato', with no page to open",
    /Account eliminato/.test(kept) && (await list.locator(".case-card[data-code=ACDEFGHJ] [data-key=author-link]").count()) === 0,
    kept
  );

  // ===== deleting an account, deleting the cases =====
  const db2 = seed();
  const au2 = await person("uid-author", db2);
  await au2.goto(`${base}/privacy.html`);
  await au2.click("#clear-cloud-btn");
  await au2.waitForSelector("[data-key=keep-delete]");
  await au2.click("[data-key=keep-delete]");
  await au2.waitForSelector("#privacy-status p");
  const after = await database(au2);
  check(
    "account: or the cases are deleted with everything about them",
    !after["cases/ACDEFGHJ"] && !after["cases/ACDEFGHJ/revisions/1"] && !after["caseHashes/hash"] && !after["authors/uid-author"]
  );

  // ===== a reader deletes theirs: likes and follows go =====
  const db3 = seed();
  const rr = await person("uid-r", db3);
  await rr.goto(`${base}/community.html`);
  await rr.waitForSelector(".case-card[data-code=ACDEFGHJ]");
  await rr.locator(".case-card[data-code=ACDEFGHJ] [data-key=like]").click();
  await rr.waitForFunction(() => document.querySelector(".case-card[data-code=ACDEFGHJ] [data-key=like]")?.textContent === "♥ 1");
  await rr.goto(`${base}/privacy.html`);
  await rr.click("#clear-cloud-btn");
  await rr.waitForSelector("#privacy-status p");
  const gone = await database(rr);
  check(
    "account: a reader's like is taken back when they delete the account",
    card(gone, "ACDEFGHJ").stats.likes === 0 && !gone["cases/ACDEFGHJ/likes/uid-r"],
    JSON.stringify(card(gone, "ACDEFGHJ").stats)
  );
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  server.close();
}

check("no page errors", errors.length === 0, errors.join("\n"));
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
