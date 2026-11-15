// `npm run e2e:daily`: the daily challenge page, with a stand-in for Firebase (test/e2e/lib/fakeFirebase.mjs):
// the gate, the empty library, choosing a nickname, a game with no hints, sending the result, the board, and
// "one scored game a day". The Firestore RULES are not exercised here (see test/rules).
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
const puzzle = JSON.parse(await readFile(path.join(root, "test/fixtures/faro.en.murdoku.json"), "utf8"));

// a library with one case (the fixture), so there is a case of the day
const LIBRARY = {
  version: 1,
  cases: [
    {
      id: "faro",
      order: 1,
      title: { it: "Il faro", en: "The lighthouse" },
      difficulty: "easy",
      size: [5, 5],
      characters: 5,
      puzzleId: { it: "lib_faro_it", en: "lib_faro_en" },
      files: { it: "test/fixtures/faro.en.murdoku.json", en: "test/fixtures/faro.en.murdoku.json" },
    },
  ],
};

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installFakeFirebase(page);

  // --- the empty library (as shipped)
  await page.goto(`${base}/daily.html`);
  await page.waitForSelector("#gate button.primary");
  check("daily: signed out, the page asks to sign in", /Sfida del giorno/.test(await page.innerText("#gate")));
  check(
    "daily: nothing else is shown while signed out",
    (await page.locator("#game:not(.hidden)").count()) === 0 && (await page.locator("#leaderboard:not(.hidden)").count()) === 0
  );
  await page.click("#gate button.primary");
  await page.waitForFunction(() => /Nessuna sfida oggi/.test(document.querySelector("#daily-info")?.innerText || ""));
  check("daily: with an empty library it says there is no challenge today", true);

  // --- a library with a case
  await page.route("**/examples/library.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(LIBRARY) })
  );
  await page.reload();
  await page.waitForSelector('[data-key="nickname"]');
  check("daily: first time, the nickname is asked before anything else", (await page.locator('[data-key="daily-start"]').count()) === 0);
  await page.fill('[data-key="nickname"]', "<b>");
  await page.click('[data-key="nickname-go"]');
  check("daily: a bad nickname is refused with a reason", /Sono ammessi|almeno/.test(await page.innerText("#nickname-panel")));
  await page.fill('[data-key="nickname"]', "Poirot");
  await page.click('[data-key="nickname-go"]');
  await page.waitForSelector('[data-key="daily-start"]');
  check(
    "daily: with a nickname, the rules and the start button are shown",
    /Niente suggerimenti/.test(await page.innerText("#daily-info"))
  );
  check("daily: nothing has started yet (no game, no timer)", (await page.locator("#game:not(.hidden)").count()) === 0);

  await page.click('[data-key="daily-start"]');
  await page.waitForSelector("#board [role=gridcell]");
  check("daily: no hints in the challenge", await page.locator("#hint-btn").isDisabled());
  await page.keyboard.press("h");
  check("daily: the H key gives no hint either", (await page.locator("#hint-panel *").count()) === 0);

  // solve it: place every character on its cell (press and hold)
  const cell = (r, c) => page.locator(`[data-row="${r}"][data-col="${c}"]`).first();
  for (let i = 0; i < puzzle.characters.length; i++) {
    const p = puzzle.solution.placements.find((q) => q.characterId === puzzle.characters[i].id);
    await page.locator(".char-chip").nth(i).click();
    const box = await cell(p.row, p.col).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.up();
  }
  await page.click("#submit-btn");
  await page.waitForSelector(".win-panel", { timeout: 60000 });
  await page.waitForFunction(
    () => /Risultato inviato alla classifica/.test(document.querySelector("#result-panel")?.innerText || ""),
    null,
    { timeout: 15000 }
  );
  check("daily: solving sends the result and says where the player stands", /Sei 1° su 1/.test(await page.innerText("#result-panel")));
  await page.waitForSelector("#leaderboard table.daily-board tr.mine", { timeout: 10000 }).catch(() => {});

  // --- come back: one scored game a day
  await page.reload();
  await page.waitForFunction(() => /Sfida di oggi completata/.test(document.querySelector("#daily-info")?.innerText || ""), null, {
    timeout: 15000,
  });
  check("daily: coming back, the game is over for today and shows the time", /Il tuo tempo/.test(await page.innerText("#daily-info")));
  check(
    "daily: no second scored game (no start button, no board of play)",
    (await page.locator('[data-key="daily-start"]').count()) === 0 && (await page.locator("#game:not(.hidden)").count()) === 0
  );
  await page.waitForSelector("#leaderboard table.daily-board");
  const row = await page.innerText("#leaderboard table.daily-board tr.mine");
  check(
    "daily: the board lists the player by nickname, not by email",
    /Poirot/.test(row) && !/@/.test(await page.innerText("#leaderboard")),
    row
  );
  await page.click('#leaderboard [role="tab"]:has-text("Ieri")');
  await page.waitForFunction(() => /Nessuno ha ancora giocato/.test(document.querySelector("#leaderboard")?.innerText || ""));
  check("daily: yesterday's board is separate and empty", true);

  // --- another player sees the first one and can take another nickname, but not the same
  await page.evaluate(() => {
    localStorage.setItem("__fake_uid", "uid-other");
    localStorage.removeItem("__fake_user");
  });
  await page.reload();
  await page.waitForSelector("#gate button.primary");
  await page.click("#gate button.primary");
  await page.waitForSelector('[data-key="nickname"]');
  await page.fill('[data-key="nickname"]', "POIROT");
  await page.click('[data-key="nickname-go"]');
  await page.waitForFunction(() => /già preso/.test(document.querySelector("#nickname-panel")?.innerText || ""));
  check("daily: a nickname that differs only by case is taken", true);
  check("daily: no page errors", errors.length === 0, errors.join("; "));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} controlli falliti`);
  process.exit(1);
}
