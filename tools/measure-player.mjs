// `node tools/measure-player.mjs [--rate=6]`
//
// How the player page feels on a phone, in numbers: a 390x844 touch viewport and a CPU slowed down by `rate` (6 by default, about a
// mid-range phone), real touch events through the DevTools protocol. For a 7x7 case, a 9x9 and a 16x16 (the last two with notes
// on every cell, the worst case) it prints the median time from a tap to the board painted, how long the render after a long press
// takes, and how long the main thread stays blocked while a finger drags over six cells.
// A browser without a GPU cannot say anything about shadows and filters: this measures the work the page does, which is most of it.
globalThis.__MURDOKU_LANG__ = "it";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { benchCase } from "../test/bench/lib.mjs";

const root = path.resolve(import.meta.dirname, "..");
const RATE = Number(process.argv.find((a) => a.startsWith("--rate="))?.split("=")[1] ?? 6);
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webmanifest": "application/json",
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    res
      .writeHead(200, { "content-type": TYPES[path.extname(pathname)] || "application/octet-stream" })
      .end(await readFile(path.join(root, pathname === "/" ? "index.html" : pathname)));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : null);

// the case saved in the page's own storage (as the app keeps it), with notes on every cell when asked: 5 characters on each
function stored(puzzle, withNotes) {
  const progress = {
    placements: [],
    xMarks: [],
    candidates: [],
    lineNotes: [],
    autoXByCharacter: [],
    hintsUsed: 0,
    activeSeconds: 0,
    checks: 0,
  };
  if (withNotes) {
    const ids = puzzle.characters.slice(0, 5).map((c) => c.id);
    for (let r = 0; r < puzzle.grid.size.rows; r++)
      for (let c = 0; c < puzzle.grid.size.cols; c++) progress.candidates.push([`${r},${c}`, ids]);
  }
  return { puzzle, progress };
}

const cases = [
  ["monastero 7x7", null, false],
  ["9x9 con note", benchCase(9, 1), true],
  ["16x16 con note", benchCase(16, 1), true],
];
const results = [];
for (const [name, puzzle, withNotes] of cases) {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  let target = `${base}/player.html?import=test/fixtures/monastero.en.murdoku.json`;
  if (puzzle) {
    const saved = stored(puzzle, withNotes);
    await page.addInitScript(
      ({ pz, progress }) => {
        if (localStorage.getItem(`murdoku:puzzle:${pz.id}`)) return;
        localStorage.setItem(`murdoku:puzzle:${pz.id}`, JSON.stringify(pz));
        localStorage.setItem(
          "murdoku:index",
          JSON.stringify([{ id: pz.id, title: pz.title, updatedAt: Date.now(), difficulty: "", completed: false, bestTimeSeconds: null }])
        );
        localStorage.setItem(`murdoku:progress:${pz.id}`, JSON.stringify(progress));
      },
      { pz: saved.puzzle, progress: saved.progress }
    );
    target = `${base}/player.html?id=${puzzle.id}`;
  }
  const started = Date.now();
  await page.goto(target, { waitUntil: "load" });
  await page.waitForSelector("#board [role=gridcell]");
  const loadMs = Date.now() - started;
  await page.waitForTimeout(600);

  const send = (type, points) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const pointOf = async (r, c) => {
    const box = await page.locator(`#board .board-cell[data-row="${r}"][data-col="${c}"]`).boundingBox();
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 };
  };
  const side = await page.evaluate(() => document.querySelectorAll("#board [role=row]").length - 1);

  // paint marks: the moment a touch ends / the board's DOM changes, and the first frame painted after
  await page.evaluate(() => {
    window.__tap = [];
    window.__render = [];
    window.__long = [];
    let touchEnd = null;
    document.addEventListener("touchend", () => (touchEnd = performance.now()), true);
    const board = document.querySelector("#board");
    new MutationObserver(() => {
      const changed = performance.now();
      const from = touchEnd;
      touchEnd = null;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const painted = performance.now();
          window.__render.push(painted - changed);
          if (from !== null) window.__tap.push(painted - from);
        })
      );
    }).observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-label"] });
    window.__lt = [];
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({
        type: "longtask",
      });
    } catch {
      // no long-task observer in this browser: the blocked time is simply not reported
    }
  });

  // pick a character (a real tap on a chip), then tap cells
  const chip = page.locator("#player-toolbar .char-chip").nth(1);
  await chip.scrollIntoViewIfNeeded();
  const chipBox = await chip.boundingBox();
  await send("touchStart", [{ x: Math.round(chipBox.x + chipBox.width / 2), y: Math.round(chipBox.y + chipBox.height / 2), id: 1 }]);
  await send("touchEnd", []);
  await page.waitForTimeout(300);
  await page.locator("#board").scrollIntoViewIfNeeded();
  await page.evaluate(() => (window.__tap.length = 0));
  for (let i = 0; i < 8; i++) {
    const p = await pointOf(i % Math.min(side, 6), (i * 2 + 1) % Math.min(side, 6));
    await send("touchStart", [p]);
    await send("touchEnd", []);
    await page.waitForTimeout(300);
  }
  const taps = await page.evaluate(() => window.__tap.map(Math.round));

  // a long press: how long the board takes after the hold fires (the finger is still down)
  await page.evaluate(() => (window.__render.length = 0));
  const holdPoint = await pointOf(Math.min(side - 1, 3), Math.min(side - 1, 2));
  await send("touchStart", [holdPoint]);
  await page.waitForTimeout(1400);
  const holdRender = await page.evaluate(() => window.__render.map(Math.round));
  await send("touchEnd", []);
  await page.waitForTimeout(300);

  // a drag over six cells, with the X tool
  await page
    .locator("#player-toolbar .char-chip")
    .nth(1)
    .evaluate((n) => n.scrollIntoView({ block: "nearest" }));
  await page.evaluate(() => ((window.__lt.length = 0), (window.__render.length = 0)));
  const from = await pointOf(Math.min(side - 1, 4), 0);
  const to = await pointOf(Math.min(side - 1, 4), Math.min(side - 1, 5));
  await send("touchStart", [from]);
  for (let i = 1; i <= 18; i++) {
    await send("touchMove", [{ x: Math.round(from.x + ((to.x - from.x) * i) / 18), y: from.y, id: 1 }]);
    await page.waitForTimeout(16);
  }
  await send("touchEnd", []);
  await page.waitForTimeout(500);
  const longTasks = await page.evaluate(() => window.__lt.slice());
  const dragRenders = await page.evaluate(() => window.__render.map(Math.round));

  results.push({
    name,
    loadMs,
    tap: median(taps),
    hold: median(holdRender),
    drag: dragRenders.length ? Math.max(...dragRenders) : null,
    blocked: longTasks.reduce((a, b) => a + b, 0),
    longTasks: longTasks.length,
  });
  await context.close();
}
await browser.close();
server.close();
console.log(`CPU ×${RATE}, 390×844, touch. Times in ms (median unless said).`);
console.table(
  results.map((r) => ({
    caso: r.name,
    "apertura (pagina → griglia)": r.loadMs,
    "tocco → disegnato": r.tap,
    "pressione lunga → disegnato": r.hold,
    "trascinamento: peggior passo": r.drag,
    "trascinamento: thread bloccato (totale)": r.blocked,
  }))
);
