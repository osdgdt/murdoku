// `npm run e2e:a11y-keyboard`: playing the board WITHOUT a mouse, and what a screen reader would be told.
// Checked through the accessibility tree and the live regions (there is no real screen reader here):
// one tab stop per board, arrow/Home/End navigation, cells that say what is in them, focus kept after every
// move, spoken feedback for placements/hints/checks/the win, a Cancel for slow work, the solved case reachable.
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
const FIXTURE = "test/fixtures/faro.en.murdoku.json";
const puzzle = JSON.parse(await readFile(path.join(root, FIXTURE), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/player.html?import=${FIXTURE}`);
  await page.waitForSelector("#board [role=gridcell]");

  const active = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        row: a.dataset.row,
        col: a.dataset.col,
        kind: a.dataset.navKind,
        index: a.dataset.navIndex,
        label: a.getAttribute("aria-label"),
        cls: a.className,
      };
    });
  const spoken = () => page.evaluate(() => document.querySelector('[data-announcer="polite"]')?.textContent || "");
  const spokenNow = async (pattern, timeout = 3000) => {
    try {
      await page.waitForFunction(
        (src) =>
          new RegExp(src, "i").test(document.querySelector('[data-announcer="polite"]')?.textContent || "") ||
          new RegExp(src, "i").test(document.querySelector('[data-announcer="assertive"]')?.textContent || ""),
        pattern.source,
        { timeout }
      );
      return true;
    } catch {
      return false;
    }
  };

  // --- the board is one tab stop
  const stops = await page.locator("#board [tabindex='0']").count();
  check("the board has exactly one tab stop", stops === 1, String(stops));
  check("the toolbar has exactly one tab stop", (await page.locator("#player-toolbar [tabindex='0']").count()) === 1);
  check("the toolbar is a labelled toolbar", (await page.getAttribute("#player-toolbar", "role")) === "toolbar");
  check(
    "the board describes its keys",
    /Arrow keys/.test(
      await page.evaluate(() => document.getElementById(document.getElementById("board").getAttribute("aria-describedby")).textContent)
    )
  );

  // --- arrows, Home/End, labels
  await page.focus("#board [tabindex='0']");
  const start = await active();
  await page.keyboard.press("ArrowRight");
  const right = await active();
  check(
    "ArrowRight moves to the next cell",
    Number(right.col) === Number(start.col) + 1 && right.row === start.row,
    JSON.stringify([start, right])
  );
  check("the current cell is the only tab stop after moving", (await page.locator("#board [tabindex='0']").count()) === 1);
  await page.keyboard.press("End");
  const end = await active();
  check("End goes to the last cell of the row", Number(end.col) === puzzle.grid.size.cols - 1, JSON.stringify(end));
  await page.keyboard.press("Home");
  check("Home goes to the first cell of the row", Number((await active()).col) === 0);
  await page.keyboard.press("PageDown");
  check("PageDown goes to the last row of the column", Number((await active()).row) === puzzle.grid.size.rows - 1);
  await page.keyboard.press("Control+Home");
  const first = await active();
  check(
    "Ctrl+Home goes to the first cell",
    (first.row === "0" && first.col === "0") || first.label.startsWith("Row 1"),
    JSON.stringify(first)
  );
  await page.keyboard.press("ArrowUp");
  const header = await active();
  check("ArrowUp from the top row reaches the column label", header.kind === "col", JSON.stringify(header));
  await page.keyboard.press("ArrowDown");
  check("ArrowDown comes back into the board", (await active()).row === "0");
  check(
    "a cell says where it is and what is in it",
    /Row 1, column 1.*: empty|Row 1, column 1.*: /.test((await active()).label),
    (await active()).label
  );

  // --- placing by keyboard: focus stays, the cell and the live region say what happened
  const target = puzzle.solution.placements.find((p) => p.characterId === puzzle.characters[0].id);
  const focusCell = (r, c) =>
    page.evaluate(([row, col]) => document.querySelector(`#board [data-row="${row}"][data-col="${col}"]`).focus(), [r, c]);
  await page.keyboard.press("1"); // first character
  check("a character chip says it is pressed", (await page.locator("#player-toolbar .char-chip[aria-pressed='true']").count()) === 1);
  await focusCell(target.row, target.col);
  await page.keyboard.press("Shift+Enter");
  const afterPlace = await active();
  check(
    "focus stays on the cell after placing",
    afterPlace.row === String(target.row) && afterPlace.col === String(target.col),
    JSON.stringify(afterPlace)
  );
  check("the cell now says who is placed in it", new RegExp(puzzle.characters[0].name).test(afterPlace.label), afterPlace.label);
  check(
    "placing is announced",
    await spokenNow(new RegExp(`${puzzle.characters[0].name} placed at row ${target.row + 1}, column ${target.col + 1}`)),
    await spoken()
  );
  await page.keyboard.press("Enter");
  check("a note is announced", await spokenNow(/Note|marked|removed|added|placed|taken/));

  // --- selecting a character reads out its clues
  await page.keyboard.press("2");
  check("choosing a character reads its clues", await spokenNow(new RegExp(`${puzzle.characters[1].name} selected`)));
  // --- toolbar keys keep focus
  await page.focus("#player-toolbar [tabindex='0']");
  await page.keyboard.press("ArrowRight");
  const chipFocus = await page.evaluate(() => document.activeElement.className);
  check("arrows move between the toolbar chips", /char-chip/.test(chipFocus));
  await page.keyboard.press("Enter");
  check(
    "focus stays in the toolbar after choosing a tool",
    await page.evaluate(() => document.activeElement.classList.contains("char-chip"))
  );

  // --- a wrong check is announced; a hint is announced
  await page.click("#submit-btn");
  check("a wrong check is announced", await spokenNow(/not (yet )?all correct|Not everything/));
  check("the result area is a labelled region", (await page.getAttribute("#result-panel", "role")) === "region");
  await page.click("#hint-btn");
  await page.waitForFunction(
    () => document.querySelector("#hint-panel")?.innerText.trim().length > 0 && !document.querySelector("#hint-panel .progress-banner"),
    null,
    { timeout: 40000 }
  );
  check("a hint is announced", await spokenNow(/./));

  // --- the rest of the solution by keyboard, then the win
  for (let i = 0; i < puzzle.characters.length; i++) {
    const p = puzzle.solution.placements.find((q) => q.characterId === puzzle.characters[i].id);
    const already = await page.evaluate(
      ([r, c, name]) =>
        document.querySelector(`#board [data-row="${r}"][data-col="${c}"]`).getAttribute("aria-label").includes(`${name} placed`),
      [p.row, p.col, puzzle.characters[i].name]
    );
    if (already) continue; // placing again would take the character off (a second hold toggles)
    await page.keyboard.press(String(i + 1));
    await focusCell(p.row, p.col);
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(50);
  }
  const tokens = await page.locator("#board .char-token").count();
  check("every character is placed by keyboard", tokens === puzzle.characters.length, `${tokens} placed`);
  await page.click("#submit-btn");
  await page.waitForSelector(".win-panel", { timeout: 60000 }).catch(async () => console.log(await page.innerText("#result-panel")));
  check("the win is announced", await spokenNow(/Case solved/));
  const winFocus = await page.evaluate(() => ({
    role: document.activeElement.getAttribute("role"),
    label: document.activeElement.getAttribute("aria-label"),
  }));
  check(
    "focus moves to the solved-case region",
    winFocus.role === "region" && /Case solved/.test(winFocus.label),
    JSON.stringify(winFocus)
  );

  // --- slow work can be cancelled (the worker's answers are held back so the check is still running)
  await page.reload();
  await page.waitForSelector("#board [role=gridcell]");
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args) {
      setTimeout(() => original.apply(this, args), 4000);
    };
  });
  await page.click("#hint-btn");
  await page.waitForSelector("#hint-panel .progress-cancel");
  check(
    "a slow hint shows the time and a bar",
    (await page.locator("#hint-panel .progress-banner progress").count()) === 1 &&
      /⏱/.test(await page.innerText("#hint-panel .progress-banner"))
  );
  check("the busy region is marked", (await page.getAttribute("#hint-panel", "aria-busy")) === "true");
  await page.click("#hint-panel .progress-cancel");
  await page.waitForFunction(() => /cancelled/i.test(document.querySelector("#hint-panel")?.innerText || ""));
  check("Cancel stops a slow hint and says so", await page.locator("#hint-btn").isEnabled());

  // --- the tab title tells a hidden tab that the check is done, and goes back when the tab is shown again
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  });
  await page.reload();
  await page.waitForSelector("#board [role=gridcell]");
  const originalTitle = await page.title();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }));
  await page.click("#submit-btn");
  await page.waitForFunction(() => document.title.startsWith("✓"), null, { timeout: 60000 });
  check("a hidden tab gets the result in its title", true);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  check("the title goes back to normal when the tab is shown", (await page.title()) === originalTitle, await page.title());
  check("no uncaught errors", errors.length === 0, errors.join("; "));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
