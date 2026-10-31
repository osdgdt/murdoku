// `npm run e2e:editor`: the author's path through the editor — open a case,
// verify it has a unique solution, find redundant clues, export a file, copy a
// share link, then open that link as a player would and check it loads.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const checks = [];
const check = (name, ok, detail = "") => { checks.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1200, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${base}/player.html?import=examples/library/library.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${id}`);
  await page.waitForSelector("#board [role=gridcell]");
  check("editor opens the case", (await page.inputValue("#puzzle-title")) === "Murder in the Study");

  await page.click("#unique-btn");
  await page.waitForSelector("#validation-panel .ok-message", { timeout: 20000 });
  check("uniqueness check reports a unique solution", /Unique solution/.test(await page.innerText("#validation-panel")));

  await page.click("#redundant-btn");
  await page.waitForFunction(() => /No redundant clues|can be removed/.test(document.querySelector("#validation-panel")?.innerText || ""), null, { timeout: 60000 });
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
  check("opening the share link loads the case in the player", (await player.innerText("#player-title")) === "Murder in the Study");

  check("no uncaught errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}
process.exit(checks.every(Boolean) ? 0 : 1);
