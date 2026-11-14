// Campaign editor: the story texts. `createStoryPanel` is the per-case panel
// (introduction + epilogue); `createFinalePanel` is the campaign's final choice
// (a question and two endings). Kept apart from campaignEditorApp.js (which
// needs Firebase) so a browser test can drive them on their own.
import { el } from "../util/dom.js";
import { caseStoryOf, setCaseStory, setFinale, STORY_TEXT_MAX, STORY_LABEL_MAX, FINALE_PROMPT_MAX } from "./campaignModel.js";
import { t } from "../i18n/i18n.js";

const storySummary = (caseEntry) => {
  const { intro, outro } = caseStoryOf(caseEntry);
  return intro || outro ? t("📖 Storia del caso ✓") : t("📖 Storia del caso");
};

function field(label, control) {
  return el("label", { class: "story-field" }, [el("span", {}, label), control]);
}

function textArea(label, value, rows, max) {
  const area = el("textarea", { rows, maxlength: max, "aria-label": label });
  area.value = value;
  return area;
}

// `onChange()` runs after every edit (save the campaign).
export function createStoryPanel({ campaign, caseEntry, onChange }) {
  const { intro, outro } = caseStoryOf(caseEntry);
  const summaryEl = el("summary", {}, storySummary(caseEntry));
  const introArea = textArea(t("Introduzione del caso"), intro, 4, STORY_TEXT_MAX);
  const outroArea = textArea(t("Epilogo del caso"), outro, 4, STORY_TEXT_MAX);
  const save = () => {
    setCaseStory(campaign, caseEntry.id, { intro: introArea.value, outro: outroArea.value });
    summaryEl.textContent = storySummary(caseEntry);
    onChange();
  };
  introArea.addEventListener("change", save);
  outroArea.addEventListener("change", save);
  return el("details", { class: "story-panel" }, [
    summaryEl,
    el("div", { class: "story-body" }, [
      el(
        "p",
        { class: "muted" },
        t(
          "Testi della storia: l'introduzione si legge prima di cominciare il caso, l'epilogo compare quando lo si risolve. Una riga vuota separa i paragrafi."
        )
      ),
      field(t("Introduzione (prima del caso)"), introArea),
      field(t("Epilogo (dopo il caso)"), outroArea),
    ]),
  ]);
}

export function createFinalePanel({ campaign, onChange }) {
  const finale = campaign.finale || {};
  const promptInput = el("input", { type: "text", maxlength: FINALE_PROMPT_MAX, placeholder: t("Come finisce la storia?") });
  promptInput.value = finale.prompt || "";
  const endings = [0, 1].map((i) => {
    const label = el("input", { type: "text", maxlength: STORY_LABEL_MAX, "aria-label": t("Pulsante del finale {n}", { n: i + 1 }) });
    label.value = finale.endings?.[i]?.label || "";
    const text = textArea(t("Testo del finale {n}", { n: i + 1 }), finale.endings?.[i]?.text || "", 4, STORY_TEXT_MAX);
    return { label, text };
  });
  const save = () => {
    setFinale(campaign, { prompt: promptInput.value, endings: endings.map((e) => ({ label: e.label.value, text: e.text.value })) });
    onChange();
  };
  for (const control of [promptInput, ...endings.flatMap((e) => [e.label, e.text])]) control.addEventListener("change", save);
  return el("div", { class: "finale-editor" }, [
    el("h3", {}, t("Finale")),
    el(
      "p",
      { class: "muted" },
      t("Dopo l'ultimo caso il giocatore sceglie tra due finali. Compare solo quando entrambi hanno il pulsante e il testo.")
    ),
    field(t("Domanda (facoltativa)"), promptInput),
    ...endings.map((e, i) =>
      el("div", { class: "finale-ending" }, [
        el("strong", {}, t("Finale {n}", { n: i + 1 })),
        field(t("Testo del pulsante"), e.label),
        field(t("Testo del finale"), e.text),
      ])
    ),
  ]);
}
