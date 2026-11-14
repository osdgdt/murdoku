// `npm run e2e:editor`: the author's path through the editor — open a case,
// verify it has a unique solution, find redundant clues, export a file, copy a
// share link, then open that link as a player would and check it loads.
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
  ".woff2": "font/woff2",
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

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1200, height: 900 },
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${id}`);
  await page.waitForSelector("#board [role=gridcell]");
  check("editor opens the case", (await page.inputValue("#puzzle-title")) === "The Lighthouse in the Storm");

  await page.click("#unique-btn");
  await page.waitForSelector("#validation-panel .ok-message", { timeout: 20000 });
  check("uniqueness check reports a unique solution", /Unique solution/.test(await page.innerText("#validation-panel")));

  await page.click("#redundant-btn");
  await page.waitForFunction(
    () => /No redundant clues|can be removed/.test(document.querySelector("#validation-panel")?.innerText || ""),
    null,
    { timeout: 60000 }
  );
  check("redundant-clue analysis finishes", true);

  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#export-btn")]);
  check("export downloads a .murdoku.json file", /\.murdoku\.json$/.test(download.suggestedFilename()), download.suggestedFilename());

  await page.click("#share-btn");
  await page.waitForFunction(() => /Link copied/.test(document.querySelector("#status")?.innerText || ""), null, { timeout: 30000 });
  const link = await page.evaluate(() => navigator.clipboard.readText());
  check("share link points to the player with the case in the fragment", /player\.html#case=/.test(link), link.slice(0, 80));

  const player = await context.newPage();
  player.on("pageerror", (e) => errors.push(String(e)));
  await player.goto(link);
  await player.waitForSelector("#board [role=gridcell]", { timeout: 20000 });
  check("opening the share link loads the case in the player", (await player.innerText("#player-title")) === "The Lighthouse in the Storm");

  // The map editor's own tools: add a room, paint a cell, place a prop, resize the grid.
  await page.fill('input[placeholder="Room name"]', "Test room");
  await page.click("text=+ Add room");
  await page.click('[data-row="4"][data-col="2"]');
  check(
    "a new room can be added and painted (it appears in the legend)",
    /Test room/.test(await page.innerText(".room-legend")),
    await page.innerText(".room-legend")
  );
  // Rename that room: select its swatch, change the name in the field. The legend and the
  // board follow, undo/redo work, a blank name is refused, and the new name is saved.
  const legend = () => page.innerText(".room-legend");
  await page.locator('.swatch[aria-label*="Test room"]').click();
  await page.fill("#zone-rename-input", "Throne room");
  await page.press("#zone-rename-input", "Enter");
  await page.waitForFunction(() => /Throne room/.test(document.querySelector(".room-legend")?.innerText || ""));
  check(
    "a room can be renamed (the legend follows)",
    /Throne room/.test(await legend()) && !/Test room/.test(await legend()),
    await legend()
  );
  check("the new name is on the board too", (await page.locator(".room-name, .room-label-text", { hasText: "Throne room" }).count()) >= 1);
  // The name is written once per room, in one cell, on a tab no wider than that cell.
  const tabs = await page.evaluate(() => {
    const names = [...document.querySelectorAll(".board-cell .room-name")];
    return {
      rooms: document.querySelectorAll(".room-legend-item").length,
      tabs: names.length,
      distinct: new Set(names.map((n) => n.textContent)).size,
      tooWide: names.filter((n) => n.getBoundingClientRect().width > n.closest(".board-cell").getBoundingClientRect().width + 0.5).length,
    };
  });
  check(
    "each room's name is on the map once, not on every cell",
    tabs.tabs === tabs.distinct && tabs.tabs <= tabs.rooms && tabs.tabs >= 1,
    JSON.stringify(tabs)
  );
  check("a room-name tab never grows wider than its cell", tabs.tooWide === 0, JSON.stringify(tabs));
  await page.click("#editor-undo-btn");
  await page.waitForFunction(() => /Test room/.test(document.querySelector(".room-legend")?.innerText || ""));
  check("undo brings the old room name back", /Test room/.test(await legend()) && !/Throne room/.test(await legend()), await legend());
  await page.click("#editor-redo-btn");
  await page.waitForFunction(() => /Throne room/.test(document.querySelector(".room-legend")?.innerText || ""));
  check("redo renames it again", /Throne room/.test(await legend()), await legend());
  await page.locator('.swatch[aria-label*="Throne room"]').click();
  await page.fill("#zone-rename-input", "   ");
  await page.press("#zone-rename-input", "Enter");
  check(
    "a blank name is refused and the old one comes back",
    (await page.inputValue("#zone-rename-input")) === "Throne room" && /Throne room/.test(await legend()),
    await page.inputValue("#zone-rename-input")
  );
  // Colour of the room: pick a chip; the room list, the board and the legend follow by themselves.
  const legendSwatch = () =>
    page.evaluate(() => {
      const item = [...document.querySelectorAll(".room-legend-item")].find((n) => /Throne room/.test(n.textContent));
      return item?.querySelector(".room-label-swatch")?.style.background || "";
    });
  const before = await legendSwatch();
  await page.locator('.swatch[aria-label*="Throne room"]').click();
  await page.locator('.room-color-chip[aria-label="Room colour: Lime"]').click();
  await page.waitForFunction((was) => {
    const item = [...document.querySelectorAll(".room-legend-item")].find((n) => /Throne room/.test(n.textContent));
    const now = item?.querySelector(".room-label-swatch")?.style.background;
    return now && now !== was;
  }, before);
  const afterLime = await legendSwatch();
  check(
    "a colour chip changes the room's colour in the legend by itself",
    afterLime !== before && afterLime !== "",
    `${before} -> ${afterLime}`
  );
  check(
    "the chip is marked as selected",
    (await page.locator('.room-color-chip[aria-label="Room colour: Lime"]').getAttribute("aria-pressed")) === "true"
  );
  await page.fill("#zone-color-input", "#3366cc");
  // (fill on a colour input already fires input + change, like the native picker does on close)
  await page.waitForFunction((was) => {
    const item = [...document.querySelectorAll(".room-legend-item")].find((n) => /Throne room/.test(n.textContent));
    const now = item?.querySelector(".room-label-swatch")?.style.background;
    return now && now !== was;
  }, afterLime);
  const afterCustom = await legendSwatch();
  check("the free colour picker changes it too", afterCustom !== afterLime, `${afterLime} -> ${afterCustom}`);
  await page.click("#editor-undo-btn");
  await page.waitForFunction((was) => {
    const item = [...document.querySelectorAll(".room-legend-item")].find((n) => /Throne room/.test(n.textContent));
    return item?.querySelector(".room-label-swatch")?.style.background === was;
  }, afterLime);
  check("undo brings the previous colour back (legend included)", (await legendSwatch()) === afterLime);
  const renamedId = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${renamedId}`);
  await page.waitForSelector("#board [role=gridcell]");
  check("the new room name is saved with the case", /Throne room/.test(await legend()), await legend());
  check("the new room colour is saved with the case", (await legendSwatch()) === afterLime, `${await legendSwatch()} vs ${afterLime}`);
  const propsBefore = await page.locator(".obj-icon").count();
  await page.locator(".palette-item").first().click();
  await page.click('[data-row="4"][data-col="1"]');
  check("a prop can be placed on the map", (await page.locator(".obj-icon").count()) === propsBefore + 1);
  await page.fill('input[aria-label="Rows"]', "7");
  await page.click("text=Apply");
  check("the grid can be resized", (await page.locator('[data-row="6"][data-col="0"]').count()) === 1);

  check("no uncaught errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}
process.exit(checks.every(Boolean) ? 0 : 1);
