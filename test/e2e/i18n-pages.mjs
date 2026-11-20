// `npm run e2e:i18n`: in English, each page loads only the areas of the dictionary it needs (src/i18n/areas.js) and
// still shows English. Checks which dictionary files each page requests, and that a few Italian phrases of each page
// are gone from what it shows.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installFakeFirebase } from "./lib/fakeFirebase.mjs";

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

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

const COMMON = ["ui", "clues", "medieval"];
// page -> [areas it must load, Italian phrases that must NOT be visible]
const PAGES = {
  "index.html": [COMMON, ["Crea e gioca i tuoi casi Murdoku"]],
  "player.html": [[...COMMON, "community", "reasoning"], ["Scegli un caso da giocare"]],
  "glossary.html": [[...COMMON, "glossary", "tutorial", "reasoning"], ["Glossario degli indizi"]],
  "tutorial.html": [[...COMMON, "tutorial"], ["Come si gioca"]],
  "privacy.html": [[...COMMON, "privacy"], ["Cancella i dati di questo dispositivo"]],
  "campaign.html": [[...COMMON, "campaign", "reasoning"], ["Accedi con Google"]],
  "daily.html": [[...COMMON, "reasoning"], ["Nessuna sfida oggi"]],
  "community.html": [
    [...COMMON, "community"],
    ["Tutti i casi", "Non c'è ancora nessun caso pubblicato", "Pubblica un tuo caso"],
  ],
  "moderation.html": [
    [...COMMON, "community"],
    ["Accedi con un account amministratore", "Moderazione"],
  ],
  "editor.html": [
    [...COMMON, "glossary", "community", "reasoning"],
    ["Nuovo puzzle", "Valida soluzione"],
  ],
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const [file, [areas, italian]] of Object.entries(PAGES)) {
    const context = await browser.newContext({ locale: "en-US", viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const loaded = new Set();
    page.on("request", (r) => {
      const m = r.url().match(/\/src\/i18n\/en\/(\w+)\.js/);
      if (m) loaded.add(m[1]);
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await installFakeFirebase(page);
    await page.goto(`${base}/${file}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.body.innerText);
    check(
      `${file}: loads exactly its dictionary areas (${areas.join(", ")})`,
      [...loaded].sort().join() === [...areas].sort().join(),
      `loaded ${[...loaded].sort().join(", ")}`
    );
    for (const phrase of italian) check(`${file}: «${phrase}» is shown in English`, !text.includes(phrase));
    check(`${file}: no page errors`, errors.length === 0, errors.join("; "));
    await context.close();
  }
  // the editor's clue wizard shows glossary texts: in English too
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${id}`);
  await page.waitForSelector("#clue-panel .clue-owner");
  await page.locator('#clue-panel [data-key^="new-"]').nth(1).click();
  await page.waitForSelector("#clue-wizard .clue-family");
  const wizard = await page.innerText("#clue-wizard");
  check(
    "editor: the clue wizard's family titles are in English",
    !/Vicinanza|Posizione|Stanze/.test(wizard) && /Position|Nearness|Rooms/i.test(wizard),
    wizard.slice(0, 120)
  );
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
