import { el, clear } from "../util/dom.js";
import { objectIcon, characterIcon } from "../model/icons.js";
import { describeClue } from "../model/clueTypes.js";
import { cluesForCharacter, genericClues } from "../model/puzzle.js";

function addPrintLabels(board, grid) {
  board.appendChild(el("div", { class: "print-label print-label-corner" }));
  for (let c = 0; c < grid.size.cols; c++) {
    board.appendChild(el("div", { class: "print-label" }, `C${c + 1}`));
  }
}

function renderMapGrid(puzzle) {
  const grid = puzzle.grid;
  const board = el("div", { class: "print-board" });
  board.style.gridTemplateColumns = `20px repeat(${grid.size.cols}, 42px)`;
  board.style.gridTemplateRows = `20px repeat(${grid.size.rows}, 42px)`;
  const zoneById = new Map(grid.zones.map((z) => [z.id, z]));

  addPrintLabels(board, grid);
  for (let r = 0; r < grid.size.rows; r++) {
    board.appendChild(el("div", { class: "print-label" }, `R${r + 1}`));
    for (let c = 0; c < grid.size.cols; c++) {
      const cellData = grid.cells[r][c];
      const zone = !cellData.blocked && cellData.zoneId ? zoneById.get(cellData.zoneId) : null;
      const cellNode = el("div", {
        class: "print-cell" + (cellData.blocked ? " blocked" : ""),
        style: zone ? `background:${zone.color}` : "",
      });
      if (cellData.blocked) {
        board.appendChild(cellNode);
        continue;
      }
      if (zone) cellNode.appendChild(el("span", { class: "zone-label" }, zone.name));
      if (cellData.objectId) {
        const obj = grid.objects.find((o) => o.id === cellData.objectId);
        const def = obj && objectIcon(obj.typeId);
        if (def) {
          const wrap = el("span");
          wrap.innerHTML = def.icon;
          cellNode.appendChild(wrap);
        }
      }
      board.appendChild(cellNode);
    }
  }
  return board;
}

function renderClueCards(puzzle) {
  const wrap = el("div", { class: "print-cards" });
  const generic = genericClues(puzzle);
  if (generic.length > 0) {
    wrap.appendChild(
      el("div", { class: "print-card generic" }, [
        el("h3", {}, "🔎 Indizi generali del caso"),
        el("ul", {}, generic.map((clue) => el("li", {}, describeClue(clue, puzzle)))),
      ])
    );
  }
  for (const character of puzzle.characters) {
    const clues = cluesForCharacter(puzzle, character.id);
    const iconWrap = el("span", { style: "display:inline-flex;width:18px;height:18px;vertical-align:middle;margin-right:4px" });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
    const card = el("div", { class: "print-card" }, [
      el("h3", {}, [iconWrap, character.name + (character.isVictim ? " (Vittima)" : "")]),
      character.bio ? el("p", { class: "print-bio" }, character.bio) : null,
      el(
        "ul",
        {},
        clues.length ? clues.map((clue) => el("li", {}, describeClue(clue, puzzle))) : [el("li", {}, "Nessun indizio.")]
      ),
    ]);
    wrap.appendChild(card);
  }
  return wrap;
}

function renderBlankGrid(puzzle) {
  const grid = puzzle.grid;
  const board = el("div", { class: "print-board" });
  board.style.gridTemplateColumns = `20px repeat(${grid.size.cols}, 42px)`;
  board.style.gridTemplateRows = `20px repeat(${grid.size.rows}, 42px)`;
  addPrintLabels(board, grid);
  for (let r = 0; r < grid.size.rows; r++) {
    board.appendChild(el("div", { class: "print-label" }, `R${r + 1}`));
    for (let c = 0; c < grid.size.cols; c++) {
      const blocked = grid.cells[r][c].blocked;
      board.appendChild(el("div", { class: "print-cell" + (blocked ? " blocked" : "") }));
    }
  }
  return board;
}

export function renderPrintView(container, puzzle) {
  clear(container);
  const page = el("div", { class: "print-page" }, [
    el("h1", { class: "print-title" }, puzzle.title),
    el("p", { class: "print-subtitle" }, puzzle.author ? `di ${puzzle.author}` : ""),
    puzzle.briefing ? el("p", { class: "print-briefing" }, puzzle.briefing) : null,
    el("h2", { class: "print-blank-heading" }, "Mappa del caso"),
    renderMapGrid(puzzle),
    el("h2", { class: "print-blank-heading" }, "Personaggi e indizi"),
    renderClueCards(puzzle),
    el("h2", { class: "print-blank-heading" }, "Griglia per risolvere"),
    renderBlankGrid(puzzle),
  ]);
  container.appendChild(page);
}
