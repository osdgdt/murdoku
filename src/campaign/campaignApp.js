import { el, clear, qs } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { onAuthChange, signIn, signOutUser } from "../auth/googleAuth.js";
import { importPuzzleFromUrl } from "../storage/importExport.js";
import { createBoardState, serializeBoardState, deserializeBoardState } from "../player/board.js";
import { createGameScreen } from "../player/gameScreen.js";
import * as campaignStore from "./campaignStore.js";
import * as progressStore from "./progressStore.js";
import { formatElapsed } from "../util/time.js";
import * as recentActivity from "../storage/recentActivityStore.js";

wireThemeToggle();

// Read once at startup, before the auth gate even resolves — a deep link to
// a specific case (player.html?import= style sharing, but for a campaign
// case) works pre-login: whoever opens it sees the sign-in gate first, then
// lands directly on this exact case once signed in, no extra state needed
// since these are still sitting in the URL when onAuthChange fires.
const params = new URLSearchParams(location.search);
const campaignIdParam = params.get("campaign");
const caseIdParam = params.get("case");

const gateEl = qs("#gate");
const authBar = qs("#auth-bar");
const headerTitleEl = qs("#campaign-header-title");
const timerEl = qs("#timer");
const campaignListViewEl = qs("#campaign-list-view");
const campaignListEl = qs("#campaign-list");
const caseListViewEl = qs("#case-list-view");
const caseListTitleEl = qs("#case-list-title");
const caseListDescriptionEl = qs("#case-list-description");
const caseListEl = qs("#case-list");
const gameEl = qs("#game");
const backToCasesLink = qs("#back-to-cases-link");
const caseErrorPanel = qs("#case-error-panel");
const gameContentEl = qs("#game-content");

let currentUserState = null;
let campaign = null;
let progress = null;
let currentCase = null;
let currentCaseIndex = -1;
let puzzle = null;
let state = createBoardState();

// Groups board-state saves a few seconds apart instead of on every single
// placement/note (reduces Firestore writes against the shared daily quota).
// `flush()` forces any pending save through immediately — wired to
// visibilitychange/pagehide below so leaving the tab doesn't silently drop
// the last few seconds of play. Best-effort only: a browser can still kill
// the page before an in-flight async write finishes, same tradeoff any
// client-side autosave makes without a beacon-based sync API.
function createDebouncedSaver(fn, delayMs) {
  let timer = null;
  let pendingArgs = null;
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      fn(...args);
    }
  }
  function schedule(...args) {
    pendingArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }
  return { schedule, flush };
}

const boardSaver = createDebouncedSaver((uid, campaignId, caseId, snapshot) => {
  progressStore.saveCaseBoardState(uid, campaignId, caseId, snapshot).catch((err) => {
    console.error("Impossibile salvare il progresso della campagna:", err);
  });
}, 3000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") boardSaver.flush();
});
window.addEventListener("pagehide", () => boardSaver.flush());

function persistProgress() {
  if (!currentUserState || !campaign || !currentCase) return;
  boardSaver.schedule(currentUserState.uid, campaign.id, currentCase.id, serializeBoardState(state));
}

function showView(name) {
  gateEl.classList.toggle("hidden", name !== "gate");
  campaignListViewEl.classList.toggle("hidden", name !== "campaign-list");
  caseListViewEl.classList.toggle("hidden", name !== "case-list");
  gameEl.classList.toggle("hidden", name !== "game");
  timerEl.classList.toggle("hidden", name !== "game");
}

function renderAuthBar() {
  clear(authBar);
  if (currentUserState) {
    authBar.appendChild(el("span", { class: "muted" }, currentUserState.email));
    authBar.appendChild(el("button", { onClick: () => signOutUser() }, "Esci"));
  }
}

function renderGate() {
  clear(gateEl);
  if (currentUserState) return;
  gateEl.appendChild(el("h1", {}, "Modalità campagna"));
  gateEl.appendChild(el("p", { class: "lede" }, "Accedi con Google per giocare le campagne a episodi e ritrovare i tuoi progressi su qualunque dispositivo."));
  gateEl.appendChild(
    el("button", { class: "primary", onClick: () => signIn().catch((err) => showGateError(err.message)) }, "Accedi con Google")
  );
}

function showGateError(message) {
  gateEl.appendChild(el("p", { class: "violation" }, message));
}

async function showCampaignListView() {
  headerTitleEl.textContent = "Modalità campagna";
  showView("campaign-list");
  clear(campaignListEl);
  campaignListEl.appendChild(el("p", { class: "muted" }, "Caricamento…"));
  let campaigns;
  try {
    campaigns = await campaignStore.listCampaigns();
  } catch (err) {
    clear(campaignListEl);
    campaignListEl.appendChild(el("p", { class: "violation" }, "Impossibile caricare le campagne: " + err.message));
    return;
  }
  clear(campaignListEl);
  if (campaigns.length === 0) {
    campaignListEl.appendChild(el("p", { class: "muted" }, "Nessuna campagna disponibile ancora."));
    return;
  }
  for (const c of campaigns) {
    campaignListEl.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, c.title),
          c.description ? el("span", { class: "meta" }, c.description) : null,
          el("span", { class: "meta" }, `${c.cases.length} ${c.cases.length === 1 ? "caso" : "casi"}`),
        ]),
        el("div", { class: "actions" }, [el("a", { class: "play", href: `campaign.html?campaign=${c.id}` }, "Gioca")]),
      ])
    );
  }
}

function caseStatusBadge(index, caseEntry, progressData) {
  if (progressData.completedCaseIds.includes(caseEntry.id)) return el("span", { class: "completed-badge", title: "Completato" }, "✓");
  if (index > progressData.unlockedCaseIndex) return el("span", { class: "muted" }, "🔒");
  return null;
}

async function showCaseListView(campaignId) {
  showView("case-list");
  clear(caseListEl);
  caseListTitleEl.textContent = "";
  caseListDescriptionEl.textContent = "";
  caseListEl.appendChild(el("p", { class: "muted" }, "Caricamento…"));
  let loadedCampaign, loadedProgress;
  try {
    loadedCampaign = await campaignStore.getCampaign(campaignId);
    if (!loadedCampaign) throw new Error("campagna non trovata.");
    loadedProgress = await progressStore.getCampaignProgress(currentUserState.uid, campaignId);
  } catch (err) {
    clear(caseListEl);
    caseListEl.appendChild(el("p", { class: "violation" }, "Impossibile caricare la campagna: " + err.message));
    return;
  }
  campaign = loadedCampaign;
  progress = loadedProgress;
  headerTitleEl.textContent = campaign.title;
  caseListTitleEl.textContent = campaign.title;
  caseListDescriptionEl.textContent = campaign.description || "";

  clear(caseListEl);
  if (campaign.cases.length === 0) {
    caseListEl.appendChild(el("p", { class: "muted" }, "Questa campagna non ha ancora nessun caso."));
    return;
  }
  campaign.cases.forEach((c, index) => {
    const unlocked = index <= progress.unlockedCaseIndex;
    const bestTime = progress.cases[c.id]?.bestTimeSeconds;
    caseListEl.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, [
            caseStatusBadge(index, c, progress),
            ` ${index + 1}. ${c.label || c.puzzleId}`,
            typeof bestTime === "number" ? el("span", { class: "best-time-badge", title: "Miglior tempo" }, `⏱ ${formatElapsed(bestTime)}`) : null,
          ]),
        ]),
        el("div", { class: "actions" }, [
          unlocked
            ? el("a", { class: "play", href: `campaign.html?campaign=${campaign.id}&case=${c.id}` }, "Gioca")
            : el("span", { class: "muted" }, "Da sbloccare"),
        ]),
      ])
    );
  });
}

async function showGameView(campaignId, caseId) {
  showView("game");
  gameContentEl.classList.add("hidden");
  clear(caseErrorPanel);
  caseErrorPanel.appendChild(el("p", { class: "muted" }, "Caricamento…"));
  backToCasesLink.href = `campaign.html?campaign=${campaignId}`;

  let loadedCampaign, loadedProgress;
  try {
    loadedCampaign = await campaignStore.getCampaign(campaignId);
    if (!loadedCampaign) throw new Error("campagna non trovata.");
    loadedProgress = await progressStore.getCampaignProgress(currentUserState.uid, campaignId);
  } catch (err) {
    clear(caseErrorPanel);
    caseErrorPanel.appendChild(el("p", { class: "violation" }, "Impossibile caricare la campagna: " + err.message));
    return;
  }
  campaign = loadedCampaign;
  progress = loadedProgress;
  headerTitleEl.textContent = campaign.title;

  const index = campaign.cases.findIndex((c) => c.id === caseId);
  if (index === -1) {
    clear(caseErrorPanel);
    caseErrorPanel.appendChild(el("p", { class: "violation" }, "Questo caso non fa parte della campagna."));
    return;
  }
  if (index > progress.unlockedCaseIndex) {
    clear(caseErrorPanel);
    caseErrorPanel.appendChild(el("p", { class: "violation" }, "Questo caso è ancora bloccato: completa i casi precedenti per sbloccarlo."));
    return;
  }
  currentCase = campaign.cases[index];
  currentCaseIndex = index;

  // Fetch + validate the case's own .murdoku.json — same defensive pattern
  // as player.html's `?import=` flow. A broken/unreachable file only takes
  // this one case offline (clear error, link back); the rest of the
  // campaign's cases are unaffected.
  let fetchedPuzzle;
  try {
    fetchedPuzzle = await importPuzzleFromUrl(currentCase.puzzleUrl);
  } catch (err) {
    clear(caseErrorPanel);
    caseErrorPanel.appendChild(el("p", { class: "violation" }, `Non riesco a caricare questo caso: ${err.message}`));
    return;
  }

  clear(caseErrorPanel);
  puzzle = fetchedPuzzle;
  recentActivity.recordOpened({
    kind: "campaign",
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    caseId: currentCase.id,
    caseLabel: currentCase.label || currentCase.puzzleId,
    title: `${campaign.title} — ${currentCase.label || currentCase.puzzleId}`,
    url: `campaign.html?campaign=${campaign.id}&case=${currentCase.id}`,
  });
  state = deserializeBoardState(progressStore.boardStateFromProgress(progress, currentCase.id));
  gameContentEl.classList.remove("hidden");

  const screen = createGameScreen({
    puzzle,
    state,
    persistProgress,
    onSolved: async (elapsedSeconds) => {
      boardSaver.flush();
      try {
        await progressStore.markCaseCompleted(currentUserState.uid, campaign.id, currentCase.id, currentCaseIndex, elapsedSeconds);
      } catch (err) {
        console.error("Impossibile registrare il completamento del caso:", err);
      }
    },
  });
  screen.start();
}

onAuthChange((user) => {
  currentUserState = user;
  renderAuthBar();
  renderGate();
  if (!user) {
    showView("gate");
    return;
  }
  if (caseIdParam && campaignIdParam) {
    showGameView(campaignIdParam, caseIdParam);
  } else if (campaignIdParam) {
    showCaseListView(campaignIdParam);
  } else {
    showCampaignListView();
  }
});
