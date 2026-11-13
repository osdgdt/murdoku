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
  ...["it-IT", "en-US"].map((locale) => ({
    name: `glossary page (${locale}): cast, rooms, clues and texts are all in one language, none from the other`,
    options: { url: `${base}/glossary.html`, ready: ".gl-card", locale },
    async run(page) {
      // The little boards are drawn only when they are about to scroll into view: bring each pending one into view.
      await page.evaluate(async () => {
        for (let pass = 0; pass < 100; pass++) {
          const pending = document.querySelector(".gl-figure.pending");
          if (!pending) return;
          pending.scrollIntoView({ block: "center" });
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      });
      await page.waitForFunction(() => !document.querySelector(".gl-figure.pending"), null, { timeout: 15000 });
      const shown = await page.evaluate(() => {
        const bits = [document.body.innerText];
        for (const node of document.querySelectorAll("[title],[aria-label]")) {
          if (node.closest("[data-lang-toggle]")) continue; // the language button names the OTHER language on purpose
          bits.push(node.getAttribute("title") || "", node.getAttribute("aria-label") || "");
        }
        return bits.join("\n");
      });
      const italian = locale === "it-IT";
      const wrongNames = italian ? /\b(Alice|Ben|Clara|David)\b/ : /\b(Anna|Bruno|Carla|Dario)\b/;
      const wrongWords = italian
        ? /\b(kitchen|lounge|bathroom|shelf|rug|window|chair|stool|plant|lamp)\b/i
        : /\b(cucina|salotto|bagno|scaffale|tappeto|finestra|sedia|sgabello|pianta|lampada)\b/i;
      const found = shown.match(wrongNames) || shown.match(wrongWords);
      if (found) throw new Error(`found «${found[0]}» in the ${italian ? "Italian" : "English"} glossary`);
      for (const mustHave of italian ? ["Anna", "Cucina", "scaffale"] : ["Alice", "Kitchen", "shelf"]) {
        if (!shown.includes(mustHave)) throw new Error(`«${mustHave}» is missing from the ${italian ? "Italian" : "English"} glossary`);
      }
    },
  })),
  {
    name: "campaign hidden clues: a padlock replaces the hidden clue, and the case is still solved against the complete answer key",
    options: { url: `${base}/player.html`, ready: "header.topbar" },
    async run(page) {
      // Drive the real game screen the way campaign.html does (that page needs Firebase, this does not).
      const hiddenText = await page.evaluate(async () => {
        const model = await import("/src/campaign/campaignModel.js");
        const { createGameScreen } = await import("/src/player/gameScreen.js");
        const { createBoardState } = await import("/src/player/board.js");
        const { importPuzzleFromUrl } = await import("/src/storage/importExport.js");
        const { describeClue } = await import("/src/model/clueTypes.js");
        const puzzle = await importPuzzleFromUrl("test/fixtures/tutorial.en.murdoku.json");
        const campaign = model.createCampaign("Test");
        const first = model.addCase(campaign, { puzzleId: "a", puzzleUrl: "a.json", label: "The first case" });
        const second = model.addCase(campaign, { puzzleId: puzzle.id, puzzleUrl: "b.json", label: "The second case" });
        const hidden = puzzle.clues[0];
        model.setClueUnlock(campaign, second.id, hidden.id, first.id);
        const locks = model.applyClueLocks(puzzle, campaign, second.id, []);
        document.querySelector("#puzzle-picker").classList.add("hidden");
        document.querySelector("#game").classList.remove("hidden");
        createGameScreen({
          puzzle: locks.puzzle,
          answerPuzzle: locks.answerPuzzle,
          state: createBoardState(),
          persistProgress() {},
          onSolved: async () => {},
          achievementKey: "test:hidden-clues",
        }).start();
        return describeClue(hidden, puzzle);
      });
      await page.waitForSelector("#clues-panel .clue-card");
      const panel = await page.locator("#clues-panel").innerText();
      if ((await page.locator("#clues-panel .locked-clue").count()) !== 1)
        throw new Error("expected exactly one padlock on the clue cards");
      if (!/Hidden clue: solve “The first case”/.test(panel)) throw new Error(`the padlock should name the case that reveals it: ${panel}`);
      if (panel.includes(hiddenText)) throw new Error(`the hidden clue's text leaked: ${hiddenText}`);
      // Solve it: the win is judged on the complete case even though a clue is hidden.
      for (const [name, [r, c]] of Object.entries({ Alice: [0, 2], Ben: [1, 1], Clara: [2, 3], Victor: [3, 0] })) {
        await page.locator(".char-chip", { hasText: name }).first().click();
        await hold(page, r, c);
      }
      await page.click("#submit-btn");
      await page.waitForFunction(() => /Case solved/.test(document.querySelector("#result-panel")?.innerText || ""), null, {
        timeout: 15000,
      });
    },
  },
  {
    name: "campaign hidden clues: solving a case announces the clues it revealed in later cases",
    options: { url: `${base}/player.html`, ready: "header.topbar" },
    async run(page) {
      const text = await page.evaluate(async () => {
        const model = await import("/src/campaign/campaignModel.js");
        const { renderUnlockNote } = await import("/src/campaign/unlockNote.js");
        const campaign = model.createCampaign("Test");
        const a = model.addCase(campaign, { puzzleId: "a", puzzleUrl: "a.json", label: "One" });
        const b = model.addCase(campaign, { puzzleId: "b", puzzleUrl: "b.json", label: "Two" });
        const c = model.addCase(campaign, { puzzleId: "c", puzzleUrl: "c.json", label: "Finale" });
        model.setClueUnlock(campaign, c.id, "k1", a.id);
        model.setClueUnlock(campaign, c.id, "k2", a.id);
        model.setClueUnlock(campaign, c.id, "k3", b.id);
        return [
          renderUnlockNote(campaign, a.id)?.textContent,
          renderUnlockNote(campaign, b.id)?.textContent,
          renderUnlockNote(campaign, c.id),
        ];
      });
      if (text[0] !== "🔓 You have discovered new clues: 2 clues in the case “Finale”.") throw new Error(`unexpected note: ${text[0]}`);
      if (text[1] !== "🔓 You have discovered new clues: 1 clue in the case “Finale”.") throw new Error(`unexpected note: ${text[1]}`);
      if (text[2] !== null) throw new Error("the last case reveals nothing");
    },
  },
  {
    name: "campaign editor panel: pick which earlier case reveals a clue; saved, counted, and a stale choice is flagged",
    options: { url: `${base}/player.html`, ready: "header.topbar" },
    async run(page) {
      await page.evaluate(async () => {
        const model = await import("/src/campaign/campaignModel.js");
        const { createUnlockPanel } = await import("/src/campaign/unlockPanel.js");
        const { importPuzzleFromUrl } = await import("/src/storage/importExport.js");
        const puzzle = await importPuzzleFromUrl("test/fixtures/tutorial.en.murdoku.json");
        const campaign = model.createCampaign("Test");
        const a = model.addCase(campaign, { puzzleId: "a", puzzleUrl: "a.json", label: "Alpha" });
        const b = model.addCase(campaign, { puzzleId: "b", puzzleUrl: "b.json", label: "Beta" });
        const c = model.addCase(campaign, { puzzleId: puzzle.id, puzzleUrl: "c.json", label: "Finale" });
        window.__campaign = campaign;
        window.__saves = 0;
        const host = document.createElement("div");
        host.id = "panel-host";
        // a stale rule: Beta's first clue is wired to the LATER case Finale, which can never be solved first
        model.setClueUnlock(campaign, b.id, puzzle.clues[0].id, c.id);
        for (const [entry, index] of [
          [a, 0],
          [c, 2],
          [b, 1],
        ]) {
          host.appendChild(
            createUnlockPanel({ campaign, caseEntry: entry, index, loadPuzzle: async () => puzzle, onChange: () => window.__saves++ })
          );
        }
        window.__finale = c;
        document.body.prepend(host);
      });
      const panels = page.locator("#panel-host details");
      // the first case has nobody before it
      await panels.nth(0).locator("summary").click();
      await panels.nth(0).locator(".unlock-body p").waitFor();
      if (!/no earlier cases/.test(await panels.nth(0).innerText())) throw new Error("the first case should say it has no earlier cases");
      // the finale: one row per clue, the choices are the earlier cases only
      await panels.nth(1).locator("summary").click();
      await panels.nth(1).locator(".unlock-row").first().waitFor();
      const rows = await panels.nth(1).locator(".unlock-row").count();
      const total = await page.evaluate(
        async () =>
          (await import("/src/storage/importExport.js").then((m) => m.importPuzzleFromUrl("test/fixtures/tutorial.en.murdoku.json"))).clues
            .length
      );
      if (rows !== total) throw new Error(`expected a row per clue (${total}), got ${rows}`);
      const options = await panels.nth(1).locator(".unlock-row select").first().locator("option").allInnerTexts();
      if (options.join("|") !== "Always visible|After case 1: Alpha|After case 2: Beta")
        throw new Error(`unexpected choices: ${options.join("|")}`);
      // choose "After case 1" for the first clue
      await panels.nth(1).locator(".unlock-row select").first().selectOption({ label: "After case 1: Alpha" });
      const state = await page.evaluate(() => ({
        saves: window.__saves,
        unlocks: window.__finale.clueUnlocks,
        summary: document.querySelectorAll("#panel-host summary")[1].textContent,
      }));
      if (state.saves !== 1) throw new Error(`the campaign should be saved once, saved ${state.saves}`);
      if (Object.keys(state.unlocks || {}).length !== 1) throw new Error("the choice was not stored");
      if (state.summary !== "🔒 Hidden clues (1)") throw new Error(`the summary should count it: ${state.summary}`);
      // the stale rule is flagged and the clue shows as always visible
      await panels.nth(2).locator("summary").click();
      await panels.nth(2).locator(".unlock-row").first().waitFor();
      if ((await panels.nth(2).locator(".unlock-row .violation").count()) !== 1) throw new Error("the stale rule should be flagged");
      if ((await panels.nth(2).locator(".unlock-row select").first().inputValue()) !== "")
        throw new Error("a stale rule shows as always visible");
      // back to "always visible" removes the rule entirely
      await panels.nth(1).locator(".unlock-row select").first().selectOption({ label: "Always visible" });
      const cleared = await page.evaluate(() => ({
        has: "clueUnlocks" in window.__finale,
        summary: document.querySelectorAll("#panel-host summary")[1].textContent,
      }));
      if (cleared.has) throw new Error("an empty rule map must disappear (Firestore)");
      if (cleared.summary !== "🔒 Hidden clues") throw new Error(`the count should go away: ${cleared.summary}`);
    },
  },
  ...["it-IT", "en-US"].map((locale) => ({
    name: `medieval assets (${locale}): object names, floor names and clue phrases are in one language`,
    options: { url: `${base}/player.html`, ready: "header.topbar", locale },
    async run(page) {
      const got = await page.evaluate(async () => {
        const { OBJECT_TYPES, CHARACTER_ICONS } = await import("/src/model/icons.js");
        const { ZONE_TEXTURES } = await import("/src/model/textures.js");
        const { objectTypePhrase } = await import("/src/model/clues/shared.js");
        return {
          smith: CHARACTER_ICONS.blacksmith.label,
          jester: CHARACTER_ICONS.jester.label,
          anvil: OBJECT_TYPES.anvil.label,
          armor: OBJECT_TYPES.armor.label,
          crystal: OBJECT_TYPES.crystal_ball.label,
          floorDark: ZONE_TEXTURES.flagstone_dark.label,
          floorDamask: ZONE_TEXTURES.damask.label,
          phrases: ["anvil", "altar", "armor", "arrow_slit", "barrel", "throne", "banner"].map(objectTypePhrase),
          medieval: Object.values(OBJECT_TYPES)
            .filter((d) => d.group === "medieval")
            .map((d) => d.label),
        };
      });
      const italian = locale === "it-IT";
      const want = italian
        ? {
            smith: "Fabbro",
            jester: "Giullare/a",
            anvil: "Incudine",
            armor: "Armatura",
            crystal: "Sfera di cristallo",
            floorDark: "Lastre scure",
            floorDamask: "Damasco rosso",
            phrases: ["un'incudine", "un altare", "un'armatura", "una feritoia", "una botte", "un trono", "uno stendardo"],
          }
        : {
            smith: "Blacksmith",
            jester: "Jester",
            anvil: "Anvil",
            armor: "Suit of armor",
            crystal: "Crystal ball",
            floorDark: "Dark flagstones",
            floorDamask: "Red damask",
            phrases: ["an anvil", "an altar", "a suit of armor", "an arrow slit", "a barrel", "a throne", "a banner"],
          };
      for (const key of Object.keys(want)) {
        if (JSON.stringify(got[key]) !== JSON.stringify(want[key]))
          throw new Error(`${locale} ${key}: expected ${JSON.stringify(want[key])}, got ${JSON.stringify(got[key])}`);
      }
      // none of the 25 prop names may be left in Italian in the English UI
      const ITALIAN_LABELS = [
        "Letto",
        "Panca",
        "Trono",
        "Pelle d'orso",
        "Giaciglio",
        "Botte",
        "Forziere",
        "Camino",
        "Incudine",
        "Altare",
        "Statua",
        "Armatura",
        "Rastrelliera",
        "Calderone",
        "Pozzo",
        "Carro",
        "Sarcofago",
        "Leggio",
        "Stendardo",
        "Candelabro",
        "Gabbia",
        "Lapide",
        "Sfera di cristallo",
        "Saracinesca",
        "Feritoia",
      ];
      if (!italian) {
        const left = got.medieval.filter((label) => ITALIAN_LABELS.includes(label));
        if (left.length) throw new Error(`untranslated prop names: ${left.join(", ")}`);
      }
      if (got.medieval.length !== 25) throw new Error(`expected 25 medieval props, got ${got.medieval.length}`);
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
