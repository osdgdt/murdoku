// `npm run e2e:visual`: screenshots of a few key screens compared, pixel by pixel, with reference images in
// test/visual/ — a big 16×16 board (light, dark and high contrast), the clue wizard on a desktop and on a phone, the clue list.
// It catches what no other test sees: a style change that squeezes, overlaps or recolours a screen.
//
// The references were made with the Chromium of the test machine (fonts and anti-aliasing differ between browsers
// and operating systems): on another one, expect to regenerate them. A difference up to 0.3% of the pixels (and
// small colour differences) is tolerated. When a change SHOULD change a screen:
//     UPDATE_VISUAL=1 npm run e2e:visual      and look at the new images before committing them.
// A failing comparison writes the actual image to $TMPDIR/murdoku-visual/ so it can be looked at.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { buildBigPuzzle } from "./lib/bigPuzzle.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const REFERENCE_DIR = path.join(root, "test/visual");
const OUT_DIR = path.join(process.env.TMPDIR || "/tmp", "murdoku-visual");
const UPDATE = process.env.UPDATE_VISUAL === "1";
const MAX_DIFFERENT = 0.003; // share of pixels that may differ
const CHANNEL_TOLERANCE = 24; // per colour channel (0-255)

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
// A blank page used only to decode and compare images (canvas).
const judge = await (await browser.newContext()).newPage();
await judge.setContent("<canvas></canvas>");

// Compares two PNG buffers: { sizeMismatch } or { different, total }
async function compare(actual, reference) {
  return judge.evaluate(
    async ({ a, b, tolerance }) => {
      const load = async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        return { width: bitmap.width, height: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
      };
      const [x, y] = [await load(a), await load(b)];
      if (x.width !== y.width || x.height !== y.height) return { sizeMismatch: `${x.width}x${x.height} vs ${y.width}x${y.height}` };
      let different = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        if (
          Math.abs(x.data[i] - y.data[i]) > tolerance ||
          Math.abs(x.data[i + 1] - y.data[i + 1]) > tolerance ||
          Math.abs(x.data[i + 2] - y.data[i + 2]) > tolerance
        )
          different++;
      }
      return { different, total: x.width * x.height };
    },
    { a: actual.toString("base64"), b: reference.toString("base64"), tolerance: CHANNEL_TOLERANCE }
  );
}

async function verify(name, buffer) {
  const file = path.join(REFERENCE_DIR, `${name}.png`);
  if (UPDATE || !existsSync(file)) {
    if (!UPDATE) {
      check(`visual: ${name}`, false, `no reference image yet: run UPDATE_VISUAL=1 npm run e2e:visual and look at test/visual/${name}.png`);
      return;
    }
    await mkdir(REFERENCE_DIR, { recursive: true });
    await writeFile(file, buffer);
    console.log(`• ${name}: reference written (${(buffer.length / 1024).toFixed(0)} KB)`);
    return;
  }
  const result = await compare(buffer, await readFile(file));
  let ok = !result.sizeMismatch && result.different / result.total <= MAX_DIFFERENT;
  let detail = result.sizeMismatch
    ? `size ${result.sizeMismatch}`
    : `${((100 * result.different) / result.total).toFixed(2)}% of the pixels differ`;
  if (!ok) {
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(path.join(OUT_DIR, `${name}.actual.png`), buffer);
    detail += ` (actual image: ${path.join(OUT_DIR, `${name}.actual.png`)})`;
  }
  check(`visual: ${name}`, ok, detail);
}

async function newPage(viewport, theme = "light") {
  const context = await browser.newContext({
    locale: "it-IT",
    viewport,
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.addInitScript((t) => localStorage.setItem("murdoku:theme", t), theme);
  return { context, page };
}
const still = { animations: "disabled", caret: "hide" };

try {
  // ---- a 16×16 board (light, dark, high contrast): the top-left corner, labels and room names included
  for (const theme of ["light", "dark", "contrast"]) {
    const { context, page } = await newPage({ width: 1280, height: 900 }, theme);
    await page.goto(`${base}/player.html?import=/__big.murdoku.json`);
    await page.waitForSelector("#board [role=gridcell]");
    await page.locator("#board").scrollIntoViewIfNeeded();
    const box = await page.locator("#board").boundingBox();
    await verify(`board-16-${theme}`, await page.screenshot({ ...still, clip: { x: box.x, y: box.y, width: 380, height: 300 } }));
    await context.close();
  }

  // ---- the clue wizard, second step, on a desktop and on a phone
  for (const [label, viewport] of [
    ["1280", { width: 1280, height: 900 }],
    ["390", { width: 390, height: 844 }],
  ]) {
    const { context, page } = await newPage(viewport);
    await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
    await page.waitForSelector("#board [role=gridcell]");
    const id = new URL(page.url()).searchParams.get("id");
    await page.goto(`${base}/editor.html?id=${id}`);
    await page.waitForSelector("#clue-panel .clue-owner");
    if (label === "1280") {
      await page.locator("#clue-panel").scrollIntoViewIfNeeded();
      const panel = await page.locator("#clue-panel").boundingBox();
      await verify(
        "clue-list-1280",
        await page.screenshot({
          ...still,
          clip: { x: panel.x, y: panel.y, width: Math.min(panel.width, 520), height: Math.min(panel.height, 420) },
        })
      );
    }
    await page.locator('#clue-panel [data-key^="new-"]').nth(1).click();
    await page.waitForSelector("#clue-wizard .clue-family");
    await page.fill('#clue-wizard [data-key="search"]', "accanto");
    await page.locator("#clue-wizard .clue-type-card").first().click();
    await page.waitForSelector("#clue-wizard .clue-sentence");
    await page.locator("#clue-wizard").evaluate((n) => (n.style.transition = "none"));
    await verify(`clue-wizard-${label}`, await page.locator("#clue-wizard").screenshot(still));
    await context.close();
  }
} finally {
  await judge.context().close();
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
