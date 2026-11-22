// `npm run e2e:touch`: the phone, with real touch events (no mouse): the 16×16 board (the "Move" button, dragging
// the board, a tap for a note, a long press to place a character) and the clue wizard in the editor (opening it,
// choosing a type, picking a target by tapping the board, adding the clue; scrolling the sheet with a finger;
// buttons big enough for a finger).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { buildBigPuzzle } from "./lib/bigPuzzle.mjs";
import { touchOn } from "./lib/touch.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const big = buildBigPuzzle();
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/__big.murdoku.json") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(big));
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
async function phone() {
  const context = await browser.newContext({
    locale: "it-IT",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}

try {
  // ---- the 16×16 board with a finger
  {
    const { context, page, errors } = await phone();
    await page.goto(`${base}/player.html?import=/__big.murdoku.json`);
    await page.waitForSelector("#board [role=gridcell]");
    const finger = await touchOn(page);
    check("touch: with no tool selected the board is in scroll mode", (await page.locator("#board.no-tool").count()) === 1);
    const before = await page.evaluate(() => document.querySelector("#board").scrollLeft);
    await finger.drag(page.locator('#board [data-row="3"][data-col="3"]'), -150, 0);
    const after = await page.evaluate(() => document.querySelector("#board").scrollLeft);
    check("touch: dragging a finger moves the board", after > before + 20, `${before} -> ${after}`);
    check("touch: with no tool nothing was marked", (await page.locator("#board .candidate-mark, #board .char-token").count()) === 0);
    await finger.tap(page.locator(".char-chip").nth(1));
    const cell = page.locator('#board [data-row="2"][data-col="2"]');
    await finger.tap(cell);
    check("touch: a tap on a cell jots a note", (await cell.locator(".candidate-mark").count()) === 1);
    // (the toolbar is fixed at the bottom of the screen on a phone: bring the cell to the middle, clear of it)
    await page.locator('#board [data-row="4"][data-col="4"]').evaluate((n) => n.scrollIntoView({ block: "center", inline: "center" }));
    await finger.hold(page.locator('#board [data-row="4"][data-col="4"]'));
    check(
      "touch: a long press places the selected character",
      (await page.locator('#board [data-row="4"][data-col="4"] .char-token').count()) === 1
    );
    // «Piazza»: a single tap places the character, no long press needed
    await finger.tap(page.locator('.pen-mode [data-mode="place"]'));
    const spot = page.locator('#board [data-row="6"][data-col="6"]');
    await page.locator('#board [data-row="6"][data-col="6"]').evaluate((n) => n.scrollIntoView({ block: "center", inline: "center" }));
    await finger.tap(spot);
    check("touch: in «Piazza» mode a single tap places the character", (await spot.locator(".char-token").count()) === 1);
    await finger.tap(page.locator('.pen-mode [data-mode="note"]'));
    // the «Scorri» chip gives the finger back to the page
    await finger.tap(page.locator(".scroll-chip"));
    check("touch: the «Scorri» chip brings scroll mode back", (await page.locator("#board.no-tool").count()) === 1);
    check(
      "touch: the page does not scroll sideways",
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    );
    check("touch: no page errors", errors.length === 0, errors.join("; "));
    await context.close();
  }

  // ---- the clue wizard in the editor, by touch only
  {
    const { context, page, errors } = await phone();
    await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
    await page.waitForSelector("#board [role=gridcell]");
    const id = new URL(page.url()).searchParams.get("id");
    await page.goto(`${base}/editor.html?id=${id}`);
    await page.waitForSelector("#clue-panel .clue-owner");
    const finger = await touchOn(page);
    const rowsBefore = await page.locator("#clue-panel .clue-row").count();

    await finger.tap(page.locator('#clue-panel [data-key^="new-"]').nth(1));
    await page.waitForSelector("#clue-wizard .clue-family");
    // the sheet's list scrolls under a finger
    const body = page.locator("#clue-wizard .clue-wizard-body");
    const top = await body.evaluate((n) => n.scrollTop);
    await finger.drag(page.locator("#clue-wizard .clue-type-card").nth(2), 0, -220);
    check("touch: the clue sheet scrolls with a finger", (await body.evaluate((n) => n.scrollTop)) > top);
    // buttons and choices are big enough to hit
    const sizes = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "#clue-wizard .clue-type-card, #clue-wizard .clue-wizard-footer button, #clue-wizard .clue-wizard-close"
        ),
      ].map((n) => Math.round(n.getBoundingClientRect().height))
    );
    check(
      "touch: every choice in the sheet is at least 44 px high",
      sizes.length > 3 && sizes.every((h) => h >= 44),
      JSON.stringify(sizes)
    );

    await page.fill('#clue-wizard [data-key="search"]', "accanto");
    await finger.tap(page.locator("#clue-wizard .clue-type-card").first());
    await page.waitForSelector('#clue-wizard [data-key$="|pick"]');
    await finger.tap(page.locator('#clue-wizard [data-key$="|pick"]'));
    await page.waitForSelector("#board .clue-pick-eligible");
    check(
      "touch: choosing a target by tapping the board marks the cells you can tap",
      (await page.locator("#board .clue-pick-eligible").count()) > 0
    );
    const target = page.locator("#board .clue-pick-eligible").first();
    await target.scrollIntoViewIfNeeded();
    await finger.tap(target);
    const chooser = page.locator('#clue-wizard [data-key^="choose-"]').first();
    if (await chooser.count()) await finger.tap(chooser);
    await page.waitForSelector('#clue-wizard [data-key="save"]');
    check("touch: the tapped target completes the clue", await page.locator('#clue-wizard [data-key="save"]').isEnabled());
    await finger.tap(page.locator('#clue-wizard [data-key="save"]'));
    await page.waitForFunction(() => document.querySelector("#clue-wizard")?.hidden);
    check("touch: the clue is added", (await page.locator("#clue-panel .clue-row").count()) === rowsBefore + 1);
    check(
      "touch: the page does not scroll sideways beyond the editor's own toolbar",
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 130)
    );
    check("touch: no page errors", errors.length === 0, errors.join("; "));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
