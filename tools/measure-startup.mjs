// `node tools/measure-startup.mjs [--root=other-checkout] [--page=player.html?import=test/fixtures/monastero.en.murdoku.json] [--runs=5] [--rtt=150] [--kbps=1600] [--rate=4]`
//
// How long the player page takes to open on a phone with a mediocre connection, with a cold cache: a 390x844 touch viewport,
// a CPU slowed down by `rate`, a network with `rtt` ms of latency and `kbps` of bandwidth (4G-ish by default), the files gzip'd
// as GitHub Pages sends them. For each run: the time until the first paint, until the board is on screen, the number of requests,
// the bytes over the wire and how many requests went one after the other (the depth of the chain of module imports).
// Served over HTTP/2 with a throwaway self-signed certificate (as GitHub Pages does: many small files are cheap there, and an
// HTTP/1.1 server would charge a round trip for every sixth file). Prints the median of the runs. Like the other measures here, a number to compare before/after a change, not a promise.
import { createSecureServer } from "node:http2";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { chromium } from "playwright";

const arg0 = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg0("root") ?? path.join(import.meta.dirname, ".."));
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const PAGE = arg("page", "player.html?import=test/fixtures/monastero.en.murdoku.json");
const RUNS = Number(arg("runs", 5));
const RTT = Number(arg("rtt", 150));
const KBPS = Number(arg("kbps", 1600));
const RATE = Number(arg("rate", 4));
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
const dir = mkdtempSync(path.join(tmpdir(), "murdoku-cert-"));
execFileSync(
  "openssl",
  ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "key.pem", "-out", "cert.pem", "-days", "1", "-subj", "/CN=localhost"],
  { cwd: dir, stdio: "ignore" }
);
const server = createSecureServer(
  { key: readFileSync(path.join(dir, "key.pem")), cert: readFileSync(path.join(dir, "cert.pem")) },
  async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "https://x").pathname);
    try {
      let body = await readFile(path.join(root, pathname === "/" ? "index.html" : pathname));
      const type = TYPES[path.extname(pathname)] || "application/octet-stream";
      const headers = { "content-type": type };
      if (/^(text|application\/json)/.test(type)) {
        body = gzipSync(body);
        headers["content-encoding"] = "gzip";
      }
      res.writeHead(200, headers);
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  }
).listen(0);
const base = `https://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

async function once() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    locale: "it-IT",
    serviceWorkers: "block",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: RTT,
    downloadThroughput: (KBPS * 1000) / 8,
    uploadThroughput: (KBPS * 1000) / 8,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  const requests = [];
  client.on("Network.requestWillBeSent", (e) => requests.push({ id: e.requestId, start: e.timestamp, url: e.request.url }));
  let bytes = 0;
  client.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
  const t0 = Date.now();
  await page.goto(`${base}/${PAGE}`, { waitUntil: "commit" });
  await page.waitForSelector("#board [role=gridcell]", { timeout: 120000 });
  const board = Date.now() - t0;
  const paints = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, p.startTime])));
  // requests that started only after another one had finished (a chain): count the distinct "waves" by start time
  const starts = requests.map((r) => r.start).sort((a, b) => a - b);
  let waves = 0;
  let last = -Infinity;
  for (const s of starts) {
    if (s - last > (RTT / 1000) * 0.6) waves++;
    last = s;
  }
  await context.close();
  return { board, paint: paints["first-contentful-paint"] ?? NaN, requests: requests.length, kb: bytes / 1024, waves };
}

const results = [];
for (let i = 0; i < RUNS; i++) results.push(await once());
await browser.close();
server.close();
const m = (key) => median(results.map((r) => r[key]));
console.log(`${PAGE} · rtt ${RTT} ms, ${KBPS} kbit/s, CPU x${RATE}, ${RUNS} runs (median)`);
console.table({
  "prima immagine (ms)": Math.round(m("paint")),
  "tabellone sullo schermo (ms)": Math.round(m("board")),
  richieste: m("requests"),
  "KB scaricati": Math.round(m("kb")),
  "ondate di richieste": m("waves"),
});
