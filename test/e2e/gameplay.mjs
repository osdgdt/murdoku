// Browser gameplay test (`npm run e2e:gameplay`): the gestures and flows the
// unit tests cannot see — tap = note, press-and-hold = place (+ automatic X
// marks), undo, progress restored after a reload, and the graded hints.
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
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const CASE_URL = `${base}/player.html?import=test/fixtures/tutorial.en.murdoku.json`;

const cell = (page, r, c) => page.locator(`[data-row="${r}"][data-col="${c}"]`).first();
const classOf = (page, r, c) => cell(page, r, c).evaluate((n) => n.className);

async function hold(page, r, c) {
  const box = await cell(page, r, c).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300); // press-and-hold places the character
  await page.mouse.up();
}

// Real touch events (Playwright's own touchscreen only does taps): tap, hold,
// drag and system cancel go through the Chrome DevTools protocol.
async function touchOn(page) {
  const client = await page.context().newCDPSession(page);
  const send = (type, points) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const centre = async (r, c) => {
    const box = await cell(page, r, c).boundingBox();
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 };
  };
  return {
    down: async (r, c) => send("touchStart", [await centre(r, c)]),
    move: async (r, c) => send("touchMove", [await centre(r, c)]),
    up: () => send("touchEnd", []),
    cancel: () => send("touchCancel", []),
  };
}

async function open(browser, { stripManualHints = false, touch = false, url = CASE_URL, ready = "#hint-btn", locale = "en-US" } = {}) {
  const context = await browser.newContext({
    locale,
    viewport: touch ? { width: 390, height: 844 } : { width: 900, height: 900 },
    hasTouch: touch,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  if (stripManualHints) {
    // Hand-written hints are always shown in full; without them the computed
    // (graded) path runs in the solver worker.
    await page.route("**/test/fixtures/tutorial.en.murdoku.json", async (route) => {
      const puzzle = JSON.parse(await readFile(path.join(root, "test/fixtures/tutorial.en.murdoku.json"), "utf8"));
      delete puzzle.manualHints;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(puzzle) });
    });
  }
  await page.goto(url);
  await page.waitForSelector(ready);
  return { context, page, errors };
}

const scenarios = [
  {
    name: "a tap jots a note, press-and-hold places the character and crosses out its row and column",
    async run(page) {
      await page.locator(".char-chip", { hasText: "Alice" }).first().click();
      await cell(page, 0, 0).click();
      if ((await cell(page, 0, 0).locator(".candidate-mark").count()) !== 1) throw new Error("tap did not add a note");
      if ((await cell(page, 0, 0).locator(".char-token").count()) !== 0) throw new Error("tap placed the character");
      await hold(page, 0, 2);
      if ((await cell(page, 0, 2).locator(".char-token").count()) !== 1) throw new Error("hold did not place the character");
      if (!(await classOf(page, 1, 2)).includes("x-mark")) throw new Error("no automatic X in the column");
      if (!(await classOf(page, 0, 3)).includes("x-mark")) throw new Error("no automatic X in the row");
    },
  },
  {
    name: "undo (U) takes a placement back, together with its automatic X marks",
    async run(page) {
      await page.locator(".char-chip", { hasText: "Alice" }).first().click();
      await hold(page, 0, 2);
      await page.keyboard.press("u");
      if ((await cell(page, 0, 2).locator(".char-token").count()) !== 0) throw new Error("undo kept the token");
      if ((await classOf(page, 1, 2)).includes("x-mark")) throw new Error("undo kept the automatic X");
    },
  },
  {
    name: "progress survives a reload (placements, automatic X marks, notes)",
    async run(page) {
      await page.locator(".char-chip", { hasText: "Ben" }).first().click();
      await cell(page, 3, 3).click(); // Ben's note (placing Alice only clears Alice's notes)
      await page.locator(".char-chip", { hasText: "Alice" }).first().click();
      await hold(page, 0, 2);
      await page.reload();
      await page.waitForSelector("#hint-btn");
      if ((await cell(page, 0, 2).locator(".char-token").count()) !== 1) throw new Error("placement lost after reload");
      if (!(await classOf(page, 1, 2)).includes("x-mark")) throw new Error("automatic X lost after reload");
      if ((await cell(page, 3, 3).locator(".candidate-mark").count()) !== 1) throw new Error("note lost after reload");
    },
  },
  {
    name: "hand-written hints can be stepped through with the arrows",
    async run(page) {
      await page.click("#hint-btn");
      await page.waitForSelector("#hint-panel *");
      const first = await page.locator("#hint-panel").innerText();
      if (!/Step 1 of/.test(first)) throw new Error(`expected a stepper, got: ${first}`);
      await page.locator("#hint-panel .hint-nav button", { hasText: "›" }).click();
      const second = await page.locator("#hint-panel").innerText();
      if (!/Step 2 of/.test(second)) throw new Error(`stepper did not advance: ${second}`);
    },
  },
  {
    name: "computed hints are graded: character, then clues, then the cell",
    options: { stripManualHints: true },
    async run(page) {
      await page.click("#hint-btn");
      await page.waitForSelector("#hint-more-btn", { timeout: 15000 });
      if ((await page.locator("#hint-panel .hint-explain").count()) !== 0) throw new Error("level 1 already lists the clues");
      await page.click("#hint-more-btn"); // level 2: clues
      await page.waitForSelector("#hint-panel .hint-explain");
      const label = await page.locator("#hint-more-btn").innerText();
      if (!/cell/i.test(label)) throw new Error(`level 2 button should offer the cell, got "${label}"`);
      await page.click("#hint-more-btn"); // level 3: everything
      await page.waitForFunction(() => !document.querySelector("#hint-more-btn"));
    },
  },
  {
    name: "touch: a quick tap jots a note, a long press places the character",
    options: { touch: true },
    async run(page) {
      const finger = await touchOn(page);
      await page.locator(".char-chip", { hasText: "Alice" }).first().click();
      await finger.down(0, 0);
      await finger.up();
      if ((await cell(page, 0, 0).locator(".candidate-mark").count()) !== 1) throw new Error("touch tap did not add a note");
      await finger.down(0, 2);
      await page.waitForTimeout(1300);
      await finger.up();
      if ((await cell(page, 0, 2).locator(".char-token").count()) !== 1) throw new Error("long press did not place the character");
      if ((await cell(page, 0, 2).locator(".candidate-mark").count()) !== 0)
        throw new Error("a hold must not also leave a note (tap after hold)");
    },
  },
  {
    name: "touch: dragging with the X tool crosses out every cell it crosses, without a tap on release",
    options: { touch: true },
    async run(page) {
      const finger = await touchOn(page);
      await page.keyboard.press("x");
      await finger.down(3, 0);
      await finger.move(3, 1);
      await finger.move(3, 2);
      await finger.up();
      for (const c of [0, 1, 2]) {
        if (!(await classOf(page, 3, c)).includes("x-mark")) throw new Error(`cell (3,${c}) was not crossed out`);
      }
    },
  },
  {
    name: "touch: a gesture cancelled by the system (touchcancel) places nothing, not even later",
    options: { touch: true },
    async run(page) {
      const finger = await touchOn(page);
      await page.locator(".char-chip", { hasText: "Alice" }).first().click();
      await finger.down(0, 2);
      await page.waitForTimeout(400);
      await finger.cancel();
      await page.waitForTimeout(1200); // past the hold threshold
      if ((await cell(page, 0, 2).locator(".char-token").count()) !== 0) throw new Error("a cancelled press placed the character");
      if ((await cell(page, 0, 2).locator(".candidate-mark").count()) !== 0) throw new Error("a cancelled press left a note");
    },
  },
  {
    name: "touch: leaving the cell before the hold time turns the press into a drag, never a placement",
    options: { touch: true },
    async run(page) {
      const finger = await touchOn(page);
      await page.locator(".char-chip", { hasText: "Alice" }).first().click();
      await finger.down(0, 0);
      await page.waitForTimeout(300);
      await finger.move(0, 1);
      await page.waitForTimeout(1200);
      await finger.up();
      if ((await page.locator(".char-token").count()) !== 0) throw new Error("a drag placed a character");
      if ((await cell(page, 0, 0).locator(".candidate-mark").count()) !== 1) throw new Error("the drag did not note the first cell");
      if ((await cell(page, 0, 1).locator(".candidate-mark").count()) !== 1) throw new Error("the drag did not note the second cell");
    },
  },
  {
    name: "tutorial page: six steps with boards, the case ends on the murderer, no horizontal scroll on a phone",
    options: { url: `${base}/tutorial.html`, ready: ".tt-step", touch: true },
    async run(page) {
      if ((await page.locator(".tt-step").count()) !== 6) throw new Error("expected six steps");
      if ((await page.locator(".tt-step .tt-board").count()) !== 6) throw new Error("every step needs its board");
      const last = await page.locator(".tt-step").last().innerText();
      if (!/Clara/.test(last)) throw new Error(`the last step should name the murderer, got: ${last}`);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      if (!fits) throw new Error("tutorial scrolls horizontally on a 390px viewport");
    },
  },
  ...["it-IT", "en-US"].map((locale) => ({
    name: `tutorial page (${locale}): cast, rooms, clues and objects are all in one language, none from the other`,
    options: { url: `${base}/tutorial.html`, ready: ".tt-step", locale },
    async run(page) {
      // Everything a visitor can see or hear: the text and the titles/labels of the boards.
      const shown = await page.evaluate(() => {
        const bits = [document.body.innerText];
        for (const node of document.querySelectorAll("[title],[aria-label]")) {
          if (node.closest("[data-lang-toggle]")) continue; // the language button names the OTHER language on purpose
          bits.push(node.getAttribute("title") || "", node.getAttribute("aria-label") || "");
        }
        return bits.join("\n");
      });
      const italian = locale === "it-IT";
      const wrongNames = italian ? /\b(Alice|Ben|Clara|Victor)\b/ : /\b(Anna|Bruno|Carla|Valerio)\b/;
      const wrongWords = italian
        ? /\b(kitchen|library|shelf|rug|window|chair|stool|plant|lamp|victim|murderer|clue|row|column)\b/i
        : /\b(cucina|biblioteca|scaffale|tappeto|finestra|sedia|sgabello|pianta|lampada|vittima|assassino|indizio|riga|colonna)\b/i;
      const found = shown.match(wrongNames) || shown.match(wrongWords);
      if (found) throw new Error(`found «${found[0]}» in the ${italian ? "Italian" : "English"} tutorial`);
      for (const mustHave of italian
        ? ["Anna", "Cucina", "Biblioteca", "scaffale", "tappeto"]
        : ["Alice", "Kitchen", "Library", "shelf", "rug"]) {
        if (!shown.includes(mustHave)) throw new Error(`«${mustHave}» is missing from the ${italian ? "Italian" : "English"} tutorial`);
      }
    },
  })),
];

let failed = false;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const scenario of scenarios) {
    const { context, page, errors } = await open(browser, scenario.options);
    try {
      await scenario.run(page);
      if (errors.length) throw new Error(`browser errors: ${errors.join("; ")}`);
      console.log(`✓ ${scenario.name}`);
    } catch (err) {
      failed = true;
      console.error(`✗ ${scenario.name}\n  ${err.message}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
