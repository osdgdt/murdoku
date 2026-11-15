// `npm run e2e:bigboard`: a 16×16 case with 16 characters (the largest the app takes) in a
// real browser. The things that break first on a big grid: the page scrolling sideways,
// the notes of the 10th to 16th character being dropped, keys with no way to reach them,
// the board that cannot be dragged on a phone, and the sheet of paper that cuts it off.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createPuzzle, addCharacter, setSolutionPlacement, validatePuzzleShape } from "../../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone } from "../../src/model/grid.js";

const root = path.resolve(import.meta.dirname, "../..");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

// The case: 16×16, six rooms, 16 characters on a permutation (no clues are needed to draw it).
function buildBigPuzzle() {
  const puzzle = createPuzzle("Big 16");
  puzzle.grid = resizeGrid(puzzle.grid, 16, 16);
  const colors = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2"];
  const zones = ["Hall", "Library", "Kitchen", "Study", "Cellar", "Chapel"].map((name, i) =>
    addZone(puzzle.grid, name, colors[i], "hatch")
  );
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) paintCellZone(puzzle.grid, r, c, zones[Math.min(2, Math.floor(r / 5.4)) * 2 + (c < 8 ? 0 : 1)].id);
  }
  const names = ["Ada", "Bea", "Cleo", "Dora", "Eva", "Fay", "Gia", "Hana", "Ida", "Jo", "Kai", "Lea", "Mia", "Nia", "Ola", "Pia"];
  names.forEach((name, i) => addCharacter(puzzle, name, "person1", i === 0));
  puzzle.characters.forEach((c, i) => setSolutionPlacement(puzzle, c.id, i, (i * 5) % 16));
  return puzzle;
}
const bigPuzzle = buildBigPuzzle();
const valid = validatePuzzleShape(bigPuzzle);
if (!valid.valid) throw new Error("the test case is not valid: " + valid.errors.join(", "));

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/__big.murdoku.json") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(bigPuzzle));
    return;
  }
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const pageFits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const open = async (viewport) => {
    const context = await browser.newContext({ locale: "en-US", viewport, serviceWorkers: "block", hasTouch: viewport.width < 800 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/player.html?import=/__big.murdoku.json`);
    await page.waitForSelector("#board [role=gridcell]");
    return { context, page, errors };
  };

  // ---- the player at four widths: the page never scrolls sideways; the board does when it must
  for (const [width, height] of [
    [1280, 800],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]) {
    const { context, page, errors } = await open({ width, height });
    const info = await page.evaluate(() => {
      const board = document.querySelector("#board");
      return {
        cells: board.querySelectorAll("[role=gridcell]").length,
        chips: document.querySelectorAll(".player-toolbar .char-chip").length,
        cell: board.querySelector(".board-cell").getBoundingClientRect().width,
        boardOverflows: board.scrollWidth > board.clientWidth + 1,
        panVisible: !document.querySelector("#pan-btn").classList.contains("hidden"),
      };
    });
    check(
      `${width}px: 256 cells and 16 characters + the two tools are drawn`,
      info.cells === 256 && info.chips === 18,
      JSON.stringify(info)
    );
    check(`${width}px: cells are at least 40px (${info.cell.toFixed(0)}px)`, info.cell >= 39.5, JSON.stringify(info));
    check(`${width}px: the page does not scroll sideways`, await pageFits(page));
    check(
      `${width}px: "Move" is offered exactly when the board overflows its area`,
      info.boardOverflows === info.panVisible,
      JSON.stringify(info)
    );
    if (width <= 390) check(`${width}px: the board overflows (it scrolls inside its area)`, info.boardOverflows, JSON.stringify(info));
    check(`${width}px: no uncaught errors`, errors.length === 0, errors.join(" | "));
    await context.close();
  }

  // ---- notes for all 16 characters, keys, dots instead of letters in small cells (1280px)
  {
    const { context, page, errors } = await open({ width: 1280, height: 800 });
    const cell = page.locator('#board [data-row="3"][data-col="4"]');
    const noteSlots = async () =>
      cell.evaluate((node) =>
        [...node.querySelectorAll(".candidate-slot")].map((slot, i) => (slot.querySelector(".candidate-mark") ? i + 1 : 0)).filter(Boolean)
      );
    await page.keyboard.press("[");
    check(
      "[ with nothing selected picks the last character (16th)",
      (await page.locator(".char-chip.selected").innerText()).startsWith("Pia")
    );
    await cell.click();
    check("its note is in the 16th slot (not dropped)", (await noteSlots()).join() === "16", (await noteSlots()).join());
    check(
      "a cell with notes has 16 slots (a 4×4 box)",
      (await cell.locator(".candidate-slot").count()) === 16,
      String(await cell.locator(".candidate-slot").count())
    );
    await page.keyboard.press("0");
    check("0 picks the 10th character", (await page.locator(".char-chip.selected").innerText()).startsWith("Jo"));
    await cell.click();
    await page.keyboard.press("1");
    await cell.click();
    await page.keyboard.press("]"); // after the 1st: the 2nd
    check("] steps to the next character", (await page.locator(".char-chip.selected").innerText()).startsWith("Bea"));
    await page.keyboard.press("[");
    await page.keyboard.press("[");
    check("[ steps back, wrapping around to the 16th", (await page.locator(".char-chip.selected").innerText()).startsWith("Pia"));
    await page.waitForTimeout(100);
    check(
      "notes of the 1st, 10th and 16th character sit in their own slots",
      (await noteSlots()).join() === "1,10,16",
      (await noteSlots()).join()
    );
    const badge = await page
      .locator(".char-chip")
      .first()
      .evaluate((node) => getComputedStyle(node, "::after").content);
    check("the chips show the key that picks them", badge === '"1"', badge);
    const density = await page.evaluate(() => document.querySelector("#board").dataset.density);
    const markFont = await cell
      .locator(".candidate-mark")
      .first()
      .evaluate((node) => getComputedStyle(node).fontSize);
    check(
      `small cells (density "${density}"): notes are plain dots, without the letter`,
      (density === "tiny" || density === "small") && markFont === "0px",
      `${density} ${markFont}`
    );
    check("no uncaught errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }

  // ---- phone: "Move" lets a finger drag the board instead of marking cells
  {
    const { context, page, errors } = await open({ width: 390, height: 844 });
    await page.click("#pan-btn");
    check(
      '"Move" turns pan mode on',
      await page
        .locator("#board.pan-mode")
        .count()
        .then((n) => n === 1)
    );
    const cell = page.locator('#board [data-row="2"][data-col="2"]');
    await page.keyboard.press("2");
    await cell.scrollIntoViewIfNeeded();
    await cell.click();
    check("in pan mode a tap marks nothing", (await page.locator("#board .candidate-mark").count()) === 0);
    await page.click("#pan-btn");
    await cell.click();
    check("with pan mode off the same tap marks a note", (await page.locator("#board .candidate-mark").count()) === 1);
    check("no uncaught errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }

  // ---- the editor: the page does not scroll sideways at 1280 and 390; the character list folds
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ]) {
    const { context, page, errors } = await open({ width, height });
    const id = new URL(page.url()).searchParams.get("id");
    await page.goto(`${base}/editor.html?id=${id}`);
    await page.waitForSelector("#board [role=gridcell]");
    // (On a phone the editor page already scrolls sideways at any size, because of its own buttons: not asserted.)
    if (width >= 1280) {
      check(
        `editor ${width}px: the page does not scroll sideways`,
        await pageFits(page),
        await page.evaluate(() => `${document.documentElement.scrollWidth}>${document.documentElement.clientWidth}`)
      );
    }
    const cards = await page.evaluate(() => ({
      n: document.querySelectorAll(".character-list .character-card").length,
      folded: document.querySelectorAll(".character-list .character-card details.character-extra").length,
      height: document.querySelector(".character-list")?.getBoundingClientRect().height,
    }));
    check(
      `editor ${width}px: 16 character cards, folded (list ${Math.round(cards.height)}px)`,
      cards.n === 16 && cards.folded === 16 && cards.height < 2300,
      JSON.stringify(cards)
    );
    check(`editor ${width}px: no uncaught errors`, errors.length === 0, errors.join(" | "));
    if (width === 1280) {
      // the map editor's size inputs go up to 16
      const max = await page.evaluate(() => [...document.querySelectorAll("input[type=number]")].map((i) => i.max).filter(Boolean));
      check("the Rows/Columns inputs go up to 16", max.includes("16"), max.join());
      // print: the board fits the width of an A4 page (about 700px of paper)
      const printPage = await context.newPage();
      await printPage.goto(`${base}/print.html?id=${id}`);
      await printPage.waitForSelector(".print-board");
      const board = await printPage.evaluate(() => document.querySelector(".print-board").getBoundingClientRect().width);
      check(`print: the 16-column board is ${Math.round(board)}px wide, within an A4 page (≤ 700px)`, board <= 700, String(board));
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(checks.every(Boolean) ? 0 : 1);
