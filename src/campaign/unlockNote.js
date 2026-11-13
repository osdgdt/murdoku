// Under the "case solved" panel of a campaign case: which later cases just
// received a clue from this one. Kept apart from campaignApp.js (which needs
// Firebase) so a browser test can draw it on its own.
import { el } from "../util/dom.js";
import { unlocksProvidedBy } from "./campaignModel.js";
import { t } from "../i18n/i18n.js";

export function renderUnlockNote(campaign, caseId) {
  const unlocks = unlocksProvidedBy(campaign, caseId);
  if (unlocks.length === 0) return null;
  const parts = unlocks.map(({ caseEntry, count }) => {
    const label = caseEntry.label || caseEntry.puzzleId;
    return count === 1 ? t("1 indizio nel caso «{caso}»", { caso: label }) : t("{n} indizi nel caso «{caso}»", { n: count, caso: label });
  });
  return el("div", { class: "unlock-note" }, t("🔓 Hai scoperto nuovi indizi: {elenco}.", { elenco: parts.join(", ") }));
}
