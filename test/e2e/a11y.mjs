// `npm run e2e:a11y`: runs axe-core against the main screens (at phone width,
// in English) and fails on any violation. Boards are rendered first so the
// grid markup is audited too.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
const axeSource = await readFile(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

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

const PAGES = [
  ["home", "index.html"],
  ["player (tutorial)", "player.html?import=examples/tutorial.en.murdoku.json"],
  ["player picker", "player.html"],
  ["editor (tutorial)", null], // opened via the saved tutorial's id, below
  ["privacy", "privacy.html"],
];

let failed = false;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(`${base}/player.html?import=examples/tutorial.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const tutorialId = new URL(page.url()).searchParams.get("id");

  for (const theme of ["light", "dark"]) {
  await page.evaluate((t) => localStorage.setItem("murdoku:theme", t), theme);
  for (const [pageName, url] of PAGES) {
    const name = `${pageName} [${theme}]`;
    const target = url ?? `editor.html?id=${tutorialId}`;
    await page.goto(`${base}/${target}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
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
