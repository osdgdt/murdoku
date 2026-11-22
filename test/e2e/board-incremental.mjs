// `npm run e2e:board`: the board is drawn IN PLACE after the first draw (only the cells a move changes are touched,
// src/player/boardView.js). After every move of a long random game, the board as it stands must be exactly the board a
// fresh draw of the same state gives: notes, crosses, tokens, line notes, labels for a screen reader.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
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

// a small seeded random, so a failure can be replayed
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const [name, file, moves] of [
  ["tutorial 4x4", "test/fixtures/tutorial.en.murdoku.json", 70],
  ["monastery 7x7", "test/fixtures/monastero.en.murdoku.json", 90],
]) {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/player.html?import=${file}`);
  await page.waitForSelector("#board [role=gridcell]");
  const size = await page.locator("#board [role=row]").count();
  const rows = (await page.locator('#board [data-col="0"]').count()) || 1;

  // the board as drawn now (cells and labels; the floors' <style> and its id are not part of the comparison)
  const snapshot = () =>
    page.evaluate(() => [...document.querySelectorAll("#board .board-cell, #board .board-label")].map((n) => n.outerHTML));
  // throw the in-place state away and draw again from nothing, without changing anything on the board: re-select the tool
  const redraw = async (key) => {
    await page.evaluate(() => {
      document.querySelector("#board").__playerBoard = undefined;
    });
    await page.keyboard.press(key);
  };

  const random = rng(7);
  let selectedKey = "1";
  await page.locator(".char-chip").first().click();
  let mismatch = null;
  const cellsCount = await page.locator("#board .board-cell").count();
  const side = Math.round(Math.sqrt(cellsCount));
  for (let i = 0; i < moves && !mismatch; i++) {
    const r = Math.floor(random() * side);
    const c = Math.floor(random() * side);
    const roll = random();
    const target = page.locator(`#board [data-row="${r}"][data-col="${c}"]`);
    if (roll < 0.35)
      await target.click(); // a note (or a cross, or an erase, whatever the tool is)
    else if (roll < 0.5) {
      // a placement from the keyboard
      await target.focus();
      await page.keyboard.press("Shift+Enter");
    } else if (roll < 0.62) {
      selectedKey = String(1 + Math.floor(random() * Math.min(side, 9)));
      await page.keyboard.press(selectedKey);
    } else if (roll < 0.7) {
      selectedKey = "x";
      await page.keyboard.press("x");
    } else if (roll < 0.76) {
      selectedKey = "e";
      await page.keyboard.press("e");
    } else if (roll < 0.88) {
      await page.keyboard.press("u"); // undo
    } else {
      await page.locator(`#board .board-label[data-nav-kind="row"][data-nav-index="${r}"]`).click(); // a note on a whole row
    }
    const inPlace = await snapshot();
    await redraw(selectedKey);
    const fresh = await snapshot();
    if (JSON.stringify(inPlace) !== JSON.stringify(fresh)) {
      const at = inPlace.findIndex((html, k) => html !== fresh[k]);
      mismatch = `after move ${i + 1} (roll ${roll.toFixed(2)}): ${inPlace[at]?.slice(0, 300)} ≠ ${fresh[at]?.slice(0, 300)}`;
    }
  }
  check(`${name}: ${moves} random moves, the board drawn in place is always the board drawn from scratch`, !mismatch, mismatch ?? "");
  check(`${name}: no page errors`, errors.length === 0, errors.join("; "));
  void size;
  void rows;
  await context.close();
}
await browser.close();
server.close();
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
