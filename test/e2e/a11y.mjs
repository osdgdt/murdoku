// `npm run e2e:a11y`: runs axe-core against the main screens (at phone width,
// in English) and fails on any violation. Boards are rendered first so the
// grid markup is audited too.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installFakeFirebase } from "./lib/fakeFirebase.mjs";
import { sampleCases } from "./lib/sampleCases.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const axeSource = await readFile(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const PAGES = [
  ["home", "index.html"],
  ["player (fixture case)", "player.html?import=test/fixtures/tutorial.en.murdoku.json"],
  ["player picker", "player.html"],
  ["editor (fixture case)", null], // opened via the saved case's id, below
  // the room's name and colour controls only exist while a room is selected
  ["editor (a room selected)", null, (page) => page.locator(".swatch").first().click(), "#zone-rename-input"],
  // «Come si risolve»: the difficulty detail open, with the board of the human a few steps in
  [
    "editor (how it is solved, step by step)",
    null,
    async (page) => {
      await page.waitForSelector("#difficulty-preview .difficulty-details", { timeout: 30000 });
      await page.locator("#difficulty-preview summary").click();
      for (let i = 0; i < 3; i++) await page.locator("#difficulty-preview .replay-bar .replay-btn").nth(2).click(); // ▶
    },
    "#difficulty-preview .replay-board",
  ],
  // the clue wizard: its two steps (the type list, then the sentence with its controls)
  [
    "editor (clue wizard, step 1)",
    null,
    (page) => page.locator('#clue-panel [data-key^="new-"]').nth(1).click(),
    "#clue-wizard .clue-family",
  ],
  [
    "editor (clue wizard, step 2)",
    null,
    async (page) => {
      await page.locator('#clue-panel [data-key^="new-"]').nth(1).click();
      await page.locator("#clue-wizard .clue-type-card").first().click();
    },
    "#clue-wizard .clue-sentence",
  ],
  // the window that puts a case in the shared database: the form of a new case, and a case that is already published
  // (its code, link and QR); the second one is told about the publication through the browser's own memory of it
  [
    "editor (publish window, form)",
    null,
    async (page) => {
      await page.evaluate(() => localStorage.removeItem("murdoku:community:published"));
      await page.click("#publish-btn");
    },
    ".publish-dialog [data-key=publish-blurb]",
  ],
  [
    "editor (publish window, published case)",
    null,
    async (page) => {
      const id = new URL(page.url()).searchParams.get("id");
      await page.evaluate(
        (key) =>
          localStorage.setItem(
            "murdoku:community:published",
            JSON.stringify({ [key]: { code: "ACDEFGHJ", revision: 1, license: "cc-by", title: "Test" } })
          ),
        id
      );
      await page.click("#publish-btn");
    },
    ".publish-dialog [data-key=publish-qr] svg",
  ],
  // the list of the cases other players published (with a made-up Firebase and a few cards in it)
  [
    "community (list)",
    "community.html",
    async (page) => {
      await page.evaluate((cards) => localStorage.setItem("__fake_db", JSON.stringify(cards)), sampleCases());
      await page.reload();
    },
    ".case-card [data-key=play]",
  ],
  // the window to report a case (signed in, with a nickname), and the administrators' page (an administrator, a case with reports)
  [
    "community (report window)",
    "community.html",
    async (page) => {
      await page.evaluate((cards) => {
        localStorage.setItem("__fake_db", JSON.stringify({ ...cards, "profiles/uid-r": { nickname: "Lettore", key: "lettore" } }));
        localStorage.setItem("__fake_user", JSON.stringify({ uid: "uid-r", email: "r@esempio.test" }));
      }, sampleCases());
      await page.reload();
      await page.waitForSelector(".case-card [data-key=report]");
      await page.locator(".case-card [data-key=report]").first().click();
    },
    "dialog [data-key=report-go]",
  ],
  [
    "moderation (administrator)",
    "moderation.html",
    async (page) => {
      const cards = sampleCases();
      cards["cases/CDEFGHJK"].status = "hidden";
      cards["cases/CDEFGHJK"].reportsOpen = 3;
      await page.evaluate((docs) => {
        localStorage.setItem("__fake_db", JSON.stringify({ ...docs, "admins/adm": { since: 1 } }));
        localStorage.setItem("__fake_user", JSON.stringify({ uid: "adm", email: "adm@esempio.test" }));
      }, cards);
      await page.reload();
    },
    "[data-key=mod-list] .case-card",
  ],
  ["privacy", "privacy.html"],
  ["tutorial", "tutorial.html"],
];

let failed = false;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await installFakeFirebase(page);
  await page.goto(`${base}/player.html?import=test/fixtures/tutorial.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const tutorialId = new URL(page.url()).searchParams.get("id");

  for (const theme of ["light", "dark", "contrast"]) {
    await page.evaluate((t) => localStorage.setItem("murdoku:theme", t), theme);
    for (const [pageName, url, prepare, waitFor] of PAGES) {
      const name = `${pageName} [${theme}]`;
      const target = url ?? `editor.html?id=${tutorialId}`;
      await page.goto(`${base}/${target}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      if (prepare) {
        await prepare(page);
        await page.waitForSelector(waitFor);
      }
      await page.evaluate(axeSource);
      const result = await page.evaluate(() => globalThis.axe.run(document, { resultTypes: ["violations"] }));
      if (result.violations.length) {
        failed = true;
        console.error(`✗ ${name}`);
        for (const v of result.violations) {
          console.error(`   [${v.impact}] ${v.id}: ${v.help}`);
          for (const n of v.nodes.slice(0, 3)) console.error(`      ${n.target.join(" ")}`);
        }
      } else {
        console.log(`✓ ${name}: no axe violations`);
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
