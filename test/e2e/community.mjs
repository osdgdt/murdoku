// `npm run e2e:community`: the shared case database from both sides, with a stand-in for Firebase whose "Cloud Functions"
// are the real handlers (test/e2e/lib/fakeFirebase.mjs). The author publishes a case from the editor (login, nickname,
// the form, the check, the code and the QR); a reader opens the code in another browser; the author publishes a new
// revision and the reader sees "Aggiornato"; the author withdraws the case and nobody can open it any more. The Firestore
// RULES are not exercised here (see test/rules) and neither are the real functions (test/functions).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installFakeFirebase } from "./lib/fakeFirebase.mjs";

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
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function newPerson(db = null) {
  const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await installFakeFirebase(page);
  // the "database" of the fake Firebase lives in the browser's own storage: a copy of it is what another person sees
  if (db) await context.addInitScript((value) => !localStorage.getItem("__fake_db") && localStorage.setItem("__fake_db", value), db);
  return { context, page };
}
const database = (page) => page.evaluate(() => localStorage.getItem("__fake_db"));
const CODE = /^[ACDEFGHJKMNPQRTUVWXY346]{4}-[ACDEFGHJKMNPQRTUVWXY346]{4}$/;

try {
  // ===== the author =====
  const author = await newPerson();
  const page = author.page;
  await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const localId = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${localId}`);
  await page.waitForSelector("#board [role=gridcell]");

  // not played to the end yet: the window sends the author to play first
  await page.click("#publish-btn");
  await page.waitForSelector("dialog.publish-dialog[open]");
  check(
    "publish: the window opens with the form of a new case",
    (await page.inputValue("[data-key=publish-title-input]")) === "The Lighthouse in the Storm"
  );
  await page.fill("[data-key=publish-blurb]", "Una notte di tempesta al faro: chi ha spento la luce?");
  await page.selectOption("[data-key=publish-difficulty]", "easy");
  await page.click("[data-key=publish-go]");
  check("publish: a licence has to be chosen", /licenza/i.test(await page.innerText("[data-key=publish-notice]")));
  await page.check("[data-key=publish-license-cc-by]");
  await page.click("[data-key=publish-go]");
  await page.waitForSelector("[data-key=publish-play]");
  check(
    "publish: a case that was never solved is not published",
    /risolto almeno una volta/.test(await page.innerText("dialog.publish-dialog"))
  );

  // ... now it has been solved (what playing it to the end records)
  await page.evaluate((id) => {
    localStorage.setItem(
      "murdoku:achievements",
      JSON.stringify({ solves: { [`puzzle:${id}`]: { firstSolvedAt: 1, bestHintsUsed: 0, bestElapsedSeconds: 60 } }, unlocked: {} })
    );
  }, localId);
  await page.reload();
  await page.waitForSelector("#board [role=gridcell]");
  await page.click("#publish-btn");
  await page.waitForSelector("[data-key=publish-blurb]");
  await page.fill("[data-key=publish-blurb]", "Una notte di tempesta al faro: chi ha spento la luce?");
  await page.selectOption("[data-key=publish-difficulty]", "easy");
  await page.check("[data-key=publish-license-cc-by]");
  await page.check("input[value=mistero]");
  await page.click("[data-key=publish-go]");
  await page.waitForSelector("[data-key=publish-signin]");
  check("publish: signed out, the window asks to sign in", true);
  await page.click("[data-key=publish-signin]");
  await page.waitForSelector("[data-key=publish-nickname]");
  await page.fill("[data-key=publish-nickname]", "x");
  await page.click("[data-key=publish-nickname-go]");
  check("publish: a nickname that is too short is refused", /almeno/.test(await page.innerText("[data-key=publish-notice]")));
  await page.fill("[data-key=publish-nickname]", "Maigret");
  await page.click("[data-key=publish-nickname-go]");
  await page.waitForSelector("[data-key=publish-code]", { timeout: 60000 });
  const shown = (await page.innerText("[data-key=publish-code]")).trim();
  check("publish: the case is online with a readable code", CODE.test(shown), shown);
  const code = shown.replace("-", "");
  check("publish: the window shows a QR code", (await page.locator("[data-key=publish-qr] svg").count()) === 1);
  check(
    "publish: the link is player.html?c=CODE",
    (await page.inputValue("[data-key=publish-link]")) === `${base}/player.html?c=${code}`,
    await page.inputValue("[data-key=publish-link]")
  );
  check("publish: the first revision is revision 1", /Revisione 1/.test(await page.innerText("[data-key=publish-status]")));
  await page.click("[data-key=publish-copy]");
  check(
    "publish: the link goes to the clipboard",
    (await page.evaluate(() => navigator.clipboard.readText())).endsWith(`player.html?c=${code}`)
  );
  // publishing the same case again is refused: it is the same case
  await page.click("[data-key=publish-update]");
  await page.waitForSelector("[data-key=publish-blurb]");
  check(
    "update: the form starts from what is published",
    /faro/i.test(await page.inputValue("[data-key=publish-blurb]")) &&
      (await page.locator("[data-key=publish-license-cc-by]").isDisabled()),
    await page.inputValue("[data-key=publish-blurb]")
  );
  await page.click("[data-key=publish-go]");
  await page.waitForSelector("[data-key=publish-notice] >> text=/modifiche da pubblicare/", { timeout: 60000 });
  check("update: no changes, no new revision", true);
  await page.keyboard.press("Escape");

  // ===== a reader, in another browser =====
  let db = await database(page);
  const reader = await newPerson(db);
  const rp = reader.page;
  await rp.goto(`${base}/player.html?c=${code.toLowerCase()}`);
  await rp.waitForSelector("#board [role=gridcell]", { timeout: 30000 });
  check("reader: the code opens the case, with no sign-in", (await rp.innerText("#player-title")) === "The Lighthouse in the Storm");
  check(
    "reader: the panel shows the code and the author",
    /Maigret/.test(await rp.innerText("#shared-panel")) && (await rp.innerText("[data-key=shared-code]")) === shown
  );
  check("reader: a remixable case offers to remix it", (await rp.locator("[data-key=shared-remix]").count()) === 1);
  check("reader: no 'Aggiornato' banner yet", await rp.locator("[data-key=shared-update]").evaluate((n) => n.classList.contains("hidden")));
  const saved = await rp.evaluate((c) => localStorage.getItem(`murdoku:puzzle:shared_${c}`), code);
  check("reader: the case is saved here as shared_<CODE>", Boolean(saved) && JSON.parse(saved).id === `shared_${code}`);
  check("reader: the author's progress is not in it", JSON.parse(saved).completed === false && JSON.parse(saved).bestTimeSeconds === null);

  // a reader with the code in the picker
  await rp.goto(`${base}/player.html`);
  await rp.waitForSelector("[data-key=code-input]");
  await rp.fill("[data-key=code-input]", "abc");
  await rp.click("[data-key=code-go]");
  check("reader: a code that cannot be a code is refused", /non è valido/.test(await rp.innerText(".code-entry")));
  await rp.fill("[data-key=code-input]", "ACDE-FGHJ");
  await rp.click("[data-key=code-go]");
  await rp.waitForSelector(".result-banner.hint-error");
  check("reader: a code nobody published says so", /Non esiste nessun caso/.test(await rp.innerText(".result-banner")));
  await rp.fill("[data-key=code-input]", shown);
  await rp.click("[data-key=code-go]");
  await rp.waitForSelector("#board [role=gridcell]");
  check("reader: the code typed in the picker opens the case", new URL(rp.url()).searchParams.get("c") === code);
  await rp.goto(`${base}/player.html`);
  await rp.waitForSelector(".saved-row");
  check("reader: the saved copy is listed with its author", /Maigret/.test(await rp.innerText(".saved-row")));

  // ===== a new revision =====
  await page.evaluate((id) => {
    const puzzle = JSON.parse(localStorage.getItem(`murdoku:puzzle:${id}`));
    puzzle.characters[0].name = `${puzzle.characters[0].name}s`;
    localStorage.setItem(`murdoku:puzzle:${id}`, JSON.stringify(puzzle));
  }, localId);
  await page.goto(`${base}/editor.html?id=${localId}`);
  await page.waitForSelector("#board [role=gridcell]");
  await page.click("#publish-btn");
  await page.waitForSelector("[data-key=publish-update]");
  check("update: the editor remembers it is published", (await page.innerText("[data-key=publish-code]")).trim() === shown);
  await page.click("[data-key=publish-update]");
  await page.waitForSelector("[data-key=publish-blurb]");
  await page.click("[data-key=publish-go]");
  await page.waitForSelector("[data-key=publish-status] >> text=/Revisione 2/", { timeout: 60000 });
  check("update: the changes are revision 2", true);

  db = await database(page);
  await rp.evaluate((value) => localStorage.setItem("__fake_db", value), db);
  await rp.goto(`${base}/player.html?c=${code}`);
  await rp.waitForSelector("[data-key=shared-update]:not(.hidden)", { timeout: 30000 });
  check("reader: the new revision shows 'Aggiornato'", /Aggiornato/.test(await rp.innerText("[data-key=shared-update]")));
  await rp.click("[data-key=shared-update-go]");
  await rp.waitForSelector("#board [role=gridcell]");
  await rp.waitForFunction(() => document.querySelector("[data-key=shared-update]")?.classList.contains("hidden"));
  const now = await rp.evaluate((c) => JSON.parse(localStorage.getItem(`murdoku:puzzle:shared_${c}`)).characters[0].name, code);
  check("reader: after the update the copy is the new revision", now.endsWith("s"), now);
  check(
    "reader: and the browser remembers revision 2",
    await rp.evaluate((c) => JSON.parse(localStorage.getItem("murdoku:community:shared"))[c].revision === 2, code)
  );

  // ===== withdrawn =====
  await page.reload();
  await page.waitForSelector("#board [role=gridcell]");
  await page.click("#publish-btn");
  await page.waitForSelector("[data-key=publish-withdraw]");
  await page.click("[data-key=publish-withdraw]");
  await page.waitForSelector("[data-key=publish-notice] >> text=/ritirato/", { timeout: 30000 });
  check("withdraw: the author takes the case offline", true);
  db = await database(page);
  const stranger = await newPerson(db);
  await stranger.page.goto(`${base}/player.html?c=${code}`);
  await stranger.page.waitForSelector(".result-banner.hint-error", { timeout: 30000 });
  check("withdraw: nobody else can open it any more", /non è disponibile/.test(await stranger.page.innerText(".result-banner")));

  // ... and back online
  await page.click("[data-key=publish-withdraw]");
  await page.waitForSelector("[data-key=publish-notice] >> text=/di nuovo online/", { timeout: 30000 });
  check("withdraw: the author puts it back online", true);

  // ===== delete =====
  await page.click("[data-key=publish-delete]");
  await page.waitForSelector("[data-key=publish-go]", { timeout: 30000 });
  check("delete: the author deletes it, the window is the form of a new case again", true);
  db = await database(page);
  const late = await newPerson(db);
  await late.page.goto(`${base}/player.html?c=${code}`);
  await late.page.waitForSelector(".result-banner.hint-error", { timeout: 30000 });
  check("delete: the code stops working", /Non esiste nessun caso/.test(await late.page.innerText(".result-banner")));
} finally {
  await browser.close();
  server.close();
}

check("no page errors", errors.length === 0, errors.join("\n"));
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
