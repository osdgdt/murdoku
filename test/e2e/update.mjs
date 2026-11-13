// Browser update test (`npm run e2e:update`): a "deploy" while the service worker is
// installed. The server answers like GitHub Pages (`cache-control: max-age=600` + ETag)
// and serves a build marker that changes between phases. After the deploy the page must
// offer a reload and, once reloaded, run the NEW scripts — not files the browser's HTTP
// cache still held (which used to keep a deploy invisible for ten minutes).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
let build = "v1";

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  try {
    let body = await readFile(file);
    if (pathname === "/src/model/icons.js") body = Buffer.concat([body, Buffer.from(`\nexport const BUILD = "${build}";\n`)]);
    if (pathname === "/sw.js")
      body = Buffer.from(body.toString("utf8").replace(/const VERSION = "([^"]*)"/, `const VERSION = "${build}-$1"`));
    const etag = `"${createHash("sha1").update(body).digest("hex").slice(0, 16)}"`;
    const headers = { etag, "cache-control": "max-age=600", "content-type": TYPES[path.extname(file)] || "application/octet-stream" };
    if (req.headers["if-none-match"] === etag) return void res.writeHead(304, headers).end();
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

let failed = false;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 900, height: 700 } }); // service workers allowed
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const marker = () => page.evaluate(() => import("/src/model/icons.js").then((m) => m.BUILD));

  await page.goto(`${base}/player.html`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if ((await page.locator("#update-banner").count()) !== 0) throw new Error("the very first install is not an update: no banner expected");
  await page.reload(); // now the service worker controls the page
  if ((await marker()) !== "v1") throw new Error("expected the first build");

  build = "v2"; // ---- the deploy
  await page.reload();
  await page.locator("#update-banner").waitFor({ timeout: 15000 });
  if (!/new version/i.test(await page.locator("#update-banner").innerText()))
    throw new Error("the banner should say a new version is available");
  await page.locator("#update-banner button").click();
  await page.waitForSelector("header.topbar");
  const after = await marker();
  if (after !== "v2") throw new Error(`after the deploy and one reload the page still runs ${after} (stale files from the HTTP cache)`);
  if ((await page.locator("#update-banner").count()) !== 0) throw new Error("the banner should be gone after the reload");
  if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
  console.log("✓ a deploy shows up after one reload, with the update banner (GitHub Pages cache headers)");
} catch (err) {
  failed = true;
  console.error(`✗ update flow\n  ${err.message}`);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
