import { el, clear, qs, attachHoldToConfirm } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { onAuthChange, signIn, signOutUser } from "../auth/googleAuth.js";
import { characterIcon } from "../model/icons.js";
import { zoneOfCell } from "../model/grid.js";
import { validatePuzzleShape, characterColor } from "../model/puzzle.js";
import { describeClue } from "../model/clueTypes.js";
import { createBoardState, handleCellClick, handleCellDrag, undo, clearAll, renderPlayerBoard, serializeBoardState, deserializeBoardState } from "../player/board.js";
import { renderClueCards } from "../player/clueCards.js";
import { computeHintChain } from "../solver/hints.js";
import * as campaignStore from "./campaignStore.js";
import * as progressStore from "./progressStore.js";

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
const toolbarEl = qs("#player-toolbar");
const boardEl = qs("#board");
const cluesEl = qs("#clues-panel");
const briefingEl = qs("#briefing-panel");
const resultEl = qs("#result-panel");
const notesBtn = qs("#notes-btn");
const notesHint = qs("#notes-hint");
const undoBtn = qs("#undo-btn");
const clearBtn = qs("#clear-btn");
const hintBtn = qs("#hint-btn");
const hintPanel = qs("#hint-panel");
const submitBtn = qs("#submit-btn");

let currentUserState = null;
let campaign = null;
let progress = null;
let currentCase = null;
let currentCaseIndex = -1;
let puzzle = null;
let state = createBoardState();
let hintHighlight = null;
let hintChain = [];
let hintChainIndex = 0;
let timerInterval = null;

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
    caseListEl.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, [caseStatusBadge(index, c, progress), ` ${index + 1}. ${c.label || c.puzzleId}`]),
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

// --- Gameplay (mirrors src/player/playerApp.js's game screen; kept as a
// deliberately separate, duplicated orchestration rather than sharing code
// with playerApp.js, so the localStorage-backed single-puzzle flow there
// stays byte-for-byte untouched by anything campaign-related.) ---

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer() {
  const startedAt = Date.now();
  timerEl.textContent = "⏱ 0:00";
  timerInterval = setInterval(() => {
    timerEl.textContent = `⏱ ${formatElapsed(Math.floor((Date.now() - startedAt) / 1000))}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function selectTool(tool) {
  state.selectedTool = tool;
  renderToolbar();
  renderBoardAndClues();
}

function renderToolbar() {
  clear(toolbarEl);
  for (const character of puzzle.characters) {
    const placed = state.placements.has(character.id);
    const chip = el("div", {
      class: "char-chip" + (state.selectedTool?.kind === "character" && state.selectedTool.id === character.id ? " selected" : "") + (placed ? " used" : ""),
      onClick: () => selectTool({ kind: "character", id: character.id }),
    });
    const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
    chip.appendChild(iconWrap);
    if (!character.isVictim) chip.style.borderLeft = `3px solid ${characterColor(character)}`;
    chip.appendChild(document.createTextNode(character.name + (character.isVictim ? " (V)" : "")));
    toolbarEl.appendChild(chip);
  }
  toolbarEl.appendChild(el("div", { class: "char-chip" + (state.selectedTool?.kind === "x" ? " selected" : ""), onClick: () => selectTool({ kind: "x" }) }, "✕ Segna"));
  toolbarEl.appendChild(el("div", { class: "char-chip" + (state.selectedTool?.kind === "erase" ? " selected" : ""), onClick: () => selectTool({ kind: "erase" }) }, "🧹 Gomma"));
}

function updateNotesUI() {
  notesBtn.classList.toggle("primary", state.notesMode);
  notesHint.textContent = state.notesMode
    ? "Modalità note attiva: seleziona un personaggio e clicca una cella per segnarlo come candidato in quella casella (notazione a griglia 3x3, come le matite del sudoku)."
    : "Modalità piazzamento: seleziona un personaggio e clicca una cella per confermarlo.";
}

function applyHintHighlight() {
  boardEl.classList.toggle("hint-active", !!hintHighlight);
  if (!hintHighlight) return;
  for (const { row, col, cls } of hintHighlight.cells) {
    const node = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (node) node.classList.add(cls);
  }
}

function clearHint() {
  hintHighlight = null;
  hintChain = [];
  hintChainIndex = 0;
  clear(hintPanel);
}

function renderBoardAndClues() {
  renderPlayerBoard(
    boardEl, puzzle, state,
    (row, col) => {
      clearHint();
      handleCellClick(state, puzzle.grid, row, col);
      persistProgress();
      renderToolbar();
      renderBoardAndClues();
    },
    (row, col) => {
      handleCellDrag(state, puzzle.grid, row, col);
      persistProgress();
      renderBoardAndClues();
    }
  );
  applyHintHighlight();
  renderClueCards(cluesEl, puzzle, state);
}

function murdererName() {
  const victim = puzzle.characters.find((c) => c.isVictim);
  if (!victim) return null;
  const vPlacement = puzzle.solution.placements.find((p) => p.characterId === victim.id);
  if (!vPlacement) return null;
  const vZone = zoneOfCell(puzzle.grid, vPlacement.row, vPlacement.col);
  if (vZone === null) return null;
  const sameZoneChars = puzzle.solution.placements.filter((p) => p.characterId !== victim.id && zoneOfCell(puzzle.grid, p.row, p.col) === vZone);
  if (sameZoneChars.length !== 1) return null;
  const murderer = puzzle.characters.find((c) => c.id === sameZoneChars[0].characterId);
  return murderer ? murderer.name : null;
}

function renderHintExplanation(result) {
  if (result.type === "contradiction" && result.cause === "clue") {
    return el("div", { class: "hint-explain" }, [
      el("div", { class: "hint-explain-label" }, "Indizio in conflitto:"),
      el("ul", { class: "hint-clue-list" }, result.clueIds.map((id) => {
        const clue = puzzle.clues.find((c) => c.id === id);
        if (!clue) return null;
        const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
        return el("li", {}, (owner ? owner.name + ": " : "") + describeClue(clue, puzzle));
      })),
    ]);
  }
  if (result.type !== "forcedPlacement" && result.type !== "eliminatedCell") return null;
  if (result.jointlyDetermined) {
    return el("div", { class: "hint-explain" }, el("p", { class: "hint-explain-note" }, "Questa deduzione dipende dalla combinazione di più indizi insieme."));
  }
  const blocks = [];
  if (result.involvedClues?.length) {
    blocks.push(el("div", { class: "hint-explain-label" }, "Perché:"));
    blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedClues.map((c) => el("li", {}, (c.ownerName ? c.ownerName + ": " : "") + c.description))));
  }
  if (result.involvedGroups?.length) {
    blocks.push(el("div", { class: "hint-explain-label" }, "Interazione tra personaggi:"));
    blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedGroups.map((g) =>
      el("li", {}, `${g.characterNames.join(" e ")} possono stare solo in ${g.cellLabels.join(" o ")}: nessun altro personaggio può occupare quelle celle.`)
    )));
  }
  if (blocks.length === 0) return null;
  return el("div", { class: "hint-explain" }, blocks);
}

function showHintStep() {
  const result = hintChain[hintChainIndex];
  hintHighlight = null;

  if (result.type === "forcedPlacement") {
    hintHighlight = { cells: [{ row: result.row, col: result.col, cls: "hint-target" }] };
    state.selectedTool = { kind: "character", id: result.characterId };
  } else if (result.type === "eliminatedCell") {
    hintHighlight = { cells: [{ row: result.row, col: result.col, cls: "hint-info" }] };
  } else if (result.type === "contradiction" && result.culprits.length > 0) {
    hintHighlight = {
      cells: result.culprits.map((id) => state.placements.get(id)).filter(Boolean).map((pos) => ({ row: pos.row, col: pos.col, cls: "hint-culprit" })),
    };
    if (result.culprits.length === 1) state.selectedTool = { kind: "erase" };
  }

  clear(hintPanel);
  hintPanel.appendChild(el("div", { class: `result-banner hint-${result.variant}` }, result.message));
  const explanation = renderHintExplanation(result);
  if (explanation) hintPanel.appendChild(explanation);
  if (hintChain.length > 1) {
    hintPanel.appendChild(
      el("div", { class: "hint-nav" }, [
        el("button", { onClick: () => { hintChainIndex--; showHintStep(); }, disabled: hintChainIndex === 0 || undefined }, "‹"),
        el("span", {}, `Passo ${hintChainIndex + 1} di ${hintChain.length}`),
        el("button", { onClick: () => { hintChainIndex++; showHintStep(); }, disabled: hintChainIndex === hintChain.length - 1 || undefined }, "›"),
      ])
    );
  }
  renderToolbar();
  renderBoardAndClues();
}

function onHint() {
  hintChain = computeHintChain(puzzle, state.placements, state.candidates);
  hintChainIndex = 0;
  showHintStep();
}

async function onSubmit() {
  clear(resultEl);
  const total = puzzle.characters.length;
  let correct = 0;
  for (const p of puzzle.solution.placements) {
    const placed = state.placements.get(p.characterId);
    if (placed && placed.row === p.row && placed.col === p.col) correct++;
  }

  if (correct === total && state.placements.size === total) {
    stopTimer();
    boardSaver.flush();
    try {
      await progressStore.markCaseCompleted(currentUserState.uid, campaign.id, currentCase.id, currentCaseIndex);
    } catch (err) {
      console.error("Impossibile registrare il completamento del caso:", err);
    }
    const murderer = murdererName();
    resultEl.appendChild(
      el("div", { class: "win-panel result-banner success" }, [
        el("div", {}, "🎉 Caso risolto! Tutti i piazzamenti sono corretti."),
        murderer ? el("div", {}, `L'assassino è: ${murderer}`) : null,
        puzzle.resolutionNote ? el("p", { class: "resolution-note" }, puzzle.resolutionNote) : null,
      ])
    );
  } else {
    resultEl.appendChild(el("div", { class: "result-banner partial" }, "Non è ancora tutto corretto. Continua a dedurre dagli indizi."));
  }
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
    const res = await fetch(currentCase.puzzleUrl);
    if (!res.ok) throw new Error(`impossibile scaricare il file (${res.status}).`);
    fetchedPuzzle = await res.json();
    const { valid, errors } = validatePuzzleShape(fetchedPuzzle);
    if (!valid) throw new Error("file puzzle non valido: " + errors.join("; "));
  } catch (err) {
    clear(caseErrorPanel);
    caseErrorPanel.appendChild(el("p", { class: "violation" }, `Non riesco a caricare questo caso: ${err.message}`));
    return;
  }

  clear(caseErrorPanel);
  puzzle = fetchedPuzzle;
  state = deserializeBoardState(progressStore.boardStateFromProgress(progress, currentCase.id));
  gameContentEl.classList.remove("hidden");

  renderToolbar();
  renderBoardAndClues();
  updateNotesUI();
  startTimer();
  clear(briefingEl);
  briefingEl.classList.toggle("hidden", !puzzle.briefing);
  if (puzzle.briefing) {
    briefingEl.appendChild(el("h3", {}, "Il caso"));
    briefingEl.appendChild(el("p", {}, puzzle.briefing));
  }
  clear(resultEl);
  wireGameControlsOnce();
}

// Wired only once a puzzle has actually loaded (mirrors playerApp.js's
// `if (!puzzle) {...} else { ...wire listeners... }` guard) rather than
// unconditionally at module load — `#game`'s controls are hidden until then,
// but this avoids any listener ever touching a still-null `puzzle`/`state`.
let gameControlsWired = false;
function wireGameControlsOnce() {
  if (gameControlsWired) return;
  gameControlsWired = true;
  notesBtn.addEventListener("click", () => {
    state.notesMode = !state.notesMode;
    persistProgress();
    updateNotesUI();
  });
  undoBtn.addEventListener("click", () => {
    clearHint();
    undo(state);
    persistProgress();
    renderToolbar();
    renderBoardAndClues();
  });
  attachHoldToConfirm(clearBtn, 700, () => {
    clearHint();
    clearAll(state);
    persistProgress();
    renderToolbar();
    renderBoardAndClues();
    clear(resultEl);
  });
  hintBtn.addEventListener("click", onHint);
  submitBtn.addEventListener("click", onSubmit);
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
