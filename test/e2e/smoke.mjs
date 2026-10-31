// Browser smoke test (`npm run e2e`): serves the repo statically, then plays
// the bundled tutorial end to end in both languages — which exercises the i18n
// bootstrap, the solver Web Worker, the gesture model and the win flow, none
// of which the Node unit tests can see (they use in-process shims).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
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

const SOLUTIONS = {
  en: { names: { Alice: [0, 0], Ben: [1, 1], Clara: [2, 3] }, win: /Case solved/ },
  it: { names: { Anna: [0, 0], Bruno: [1, 1], Carla: [2, 3] }, win: /Caso risolto/ },
};

let failed = false;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const [lang, spec] of Object.entries(SOLUTIONS)) {
    const context = await browser.newContext({ locale: lang === "en" ? "en-US" : "it-IT", viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/index.html`);
    await page.click("#tutorial-link");
    await page.waitForSelector("#hint-btn");
    // The worker-backed hint path.
    await page.click("#hint-btn");
    await page.waitForSelector("#hint-panel *");
    for (const [name, [r, c]] of Object.entries(spec.names)) {
      await page.locator(".char-chip", { hasText: name }).first().click();
      const box = await page.locator(`[data-row="${r}"][data-col="${c}"]`).first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1300); // press-and-hold places the character
      await page.mouse.up();
    }
    await page.click("#submit-btn"); // worker-backed solution check
    await page.waitForFunction((re) => new RegExp(re).test(document.querySelector("#result-panel")?.innerText || ""), spec.win.source, { timeout: 15000 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    if (!fits) errors.push("page scrolls horizontally on a 390px viewport");
    if (errors.length) { failed = true; console.error(`✗ ${lang}:`, errors); } else console.log(`✓ ${lang}: tutorial solved end to end`);
    await context.close();
  }
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
