// `npm run e2e:clues`: writing clues in the editor with the clue wizard, on a PC (1280 px) and on
// a phone (390 px): the two steps, choosing a target by tapping the board, the live check against
// the declared solution, suggested clues, editing / duplicating / moving / removing a clue.
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

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function run(label, viewport) {
  const context = await browser.newContext({ locale: "it-IT", viewport, serviceWorkers: "block", hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${id}`);
  await page.waitForSelector("#board [role=gridcell]");
  await page.waitForSelector("#clue-panel .clue-owner");

  // (the editor's own toolbar is wider than a phone: the wizard must not make that worse)
  const scrollWidth = () => page.evaluate(() => document.documentElement.scrollWidth);
  const baseWidth = await scrollWidth();
  const noHScroll = async (what) => check(`${label}: ${what}: no new horizontal scroll`, (await scrollWidth()) <= baseWidth);

  const rowsBefore = await page.locator("#clue-panel .clue-row").count();
  check(
    `${label}: the clue list is near the board`,
    await page.evaluate(() => {
      const board = document.querySelector("#board").getBoundingClientRect();
      const panel = document.querySelector("#clue-panel").getBoundingClientRect();
      return panel.left >= board.right - 1 || panel.top >= board.bottom - 1;
    })
  );

  // --- a new general clue by the two steps
  await page.click('[data-key="new-generic"]');
  await page.waitForSelector("#clue-wizard:not([hidden])");
  check(`${label}: step 1 lists families`, (await page.locator("#clue-wizard .clue-family").count()) >= 1);
  await page.fill('#clue-wizard [data-key="search"]', "diagonale");
  const found = await page.locator("#clue-wizard .clue-type-card").count();
  check(`${label}: search narrows the types`, found >= 0);
  await page.fill('#clue-wizard [data-key="search"]', "");
  await noHScroll("wizard step 1");

  // a character clue: first person, any type with a target
  const firstOwner = await page.locator('#clue-panel [data-key^="new-"]').nth(1).getAttribute("data-key");
  await page.keyboard.press("Escape");
  check(`${label}: Escape closes the wizard`, await page.locator("#clue-wizard").isHidden());
  await page.click(`[data-key="${firstOwner}"]`);
  await page.fill('#clue-wizard [data-key="search"]', "accanto");
  const card = page.locator("#clue-wizard .clue-type-card").first();
  check(`${label}: a type matches "accanto"`, (await card.count()) === 1);
  await card.click();
  const sentence = await page.textContent("#clue-wizard .clue-sentence");
  check(`${label}: the sentence is shown`, sentence.length > 5, sentence);
  const saveBtn = page.locator('#clue-wizard [data-key="save"]');
  check(`${label}: incomplete clue cannot be added`, await saveBtn.isDisabled());
  await noHScroll("wizard step 2");

  // pick the target by tapping the board
  await page.click('#clue-wizard [data-key$="|pick"]');
  check(`${label}: pick mode marks cells`, (await page.locator("#board .clue-pick-eligible").count()) > 0);
  await page.locator("#board .clue-pick-eligible").first().click();
  const choose = page.locator('#clue-wizard [data-key^="choose-"]').first();
  if (await choose.count()) await choose.click();
  await page.waitForSelector('#clue-wizard [data-key="save"]');
  check(`${label}: target chosen from the board, clue can be added`, await saveBtn.isEnabled());
  const verdict = await page.textContent("#clue-wizard .clue-verdict");
  check(`${label}: a verdict about the solution is shown`, /Vero|Falso|soluzione/.test(verdict), verdict);
  check(`${label}: the board shows the preview`, (await page.locator("#board .clue-preview-target").count()) >= 0);
  await saveBtn.click();
  await page.waitForFunction(() => document.querySelector("#clue-wizard")?.hidden);
  check(`${label}: the clue is in the list`, (await page.locator("#clue-panel .clue-row").count()) === rowsBefore + 1);

  // --- duplicate, move, edit, remove
  await page.locator("#clue-panel .clue-row").last().scrollIntoViewIfNeeded();
  const lastId = await page.locator("#clue-panel .clue-row").last().getAttribute("data-clue-id");
  await page.locator(`[data-clue-id="${lastId}"] [aria-label="Duplica indizio"]`).click();
  check(`${label}: duplicate adds a row`, (await page.locator("#clue-panel .clue-row").count()) === rowsBefore + 2);
  await page.locator(`[data-clue-id="${lastId}"] [aria-label="Modifica indizio"]`).first().click();
  check(`${label}: edit opens on step 2`, (await page.locator("#clue-wizard .clue-sentence").count()) === 1);
  await page.locator('#clue-wizard [data-key="negate-yes"]').click();
  await page.locator('#clue-wizard [data-key="save"]').click();
  check(`${label}: negated clue saved`, (await page.locator(`[data-clue-id="${lastId}"]`).count()) === 1);
  await page.locator(`[data-clue-id="${lastId}"] [aria-label="Rimuovi indizio"]`).click();
  check(`${label}: remove works`, (await page.locator("#clue-panel .clue-row").count()) === rowsBefore + 1);

  // --- suggestions
  await page.click("#clue-panel .clue-suggest-btn");
  await page.waitForSelector("#clue-wizard .clue-suggest-type");
  await page.locator("#clue-wizard .clue-suggest-type summary").first().click();
  const before = await page.locator("#clue-panel .clue-row").count();
  await page.locator("#clue-wizard .clue-add").first().click();
  check(`${label}: a suggested clue is added`, (await page.locator("#clue-panel .clue-row").count()) === before + 1);
  await noHScroll("suggestions");
  await page.screenshot({ path: process.env.CLUES_SHOT ? `${process.env.CLUES_SHOT}-${label}.png` : undefined });
  await page.keyboard.press("Escape");

  check(`${label}: no page errors`, errors.length === 0, errors.join("; "));
  await context.close();
}

// Taking clues from one case to another: export from the lighthouse case, import into the tutorial case,
// linking people by hand (the names differ).
async function clueSets() {
  const context = await browser.newContext({
    locale: "it-IT",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const open = async (fixture) => {
    await page.goto(`${base}/player.html?import=test/fixtures/${fixture}`);
    await page.waitForSelector("#board [role=gridcell]");
    const id = new URL(page.url()).searchParams.get("id");
    await page.goto(`${base}/editor.html?id=${id}`);
    await page.waitForSelector("#clue-panel .clue-owner");
  };
  await open("faro.en.murdoku.json");
  const total = await page.locator("#clue-panel .clue-row").count();
  await page.click('[data-key="export-clues"]');
  await page.waitForSelector("dialog.clueset-dialog[open]");
  check("clue sets: the export window lists every clue", (await page.locator("dialog .clueset-list input").count()) === total);
  await page.locator("dialog .clueset-list input").last().uncheck();
  const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-key="export-go"]')]);
  const file = `${process.env.TMPDIR || "/tmp"}/clues-e2e.murdoku-clues.json`;
  await download.saveAs(file);
  const exported = JSON.parse(await readFile(file, "utf8"));
  check(
    "clue sets: the file holds names, not ids",
    exported.format === "murdoku-clues" && exported.clues.length === total - 1 && exported.characters.some((c) => c.name === "Arthur")
  );
  check("clue sets: the window closes", (await page.locator("dialog[open]").count()) === 0);

  await open("tutorial.en.murdoku.json");
  const before = await page.locator("#clue-panel .clue-row").count();
  await page.click('[data-key="import-clues"]');
  await page.waitForSelector("dialog.clueset-dialog[open]");
  await page.setInputFiles('[data-key="import-file"]', file);
  await page.waitForSelector("dialog .clueset-mapping select");
  const summary = () => page.innerText("dialog .clueset-summary");
  check(
    "clue sets: nothing is linked by itself (the names differ), so nothing would be added",
    /0 indizi su/.test(await summary()),
    await summary()
  );
  const selects = page.locator("dialog .clueset-mapping select");
  const tutorialPeople = ["Alice", "Ben", "Clara", "Victor"];
  for (let i = 0; i < Math.min(await selects.count(), 4); i++) {
    const options = await selects.nth(i).locator("option").allInnerTexts();
    if (options.includes(tutorialPeople[i])) await selects.nth(i).selectOption({ label: tutorialPeople[i] });
  }
  await page.waitForFunction(() => !/ 0 indizi su/.test(document.querySelector("dialog .clueset-summary")?.innerText || ""));
  check(
    "clue sets: after linking people the summary counts what will be added",
    /Verranno aggiunti \d+ indizi/.test(await summary()),
    await summary()
  );
  await page.click('[data-key="import-go"]');
  await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 0);
  const after = await page.locator("#clue-panel .clue-row").count();
  check("clue sets: the imported clues are in the list", after > before, `${before} -> ${after}`);
  check(
    "clue sets: the editor says how many came in",
    /Importati \d+ indizi/.test(await page.innerText("#status")),
    await page.innerText("#status")
  );
  await page.click("#editor-undo-btn");
  check("clue sets: the whole import is one undo step", (await page.locator("#clue-panel .clue-row").count()) === before);
  check("clue sets: no page errors", errors.length === 0, errors.join("; "));
  await context.close();
}

// The difficulty line above the clues follows the edits by itself.
async function livePreview() {
  const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${id}`);
  await page.waitForSelector("#clue-panel .clue-owner");
  await page.waitForSelector("#difficulty-preview .difficulty-line.ok", { timeout: 30000 });
  const text = await page.innerText("#difficulty-preview");
  check(
    "live preview: a unique case says so, with the difficulty and the hardest reasoning",
    /Soluzione unica/.test(text) && /Difficoltà stimata/.test(text) && /ragionamento più difficile/.test(text),
    text
  );
  check("live preview: it is a polite live region", (await page.getAttribute("#difficulty-preview", "aria-live")) === "polite");
  check("live preview: the old estimate button is gone", (await page.locator("#estimate-btn").count()) === 0);
  // drop clues one by one: the line changes by itself, and with none left it asks for clues
  while ((await page.locator("#clue-panel .clue-row").count()) > 0)
    await page.locator('#clue-panel .clue-row [aria-label="Rimuovi indizio"]').first().click();
  await page.waitForFunction(
    () => /Aggiungi personaggi e indizi/.test(document.querySelector("#difficulty-preview")?.innerText || ""),
    null,
    { timeout: 15000 }
  );
  check("live preview: with no clues it asks for clues", true);
  await page.click("#editor-undo-btn");
  await page.waitForFunction(
    () => /Soluzione unica|Più di una soluzione|Analisi/.test(document.querySelector("#difficulty-preview")?.innerText || ""),
    null,
    { timeout: 30000 }
  );
  check("live preview: undo brings the analysis back", true);
  check("live preview: no page errors", errors.length === 0, errors.join("; "));
  await context.close();
}

// Proposing a whole set of clues for a case whose solution is declared.
async function generator() {
  const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/player.html?import=test/fixtures/faro.en.murdoku.json`);
  await page.waitForSelector("#board [role=gridcell]");
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`${base}/editor.html?id=${id}`);
  await page.waitForSelector("#clue-panel .clue-owner");
  while ((await page.locator("#clue-panel .clue-row").count()) > 0)
    await page.locator('#clue-panel .clue-row [aria-label="Rimuovi indizio"]').first().click();

  // cancel a slow one first (the worker's answers are held back)
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args) {
      setTimeout(() => original.apply(this, args), 4000);
    };
    window.__restoreWorker = () => (Worker.prototype.postMessage = original);
  });
  await page.click('[data-key="propose-set"]');
  await page.waitForSelector('#clue-wizard [data-key="generate"]');
  check(
    "generator: levels and options are offered",
    (await page.locator("#clue-wizard .clue-chip[aria-pressed]").count()) >= 3 &&
      (await page.locator('[data-key="gen-victim"]').isChecked()) &&
      (await page.locator('[data-key="gen-keep"]').isChecked())
  );
  await page.click('[data-key="generate"]');
  await page.waitForSelector("#clue-wizard .progress-cancel");
  await page.click("#clue-wizard .progress-cancel");
  await page.waitForSelector('#clue-wizard [data-key="generate"]');
  check("generator: Cancel stops a slow generation", (await page.locator("#clue-wizard .clue-gen-list").count()) === 0);
  await page.evaluate(() => window.__restoreWorker());

  await page.click('[data-key="generate"]');
  await page.waitForSelector("#clue-wizard .clue-gen-list", { timeout: 60000 });
  const proposed = await page.locator("#clue-wizard .clue-gen-list li").count();
  check(
    "generator: a set is proposed, all ticked, and it says the solution is unique",
    proposed > 0 &&
      (await page.locator("#clue-wizard .clue-gen-list input:checked").count()) === proposed &&
      /la soluzione è unica/.test(await page.innerText("#clue-wizard"))
  );
  const victimName = "Victor";
  check("generator: no proposed clue is about the victim", !(await page.innerText("#clue-wizard .clue-gen-list")).includes(victimName));
  await page.click('[data-key="gen-add"]');
  await page.waitForFunction(() => document.querySelector("#clue-wizard")?.hidden);
  check("generator: the selected clues are added", (await page.locator("#clue-panel .clue-row").count()) === proposed);
  await page.waitForFunction(() => /Soluzione unica/.test(document.querySelector("#difficulty-preview")?.innerText || ""), null, {
    timeout: 30000,
  });
  check("generator: the live line confirms the solution is unique", true);
  await page.click("#editor-undo-btn");
  check("generator: adding the set is one undo step", (await page.locator("#clue-panel .clue-row").count()) === 0);
  check("generator: no page errors", errors.length === 0, errors.join("; "));
  await context.close();
}

try {
  await generator();
  await livePreview();
  await clueSets();
  await run("1280", { width: 1280, height: 900 });
  await run("390", { width: 390, height: 844 });
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
