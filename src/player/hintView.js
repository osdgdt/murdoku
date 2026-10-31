// DOM for the hint panel: the "Perché" explanation under a hint step, and the
// ‹ › stepper. Pure rendering — state and navigation live in gameScreen.js.
import { el } from "../util/dom.js";
import { describeClue } from "../model/clueTypes.js";
import { t } from "../i18n/i18n.js";

// Which specific clues (by name, prefixed with the owning character when it's
// not the step's own subject) make the deduction certain. Returns null when
// there's nothing to add (result types other than forcedPlacement /
// eliminatedCell / a clue-cause contradiction).
export function renderHintExplanation(puzzle, result) {
  if (result.type === "contradiction" && result.cause === "clue") {
    return el("div", { class: "hint-explain" }, [
      el("div", { class: "hint-explain-label" }, t("Indizio in conflitto:")),
      el("ul", { class: "hint-clue-list" }, result.clueIds.map((id) => {
        const clue = puzzle.clues.find((c) => c.id === id);
        if (!clue) return null;
        const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
        return el("li", {}, (owner ? owner.name + ": " : "") + describeClue(clue, puzzle));
      })),
    ]);
  }
  if (result.type !== "forcedPlacement" && result.type !== "eliminatedCell") return null;
  if (result.viaDerivedSolution) {
    return el("div", { class: "hint-explain" },
      el("p", { class: "hint-explain-note" }, t("Questa deduzione non viene da un indizio specifico, ma da un'analisi completa e approfondita dell'intero caso.")));
  }
  if (result.jointlyDetermined) {
    return el("div", { class: "hint-explain" }, el("p", { class: "hint-explain-note" }, t("Questa deduzione dipende dalla combinazione di più indizi insieme.")));
  }
  const blocks = [];
  if (result.involvedClues?.length) {
    blocks.push(el("div", { class: "hint-explain-label" }, t("Perché:")));
    blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedClues.map((c) => el("li", {}, (c.ownerName ? c.ownerName + ": " : "") + c.description))));
  }
  if (result.involvedGroups?.length) {
    // "Naked subset" deductions (see solver/propagation.js): not caused by any
    // one clue, but by several characters' clue-narrowed domains jointly
    // leaving no room for anyone else in a shared set of cells.
    blocks.push(el("div", { class: "hint-explain-label" }, t("Interazione tra personaggi:")));
    blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedGroups.map((g) =>
      el("li", {}, t("{v} possono stare solo in {v2}: nessun altro personaggio può occupare quelle celle.", { v: g.characterNames.join(" e "), v2: g.cellLabels.join(" o ") }))
    )));
  }
  if (blocks.length === 0) return null;
  return el("div", { class: "hint-explain" }, blocks);
}

export function renderHintStep(puzzle, chain, index, { onPrev, onNext }) {
  const result = chain[index];
  const nodes = [el("div", { class: `result-banner hint-${result.variant}` }, result.message)];
  const explanation = renderHintExplanation(puzzle, result);
  if (explanation) nodes.push(explanation);
  if (chain.length > 1) {
    nodes.push(
      el("div", { class: "hint-nav" }, [
        el("button", { onClick: onPrev, disabled: index === 0 || undefined }, "‹"),
        el("span", {}, t("Passo {v} di {length}", { v: index + 1, length: chain.length })),
        el("button", { onClick: onNext, disabled: index === chain.length - 1 || undefined }, "›"),
      ])
    );
  }
  return nodes;
}
