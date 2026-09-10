import { el, qs, clear } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { onAuthChange, signIn, signOutUser } from "../auth/googleAuth.js";
import { importPuzzleFromUrl } from "../storage/importExport.js";
import { validateSolution } from "../solver/validator.js";
import { deriveSolutionAsync } from "../solver/solverClient.js";
import { createCampaign, addCase, removeCase, reorderCases, touch as touchCampaign } from "./campaignModel.js";
import * as campaignStore from "./campaignStore.js";

// Shown when a linked case's declared solution isn't already valid and a
// deeper search (deriveSolutionAsync) couldn't confirm a usable one either —
// a broken case in a campaign isn't one bad puzzle among many, it's a
// sequential gate (progressStore's unlockedCaseIndex) blocking every player
// who reaches it and every case after it, so this is worth flagging before
// it goes live rather than discovering it only when a real player hits it.
const SOLUTION_STATUS_WARNINGS = {
  unsatisfiable: "Questo caso non ha alcuna soluzione compatibile con i suoi indizi: i giocatori non potranno mai completarlo.",
  ambiguous: "Questo caso ammette più soluzioni diverse: non è chiaro quale sia quella corretta.",
  inconclusive: "Non riesco a stabilire con certezza se questo caso ha una soluzione univoca (troppo complesso da analizzare).",
};

wireThemeToggle();

// Matches the owner's Firebase Auth uid baked into firestore.rules — a
// non-owner signed in here sees "Accesso negato" and every write attempt is
// rejected server-side regardless, so this check is UX only, not the real
// security boundary.
const OWNER_UID = "say3jOf6WkaXDmjyn3kmAKNYbCh1";

const params = new URLSearchParams(location.search);
const campaignId = params.get("id");

const authBar = qs("#auth-bar");
const gateEl = qs("#gate");
const appEl = qs("#app");
const listViewEl = qs("#list-view");
const detailViewEl = qs("#detail-view");
const campaignListEl = qs("#campaign-list");
const newCampaignBtn = qs("#new-campaign-btn");
const titleInput = qs("#campaign-title");
const descriptionInput = qs("#campaign-description");
const detailStatus = qs("#detail-status");
const caseListEl = qs("#case-list");
const addCaseUrlInput = qs("#add-case-url");
const addCaseBtn = qs("#add-case-btn");
const addCaseStatus = qs("#add-case-status");

let currentUserState = null;
let campaign = null;

function renderAuthBar() {
  const themeBtn = authBar.querySelector("[data-theme-toggle]");
  clear(authBar);
  authBar.appendChild(themeBtn);
  if (currentUserState) {
    authBar.appendChild(el("span", { class: "muted" }, currentUserState.email));
    authBar.appendChild(el("button", { onClick: () => signOutUser() }, "Esci"));
  }
}

function renderGate() {
  clear(gateEl);
  if (!currentUserState) {
    gateEl.appendChild(el("h1", {}, "Editor campagne"));
    gateEl.appendChild(el("p", { class: "lede" }, "Riservato al proprietario del sito: accedi con Google per continuare."));
    gateEl.appendChild(
      el("button", { class: "primary", onClick: () => signIn().catch((err) => showGateError(err.message)) }, "Accedi con Google")
    );
    gateEl.classList.remove("hidden");
    appEl.classList.add("hidden");
    return;
  }
  if (currentUserState.uid !== OWNER_UID) {
    gateEl.appendChild(el("h1", {}, "Accesso negato"));
    gateEl.appendChild(el("p", { class: "lede" }, "Questo account non è autorizzato a gestire le campagne."));
    gateEl.classList.remove("hidden");
    appEl.classList.add("hidden");
    return;
  }
  gateEl.classList.add("hidden");
  appEl.classList.remove("hidden");
}

function showGateError(message) {
  gateEl.appendChild(el("p", { class: "violation" }, message));
}

async function loadListView() {
  listViewEl.classList.remove("hidden");
  detailViewEl.classList.add("hidden");
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
    campaignListEl.appendChild(el("p", { class: "muted" }, "Nessuna campagna ancora. Creane una."));
    return;
  }
  for (const c of campaigns.sort((a, b) => b.updatedAt - a.updatedAt)) {
    campaignListEl.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, c.title),
          el("span", { class: "meta" }, `${c.cases.length} ${c.cases.length === 1 ? "caso" : "casi"}`),
        ]),
        el("div", { class: "actions" }, [el("a", { href: `campaign-editor.html?id=${c.id}` }, "Modifica")]),
      ])
    );
  }
}

async function persistCampaign(statusEl) {
  touchCampaign(campaign);
  try {
    await campaignStore.saveCampaign(campaign);
    if (statusEl) { statusEl.textContent = "Salvato."; statusEl.className = "muted"; }
    return true;
  } catch (err) {
    if (statusEl) { statusEl.textContent = "Errore nel salvataggio: " + err.message; statusEl.className = "violation"; }
    return false;
  }
}

function renderCaseList() {
  clear(caseListEl);
  if (campaign.cases.length === 0) {
    caseListEl.appendChild(el("p", { class: "muted" }, "Nessun caso ancora."));
    return;
  }
  campaign.cases.forEach((c, i) => {
    caseListEl.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, `${i + 1}. ${c.label || c.puzzleId}`),
          el("span", { class: "meta" }, c.puzzleUrl),
        ]),
        el("div", { class: "actions" }, [
          el("button", { disabled: i === 0 || undefined, onClick: () => { reorderCases(campaign, i, i - 1); renderCaseList(); persistCampaign(detailStatus); } }, "↑"),
          el("button", { disabled: i === campaign.cases.length - 1 || undefined, onClick: () => { reorderCases(campaign, i, i + 1); renderCaseList(); persistCampaign(detailStatus); } }, "↓"),
          el("button", { class: "danger", onClick: () => { removeCase(campaign, c.id); renderCaseList(); persistCampaign(detailStatus); } }, "🗑"),
        ]),
      ])
    );
  });
}

async function loadDetailView(id) {
  listViewEl.classList.add("hidden");
  detailViewEl.classList.remove("hidden");
  detailStatus.textContent = "Caricamento…";
  detailStatus.className = "muted";
  try {
    campaign = await campaignStore.getCampaign(id);
  } catch (err) {
    detailStatus.textContent = "Impossibile caricare la campagna: " + err.message;
    detailStatus.className = "violation";
    return;
  }
  if (!campaign) {
    detailStatus.textContent = "Campagna non trovata.";
    detailStatus.className = "violation";
    return;
  }
  titleInput.value = campaign.title;
  descriptionInput.value = campaign.description || "";
  detailStatus.textContent = "";
  renderCaseList();
}

newCampaignBtn.addEventListener("click", async () => {
  newCampaignBtn.disabled = true;
  const created = createCampaign();
  try {
    await campaignStore.saveCampaign(created);
    location.href = `campaign-editor.html?id=${created.id}`;
  } catch (err) {
    alert("Impossibile creare la campagna: " + err.message);
  } finally {
    newCampaignBtn.disabled = false;
  }
});

titleInput.addEventListener("change", () => {
  campaign.title = titleInput.value;
  persistCampaign(detailStatus);
});
descriptionInput.addEventListener("change", () => {
  campaign.description = descriptionInput.value;
  persistCampaign(detailStatus);
});

addCaseBtn.addEventListener("click", async () => {
  const url = addCaseUrlInput.value.trim();
  if (!url) return;
  addCaseBtn.disabled = true;
  addCaseStatus.textContent = "Verifica del file…";
  addCaseStatus.className = "info-message";
  try {
    const puzzle = await importPuzzleFromUrl(url);

    addCaseStatus.textContent = "Controllo della soluzione…";
    addCaseStatus.className = "info-message";
    let solutionStatus = "unique";
    if (!validateSolution(puzzle).valid) {
      solutionStatus = (await deriveSolutionAsync(puzzle)).status;
    }
    if (solutionStatus !== "unique") {
      const ok = confirm(`${SOLUTION_STATUS_WARNINGS[solutionStatus]} Aggiungerlo comunque alla campagna?`);
      if (!ok) {
        addCaseStatus.textContent = "";
        return;
      }
    }

    addCase(campaign, { puzzleId: puzzle.id, puzzleUrl: url, label: puzzle.title });
    const saved = await persistCampaign(null);
    renderCaseList();
    if (saved) {
      addCaseUrlInput.value = "";
      addCaseStatus.textContent = "Caso aggiunto.";
      addCaseStatus.className = "ok-message";
    } else {
      addCaseStatus.textContent = "Caso aggiunto localmente ma il salvataggio è fallito. Riprova.";
      addCaseStatus.className = "violation";
    }
  } catch (err) {
    addCaseStatus.textContent = "Errore: " + err.message;
    addCaseStatus.className = "violation";
  } finally {
    addCaseBtn.disabled = false;
  }
});

onAuthChange((user) => {
  currentUserState = user;
  renderAuthBar();
  renderGate();
  if (user && user.uid === OWNER_UID) {
    if (campaignId) loadDetailView(campaignId);
    else loadListView();
  }
});
