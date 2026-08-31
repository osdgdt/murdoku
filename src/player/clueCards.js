import { el, clear } from "../util/dom.js";
import { characterIcon } from "../model/icons.js";
import { describeClue } from "../model/clueTypes.js";
import { cluesForCharacter, genericClues, characterColor } from "../model/puzzle.js";

// `state`, when passed, dims a character's card once the player has confirmed
// them on the board — a quick visual "handled" cue, like a suspect crossed
// off a detective's list.
export function renderClueCards(container, puzzle, state) {
  clear(container);
  container.appendChild(el("h3", {}, "Personaggi e indizi"));

  const generic = genericClues(puzzle);
  if (generic.length > 0) {
    container.appendChild(
      el("div", { class: "clue-card generic" }, [
        el("div", { class: "row" }, [el("strong", {}, "🔎 Indizi generali del caso")]),
        el("ul", {}, generic.map((clue) => el("li", {}, describeClue(clue, puzzle)))),
      ])
    );
  }

  for (const character of puzzle.characters) {
    const iconWrap = el("span");
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;

    const clues = cluesForCharacter(puzzle, character.id);
    const list = el(
      "ul",
      {},
      clues.length
        ? clues.map((clue) => el("li", {}, describeClue(clue, puzzle)))
        : [el("li", { class: "muted" }, "Nessun indizio.")]
    );

    const placed = state?.placements.has(character.id);
    const active = state?.selectedTool?.kind === "character" && state.selectedTool.id === character.id;
    const card = el("div", {
      class: "clue-card" + (character.isVictim ? " victim" : "") + (placed ? " placed" : "") + (active ? " active" : ""),
      style: character.isVictim ? "" : `--clue-accent: ${characterColor(character)}`,
    }, [
      el("div", { class: "row" }, [iconWrap, el("strong", {}, character.name + (character.isVictim ? " (Vittima)" : ""))]),
      character.bio ? el("p", { class: "bio-text" }, character.bio) : null,
      list,
    ]);
    container.appendChild(card);
  }
}
