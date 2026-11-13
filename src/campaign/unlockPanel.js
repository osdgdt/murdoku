// Campaign editor: the "hidden clues" panel of one case. For each clue of the
// case file the admin picks "always visible" or "after case N" (an earlier one);
// the player then sees a padlock until that case is solved (see
// campaignModel.js, applyClueLocks). Kept apart from campaignEditorApp.js (which
// needs Firebase) so a browser test can drive it on its own.
import { el, clear } from "../util/dom.js";
import { describeClue } from "../model/clueTypes.js";
import { setClueUnlock, clueUnlockOf } from "./campaignModel.js";
import { t } from "../i18n/i18n.js";

function hiddenSummaryText(caseEntry) {
  const n = Object.keys(caseEntry.clueUnlocks || {}).length;
  return n > 0 ? t("🔒 Indizi nascosti ({n})", { n }) : t("🔒 Indizi nascosti");
}

function clueRow({ campaign, caseEntry, index, clue, puzzle, summaryEl, onChange }) {
  const owner = clue.characterId ? puzzle.characters.find((ch) => ch.id === clue.characterId)?.name : t("Indizio generale");
  const select = el("select", { "aria-label": t("Quando si mostra: {indizio}", { indizio: describeClue(clue, puzzle) }) }, [
    el("option", { value: "" }, t("Sempre visibile")),
    ...campaign.cases
      .slice(0, index)
      .map((earlier, j) =>
        el("option", { value: earlier.id }, t("Dopo il caso {n}: {caso}", { n: j + 1, caso: earlier.label || earlier.puzzleId }))
      ),
  ]);
  const unlock = clueUnlockOf(campaign, caseEntry.id, clue.id);
  select.value = unlock?.valid ? unlock.byCaseId : "";
  select.addEventListener("change", () => {
    setClueUnlock(campaign, caseEntry.id, clue.id, select.value || null);
    summaryEl.textContent = hiddenSummaryText(caseEntry);
    onChange();
  });
  return el("div", { class: "unlock-row" }, [
    el("span", { class: "unlock-clue" }, [el("strong", {}, `${owner}: `), describeClue(clue, puzzle)]),
    select,
    unlock && !unlock.valid
      ? el("span", { class: "violation" }, t("⚠ Dipendeva da un caso che ora non viene prima: l'indizio viene mostrato sempre."))
      : null,
  ]);
}

// `loadPuzzle(caseEntry)` -> Promise of the case's puzzle; `onChange()` runs after every edit (save the campaign).
export function createUnlockPanel({ campaign, caseEntry, index, loadPuzzle, onChange }) {
  const summaryEl = el("summary", {}, hiddenSummaryText(caseEntry));
  const body = el("div", { class: "unlock-body" });
  const panel = el("details", { class: "unlock-panel" }, [summaryEl, body]);
  let started = false;
  panel.addEventListener("toggle", async () => {
    if (!panel.open || started) return;
    started = true;
    if (index === 0) {
      body.appendChild(el("p", { class: "muted" }, t("Il primo caso non ha casi precedenti: tutti i suoi indizi sono sempre visibili.")));
      return;
    }
    body.appendChild(el("p", { class: "muted" }, t("Caricamento…")));
    try {
      const puzzle = await loadPuzzle(caseEntry);
      clear(body);
      body.appendChild(
        el(
          "p",
          { class: "muted" },
          t(
            "Scegli quali indizi di questo caso restano nascosti finché il giocatore non risolve uno dei casi precedenti. La soluzione del caso resta quella completa: la verifica usa sempre tutti gli indizi."
          )
        )
      );
      for (const clue of puzzle.clues) body.appendChild(clueRow({ campaign, caseEntry, index, clue, puzzle, summaryEl, onChange }));
    } catch (err) {
      started = false;
      clear(body);
      body.appendChild(el("p", { class: "violation" }, t("Non riesco a caricare questo caso: {message}", { message: err.message })));
    }
  });
  return panel;
}
