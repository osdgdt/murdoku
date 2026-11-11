import { el, clear } from "../util/dom.js";
import { characterIcon } from "../model/icons.js";
import { describeClue } from "../model/clueTypes.js";
import { cluesForCharacter, genericClues, characterColor } from "../model/puzzle.js";
import { t } from "../i18n/i18n.js";

// `state`, when passed, dims a character's card once the player has confirmed
// them on the board — a quick visual "handled" cue, like a suspect crossed
// off a detective's list. `onClueHover`/`onClueHoverEnd`, when passed, wire a
// per-clue-line hover that temporarily highlights that clue's target cells
// (see gameScreen.js's showClueHover/clearHover).
export function renderClueCards(container, puzzle, state, onClueHover, onClueHoverEnd) {
  clear(container);
  container.appendChild(el("h3", { "aria-level": "2" }, t("Personaggi e indizi")));

  function clueLi(clue) {
    return el("li", { onMouseenter: onClueHover ? () => onClueHover(clue) : undefined, onMouseleave: onClueHoverEnd }, describeClue(clue, puzzle));
  }

  const generic = genericClues(puzzle);
  if (generic.length > 0) {
    container.appendChild(
      el("div", { class: "clue-card generic" }, [
        el("div", { class: "row" }, [el("strong", {}, t("🔎 Indizi generali del caso"))]),
        el("ul", {}, generic.map(clueLi)),
      ])
    );
  }

  for (const character of puzzle.characters) {
    const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;

    const clues = cluesForCharacter(puzzle, character.id);
    const list = el(
      "ul",
      {},
      clues.length ? clues.map(clueLi) : [el("li", { class: "muted" }, t("Nessun indizio."))]
    );

    const placed = state?.placements.has(character.id);
    const active = state?.selectedTool?.kind === "character" && state.selectedTool.id === character.id;
    const card = el("div", {
      class: "clue-card" + (character.isVictim ? " victim" : "") + (placed ? " placed" : "") + (active ? " active" : ""),
      style: character.isVictim ? "" : `--clue-accent: ${characterColor(character)}`,
    }, [
      el("div", { class: "row" }, [iconWrap, el("strong", {}, character.name + (character.isVictim ? t(" (Vittima)") : ""))]),
      character.bio ? el("p", { class: "bio-text" }, character.bio) : null,
      list,
    ]);
    container.appendChild(card);
  }
}

// A box of its own, always beside the board (it sticks while the page scrolls):
// the selected character's clues, big and alone, so there is nothing to hunt
// for in the full list below. With nobody selected it says how to get one.
export function renderSelectedClue(container, puzzle, state, onClueHover, onClueHoverEnd) {
  clear(container);
  const tool = state?.selectedTool;
  const character = tool?.kind === "character" ? puzzle.characters.find((c) => c.id === tool.id) : null;
  container.classList.toggle("empty", !character);
  if (!character) {
    container.appendChild(el("p", { class: "selected-clue-empty" }, t("Scegli un personaggio (clic sul suo nome, o tasti 1-9) per vedere qui il suo indizio.")));
    return;
  }
  const color = character.isVictim ? "var(--danger)" : characterColor(character);
  container.style.setProperty("--clue-accent", color);
  const icon = el("span", { class: "selected-clue-icon", style: `color:${color}` });
  icon.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
  const clues = cluesForCharacter(puzzle, character.id);
  const placed = state.placements.has(character.id);
  container.appendChild(
    el("div", { class: "selected-clue-head" }, [
      icon,
      el("div", {}, [
        el("strong", { class: "selected-clue-name" }, character.name + (character.isVictim ? t(" (Vittima)") : "")),
        placed ? el("span", { class: "selected-clue-placed" }, t("già collocato")) : null,
      ]),
    ])
  );
  container.appendChild(
    el(
      "ul",
      { class: "selected-clue-list" },
      clues.length
        ? clues.map((clue) => el("li", { onMouseenter: onClueHover ? () => onClueHover(clue) : undefined, onMouseleave: onClueHoverEnd }, describeClue(clue, puzzle)))
        : [el("li", { class: "muted" }, t("Nessun indizio."))]
    )
  );
}
