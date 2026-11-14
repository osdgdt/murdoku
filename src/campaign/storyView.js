// What the player reads of a story campaign: the introduction of a case, its
// epilogue, and the final choice. Kept apart from campaignApp.js (which needs
// Firebase) so a browser test can draw it on its own.
//
// The texts are the campaign author's own: they are always put in the page as
// text (`el` creates text nodes), never as HTML, and never go through `t()`.
import { el, clear } from "../util/dom.js";
import { caseStoryOf, finaleOf, splitParagraphs } from "./campaignModel.js";
import { t } from "../i18n/i18n.js";

export function renderStoryText(text) {
  return el(
    "div",
    { class: "story-text" },
    splitParagraphs(text).map((paragraph) => el("p", {}, paragraph))
  );
}

// A card with a title, the text and one button (to start the case, or to close the card).
export function renderIntroCard({ title, text, actionLabel, onAction }) {
  return el("section", { class: "story-card", "aria-label": t("Introduzione del caso") }, [
    el("h3", {}, title),
    renderStoryText(text),
    el("button", { type: "button", class: "primary", onClick: onAction }, actionLabel),
  ]);
}

// The epilogue of a solved case, or null when it has none.
export function renderOutro(caseEntry) {
  const { outro } = caseStoryOf(caseEntry);
  if (!outro) return null;
  return el("section", { class: "story-outro" }, [el("h3", {}, t("📜 Epilogo")), renderStoryText(outro)]);
}

// The final choice: one button per ending; choosing one shows its text. `chosen`
// (0 or 1) is the ending already picked on an earlier visit, shown straight away.
// `onChoose(index)` runs only for a choice made now.
export function renderFinale({ campaign, chosen = null, onChoose }) {
  const finale = finaleOf(campaign);
  const epilogue = el("div", { class: "finale-epilogue", "aria-live": "polite" });
  const buttons = finale.endings.map((ending, index) =>
    el("button", { type: "button", class: "finale-choice", "aria-pressed": "false", onClick: () => choose(index, true) }, ending.label)
  );
  function choose(index, notify) {
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    clear(epilogue);
    epilogue.appendChild(renderStoryText(finale.endings[index].text));
    if (notify && onChoose) onChoose(index);
  }
  const root = el("section", { class: "finale" }, [
    el("p", { class: "finale-prompt" }, finale.prompt || t("Come finisce la storia?")),
    el("div", { class: "finale-choices" }, buttons),
    epilogue,
  ]);
  if (chosen === 0 || chosen === 1) choose(chosen, false);
  return root;
}
