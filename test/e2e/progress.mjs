// `npm run e2e:progress`: what a person sees while the solver works — a progress bar that fills while the search
// runs (never going back), the elapsed time, "about N %", and a Cancel button that stops it — in the editor (uniqueness
// check, redundant clues) and in the player (answer check), on the hard 9x9 case of the benchmark (a few seconds of
// real search), plus the English wording ("Cancel", not "Undo").
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
const HARD_CASE = "test/bench/cases/tragedia-piastra-pendolina.murdoku.json";
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
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

// the bar and the "~N %" under a panel, sampled a few times while the work runs
async function sample(page, panel, times, everyMs) {
  const seen = [];
  for (let i = 0; i < times; i++) {
    seen.push(
      await page.evaluate((selector) => {
        const bar = document.querySelector(`${selector} .progress-bar`);
        const percent = document.querySelector(`${selector} .progress-percent`);
        const time = document.querySelector(`${selector} .progress-time`);
        return bar
          ? {
              value: bar.hasAttribute("value") ? Number(bar.value) : null,
              percent: percent?.textContent ?? "",
              time: time?.textContent ?? "",
            }
          : null;
      }, panel)
    );
    await page.waitForTimeout(everyMs);
  }
  return seen;
}
const values = (samples) => samples.filter((s) => s && s.value !== null).map((s) => s.value);
const rises = (list) => list.every((v, i) => i === 0 || v >= list[i - 1]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
// How many cores the page believes it has: with ONE the client never splits a search into slices or runs several clue
// checks at once, so a search takes the same few seconds on any machine (on a runner with more cores it would end in the
// middle of a Cancel test and the button would be gone); with 4 the redundant-clue analysis really uses its lanes.
async function newContext(cores) {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript(`Object.defineProperty(navigator, "hardwareConcurrency", { get: () => ${cores} });`);
  return context;
}
try {
  const context = await newContext(1);
  const errors = [];

  // ---- the editor ----
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/editor.html`);
  await page.waitForSelector("#unique-btn");
  await page.setInputFiles("#import-input", path.join(root, HARD_CASE));
  await page.waitForFunction(() => /imported/i.test(document.querySelector("#status")?.innerText || ""));
  check("the undo button says Undo, in English", /Undo/.test(await page.getAttribute("#editor-undo-btn", "title")));

  // the live difficulty line has no limit either: a long analysis shows a bar and Cancel in its place, and ends with the answer
  await page.waitForSelector("#difficulty-preview .progress-banner", { timeout: 15000 });
  await page.waitForFunction(
    () => /~\d+ %/.test(document.querySelector("#difficulty-preview .progress-percent")?.textContent || ""),
    null,
    { timeout: 15000 }
  );
  const lineBar = values(await sample(page, "#difficulty-preview", 3, 400));
  check(
    "difficulty line: a long analysis shows a bar that never goes back",
    lineBar.length >= 2 && rises(lineBar),
    JSON.stringify(lineBar)
  );
  check("difficulty line: it has a Cancel button", (await page.innerText("#difficulty-preview .progress-cancel")).trim() === "Cancel");
  await page.click("#difficulty-preview .progress-cancel");
  await page.waitForFunction(() => /Analysis cancelled/.test(document.querySelector("#difficulty-preview")?.innerText || ""));
  check(
    "difficulty line: Cancel stops it and offers to try again",
    (await page.locator("#difficulty-preview .difficulty-retry").innerText()).trim() === "Try again"
  );
  await page.click("#difficulty-preview .difficulty-retry");
  await page.waitForSelector("#difficulty-preview .progress-banner");
  await page.waitForSelector("#difficulty-preview .difficulty-line.ok", { timeout: 90000 });
  const lineText = await page.innerText("#difficulty-preview");
  check(
    'difficulty line: with no limit it reaches the answer (never "not finished within the limit")',
    /Unique solution/.test(lineText) && !/limit/i.test(lineText),
    lineText
  );

  await page.click("#unique-btn");
  await page.waitForSelector("#validation-panel .progress-banner");
  check(
    "uniqueness check: the Cancel button says Cancel, in English",
    (await page.innerText("#validation-panel .progress-cancel")).trim() === "Cancel"
  );
  await page.waitForFunction(() => /~\d+ %/.test(document.querySelector("#validation-panel .progress-percent")?.textContent || ""), null, {
    timeout: 15000,
  });
  const during = await sample(page, "#validation-panel", 3, 500);
  const barValues = values(during);
  check(
    "uniqueness check: the bar fills while it runs and never goes back",
    barValues.length >= 2 && rises(barValues) && barValues[barValues.length - 1] > barValues[0],
    JSON.stringify(barValues)
  );
  check(
    "uniqueness check: the percentage is shown, below 100 while it runs",
    during.every((s) => !s || !/~100 %/.test(s.percent)),
    JSON.stringify(during.map((s) => s?.percent))
  );
  check("uniqueness check: the elapsed time is shown", /⏱ \d+ s/.test(during[0]?.time ?? ""), during[0]?.time);
  await page.click("#validation-panel .progress-cancel");
  await page.waitForFunction(() => /Operation cancelled/.test(document.querySelector("#validation-panel")?.innerText || ""));
  check("Cancel stops the check and the bar is gone", (await page.locator("#validation-panel .progress-banner").count()) === 0);
  check("the button works again after a cancel", await page.locator("#unique-btn").isEnabled());

  const started = Date.now();
  await page.click("#unique-btn");
  await page.waitForSelector("#validation-panel .ok-message", { timeout: 60000 });
  check(
    "with no limit the check reaches the answer: unique",
    /Unique solution/.test(await page.innerText("#validation-panel")),
    `${Date.now() - started} ms`
  );

  // computing the solution (a verdict the check above just settled would be answered from memory, with no search to follow)
  await page.evaluate(async () => (await import("/src/solver/solverClient.js")).forgetSettledResults());
  await page.click("#calc-solution-btn");
  await page.waitForSelector("#validation-panel .progress-banner");
  await page.waitForFunction(() => /~\d+ %/.test(document.querySelector("#validation-panel .progress-percent")?.textContent || ""), null, {
    timeout: 15000,
  });
  const calcBar = values(await sample(page, "#validation-panel", 3, 300));
  check("compute solution: the bar fills and never goes back", calcBar.length >= 1 && rises(calcBar), JSON.stringify(calcBar));
  await page.click("#validation-panel .progress-cancel");
  await page.waitForFunction(() => /Operation cancelled/.test(document.querySelector("#validation-panel")?.innerText || ""));
  check("compute solution: Cancel stops it", await page.locator("#calc-solution-btn").isEnabled());

  // ---- the player: the answer check ----
  const player = await context.newPage();
  player.on("pageerror", (e) => errors.push(String(e)));
  await player.goto(`${base}/player.html?import=${HARD_CASE}`);
  await player.waitForSelector("#board [role=gridcell]");
  await player.click("#submit-btn");
  await player.waitForSelector("#result-panel .progress-banner");
  await player.waitForFunction(() => /~\d+ %/.test(document.querySelector("#result-panel .progress-percent")?.textContent || ""), null, {
    timeout: 15000,
  });
  const playerBar = values(await sample(player, "#result-panel", 3, 400));
  check("player, answer check: the bar fills and never goes back", playerBar.length >= 2 && rises(playerBar), JSON.stringify(playerBar));
  check("player: the Cancel button says Cancel", (await player.innerText("#result-panel .progress-cancel")).trim() === "Cancel");
  await player.click("#result-panel .progress-cancel");
  await player.waitForFunction(() => document.querySelector("#submit-btn")?.disabled === false, null, { timeout: 15000 });
  check(
    "player: Cancel stops the check and the button works again",
    (await player.locator("#result-panel .progress-banner").count()) === 0
  );

  // the player's hint: no time limit any more, a bar instead
  await player.click("#hint-btn");
  await player.waitForSelector("#hint-panel .progress-banner");
  await player.waitForFunction(() => /~\d+ %/.test(document.querySelector("#hint-panel .progress-percent")?.textContent || ""), null, {
    timeout: 15000,
  });
  const hintBar = values(await sample(player, "#hint-panel", 3, 400));
  check("player, hint: the bar fills and never goes back", hintBar.length >= 2 && rises(hintBar), JSON.stringify(hintBar));
  await player.click("#hint-panel .progress-cancel");
  await player.waitForFunction(() => /Hint cancelled/.test(document.querySelector("#hint-panel")?.innerText || ""), null, {
    timeout: 15000,
  });
  check("player, hint: Cancel stops it and the button works again", await player.locator("#hint-btn").isEnabled());
  await player.click("#hint-btn");
  await player.waitForFunction(() => /Step 1 of/.test(document.querySelector("#hint-panel")?.innerText || ""), null, { timeout: 120000 });
  check("with no limit the hint always arrives", true);

  // redundant clues, on a page that believes it has 4 cores (so the clue checks run in parallel lanes): one bar for the
  // whole analysis, counting the checks done; the analysis lasts ~20 s, far longer than the sampling
  const lanesContext = await newContext(4);
  const lanesPage = await lanesContext.newPage();
  lanesPage.on("pageerror", (e) => errors.push(String(e)));
  await lanesPage.goto(`${base}/editor.html`);
  await lanesPage.waitForSelector("#redundant-btn");
  await lanesPage.setInputFiles("#import-input", path.join(root, HARD_CASE));
  await lanesPage.waitForFunction(() => /imported/i.test(document.querySelector("#status")?.innerText || ""));
  await lanesPage.click("#redundant-btn");
  await lanesPage.waitForFunction(
    () => /~\d+ %/.test(document.querySelector("#validation-panel .progress-percent")?.textContent || ""),
    null,
    { timeout: 60000 }
  );
  const label = await lanesPage.innerText("#validation-panel .progress-label");
  check("redundant clues: the label counts the clues checked", /\d+\/16/.test(label), label);
  const redundantBar = values(await sample(lanesPage, "#validation-panel", 4, 700));
  check("redundant clues: the bar never goes back", redundantBar.length >= 2 && rises(redundantBar), JSON.stringify(redundantBar));
  await lanesPage.click("#validation-panel .progress-cancel");
  await lanesPage.waitForFunction(() => /Operation cancelled/.test(document.querySelector("#validation-panel")?.innerText || ""));
  check("Cancel stops the redundant-clue analysis, whichever worker it runs on", await lanesPage.locator("#redundant-btn").isEnabled());

  check("no uncaught errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `\n${failures} failure(s)` : "\nall good");
process.exit(failures ? 1 : 0);
