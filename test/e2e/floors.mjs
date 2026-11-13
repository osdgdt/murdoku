// `npm run e2e:floors`: the floors of the rooms must look like one continuous
// surface. (1) Every tiled floor joins itself: the pixels across the wrap-around
// edge of its tile change no more than the pixels inside it. (2) On the board,
// two neighbouring cells of a room show neighbouring pieces of the same pattern
// (the cell pitch apart), instead of each cell starting the tile over.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
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

// How much worse the seam may be than the sharpest line inside the tile. A real
// edge inside the tile (a joint, a checker square) scores about 1; a cut-off mark
// or a missing piece scores 2 or more.
const MAX_SEAM = 1.4;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await (
    await browser.newContext({ locale: "en-US", viewport: { width: 1000, height: 800 }, serviceWorkers: "block" })
  ).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/editor.html`);

  const seams = await page.evaluate(async (maxSeam) => {
    const { ZONE_TEXTURES } = await import("/src/model/textures.js");
    const bad = [];
    let tiled = 0;
    for (const [id, def] of Object.entries(ZONE_TEXTURES)) {
      const i = def.layers.findIndex((l, k) => l.startsWith("url(") && def.sizes[k] !== "auto");
      if (i < 0) continue;
      tiled++;
      const size = parseInt(def.sizes[i], 10);
      const base = def.layers[def.layers.length - 1].match(/linear-gradient\((#[0-9a-f]+)/i)?.[1] || "#888";
      const img = new Image();
      img.src = def.layers[i].slice(5, -2);
      await img.decode();
      const S = size * 3;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      const g = canvas.getContext("2d");
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);
      g.drawImage(img, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data;
      const diff = (a, b) => Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);
      const at = (x, y) => (y * S + x) * 4;
      let seamX = 0;
      let seamY = 0;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < S; y++) seamX += diff(at(S - 1, y), at(0, y));
      for (let x = 0; x < S; x++) seamY += diff(at(x, S - 1), at(x, 0));
      for (let x = 0; x < S - 1; x++) {
        let a = 0;
        for (let y = 0; y < S; y++) a += diff(at(x, y), at(x + 1, y));
        maxX = Math.max(maxX, a);
      }
      for (let y = 0; y < S - 1; y++) {
        let a = 0;
        for (let x = 0; x < S; x++) a += diff(at(x, y), at(x, y + 1));
        maxY = Math.max(maxY, a);
      }
      const rx = seamX / Math.max(maxX, 1);
      const ry = seamY / Math.max(maxY, 1);
      if (rx > maxSeam || ry > maxSeam) bad.push(`${id} (x ${rx.toFixed(2)}, y ${ry.toFixed(2)})`);
    }
    return { bad, tiled };
  }, MAX_SEAM);
  check(`all ${seams.tiled} tiled floors join themselves on every side`, seams.bad.length === 0, seams.bad.join(", "));

  // A board with one big room: the same floor under neighbouring cells.
  const offsets = await page.evaluate(async () => {
    const { createGrid, addZone, paintCellZone } = await import("/src/model/grid.js");
    const { renderBoard } = await import("/src/util/boardRender.js");
    const grid = createGrid(3, 3);
    const zone = addZone(grid, "Hall", "#f4c2c2", "flagstone_dark");
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) paintCellZone(grid, r, c, zone.id ?? zone);
    document.body.innerHTML = '<div id="b" class="board-grid"></div>';
    renderBoard(document.getElementById("b"), grid, { showLabels: false });
    const cell = (r, c) => document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    // The tile layer is the one whose size is not "auto"; read its offset.
    const tileOffset = (r, c) => {
      const cs = getComputedStyle(cell(r, c));
      const sizes = cs.backgroundSize.split(", ");
      const pos = cs.backgroundPosition.split(", ");
      const i = sizes.findIndex((s) => s !== "auto" && s !== "auto auto");
      const [x, y] = pos[i].split(" ").map(parseFloat);
      return {
        x,
        y,
        origin: cs.backgroundOrigin.split(", ")[i],
        pitch: cell(0, 1).getBoundingClientRect().x - cell(0, 0).getBoundingClientRect().x,
      };
    };
    return { a: tileOffset(0, 0), right: tileOffset(0, 1), twoRight: tileOffset(0, 2), below: tileOffset(1, 0) };
  });
  const near = (a, b) => Math.abs(a - b) < 0.6;
  check(
    "the first cell of a room starts the pattern at its own corner",
    near(offsets.a.x, 0) && near(offsets.a.y, 0),
    JSON.stringify(offsets.a)
  );
  check(
    "the next cell to the right shows the next piece of the pattern (one cell pitch further)",
    near(offsets.right.x, -offsets.a.pitch) && near(offsets.right.y, 0) && near(offsets.twoRight.x, -2 * offsets.a.pitch),
    JSON.stringify([offsets.right, offsets.twoRight])
  );
  check(
    "the cell below does the same vertically",
    near(offsets.below.y, -offsets.a.pitch) && near(offsets.below.x, 0),
    JSON.stringify(offsets.below)
  );
  check(
    "the pattern is measured from the cell's outer edge, so a room wall does not shift it",
    offsets.a.origin === "border-box",
    offsets.a.origin
  );

  check("no uncaught errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}
process.exit(checks.every(Boolean) ? 0 : 1);
