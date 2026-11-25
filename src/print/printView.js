import { el, clear } from "../util/dom.js";
import { objectIcon, characterIcon, isEdgeObjectType } from "../model/icons.js";
import { describeClue } from "../model/clueTypes.js";
import { cluesForCharacter, genericClues, difficultyLabel } from "../model/puzzle.js";
import { t } from "../i18n/i18n.js";
import { sealOf } from "../model/grid.js";
import { sealIcon } from "../skin/paper/seals.js";
import { hasRoles, roleName, rolesSummary } from "../model/roles.js";
import { zoneTitle } from "../model/terrain.js";
import { hasSectors, sectorAxis, sectorIndexAlong, isFloorPadding, localRow } from "../model/sectors.js";
import { wayIdOf, wayNumbers } from "../model/floors.js";

// A train (wagons side by side) has its own row labels in every wagon, so a label column opens every wagon after the first; a
// skyscraper (floors one above the other) has its own column labels over every floor, so a header opens every floor after the
// first.
const besideAt = (grid, c) => hasSectors(grid) && sectorAxis(grid) === "col" && grid.sectors.some((s, k) => k > 0 && s.first === c);
const stackedAt = (grid, r) => hasSectors(grid) && sectorAxis(grid) === "row" && grid.sectors.some((s, k) => k > 0 && s.first === r);

// `row`: the first row of the floor these labels open (a skyscraper writes the name of the floor in the corner).
function addColumnLabels(board, grid, row = 0) {
  const floor = hasSectors(grid) && sectorAxis(grid) === "row" ? grid.sectors[sectorIndexAlong(grid, row)] : null;
  board.appendChild(el("div", { class: "print-label print-label-corner" + (floor ? " print-floor-name" : "") }, floor ? floor.name : ""));
  for (let c = 0; c < grid.size.cols; c++) {
    if (besideAt(grid, c)) board.appendChild(el("div", { class: "print-label print-label-corner" }));
    board.appendChild(el("div", { class: "print-label" }, `C${c + 1}`));
  }
}

// Cells are 42px; from 13 columns they shrink (34px) so a 16-column board still fits the width
// of an A4 page (20px label + 16 x 34px + gaps is about 580px, against about 700px of paper).
function sizePrintBoard(board, grid) {
  const cell = grid.size.cols > 12 || grid.size.rows > 12 ? 34 : 42;
  board.style.setProperty("--print-cell", `${cell}px`);
  const strips = hasSectors(grid) ? grid.sectors : null;
  const along = (s) => `20px repeat(${s.last - s.first + 1}, ${cell}px)`;
  board.style.gridTemplateColumns =
    strips && sectorAxis(grid) === "col" ? strips.map(along).join(" ") : `20px repeat(${grid.size.cols}, ${cell}px)`;
  board.style.gridTemplateRows =
    strips && sectorAxis(grid) === "row" ? strips.map(along).join(" ") : `20px repeat(${grid.size.rows}, ${cell}px)`;
}

function renderMapGrid(puzzle) {
  const grid = puzzle.grid;
  const board = el("div", { class: "print-board" });
  sizePrintBoard(board, grid);
  const zoneById = new Map(grid.zones.map((z) => [z.id, z]));

  const wayNumber = wayNumbers(grid);
  addColumnLabels(board, grid);
  for (let r = 0; r < grid.size.rows; r++) {
    if (stackedAt(grid, r)) addColumnLabels(board, grid, r);
    board.appendChild(el("div", { class: "print-label" }, `R${localRow(grid, r) + 1}`));
    for (let c = 0; c < grid.size.cols; c++) {
      if (besideAt(grid, c)) board.appendChild(el("div", { class: "print-label" }, `R${localRow(grid, r) + 1}`));
      const cellData = grid.cells[r][c];
      const zone = !cellData.blocked && cellData.zoneId ? zoneById.get(cellData.zoneId) : null;
      const cellNode = el("div", {
        class: "print-cell" + (cellData.blocked ? " blocked" : "") + (isFloorPadding(grid, r, c) ? " floor-void" : ""),
        style: zone ? `background:${zone.color}` : "",
      });
      if (cellData.blocked) {
        board.appendChild(cellNode);
        continue;
      }
      if (zone) cellNode.appendChild(el("span", { class: "zone-label" }, zoneTitle(zone)));
      if (cellData.objectId) {
        const obj = grid.objects.find((o) => o.id === cellData.objectId);
        const def = obj && objectIcon(obj.typeId);
        if (def) {
          const wrap = el("span");
          wrap.innerHTML = def.icon;
          cellNode.appendChild(wrap);
          const way = wayIdOf(obj);
          if (way) cellNode.appendChild(el("span", { class: "print-way-num" }, String(wayNumber.get(way))));
        }
      }
      if (sealOf(grid, r, c)) {
        const mark = el("span", { class: "print-seal" });
        mark.innerHTML = sealIcon(cellData.seal);
        cellNode.appendChild(mark);
      }
      if (typeof cellData.roleCell === "string") {
        const name = roleName(puzzle, cellData.roleCell);
        cellNode.appendChild(el("span", { class: "print-role-mark", title: name }, name === "?" ? "◆" : [...name][0].toUpperCase()));
      }
      for (const o of grid.objects) {
        if (o.row !== r || o.col !== c || !isEdgeObjectType(o.typeId)) continue;
        const def = objectIcon(o.typeId);
        if (!def || !def.edgeIcon) continue;
        const piece = el("span", { class: `print-edge print-edge-${o.side || "N"}` });
        piece.innerHTML = def.edgeIcon;
        cellNode.appendChild(piece);
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
        el("h3", {}, t("🔎 Indizi generali del caso")),
        el(
          "ul",
          {},
          generic.map((clue) => el("li", {}, describeClue(clue, puzzle)))
        ),
      ])
    );
  }
  for (const character of puzzle.characters) {
    const clues = cluesForCharacter(puzzle, character.id);
    const iconWrap = el("span", { style: "display:inline-flex;width:18px;height:18px;vertical-align:middle;margin-right:4px" });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
    const card = el("div", { class: "print-card" }, [
      el("h3", {}, [iconWrap, character.name + (character.isVictim ? t(" (Vittima)") : "")]),
      character.bio ? el("p", { class: "print-bio" }, character.bio) : null,
      el("ul", {}, clues.length ? clues.map((clue) => el("li", {}, describeClue(clue, puzzle))) : [el("li", {}, t("Nessun indizio."))]),
    ]);
    wrap.appendChild(card);
  }
  return wrap;
}

function renderBlankGrid(puzzle) {
  const grid = puzzle.grid;
  const board = el("div", { class: "print-board" });
  sizePrintBoard(board, grid);
  addColumnLabels(board, grid);
  for (let r = 0; r < grid.size.rows; r++) {
    if (stackedAt(grid, r)) addColumnLabels(board, grid, r);
    board.appendChild(el("div", { class: "print-label" }, `R${localRow(grid, r) + 1}`));
    for (let c = 0; c < grid.size.cols; c++) {
      if (besideAt(grid, c)) board.appendChild(el("div", { class: "print-label" }, `R${localRow(grid, r) + 1}`));
      const blocked = grid.cells[r][c].blocked;
      board.appendChild(
        el("div", { class: "print-cell" + (blocked ? " blocked" : "") + (isFloorPadding(grid, r, c) ? " floor-void" : "") })
      );
    }
  }
  return board;
}

// What the case says about the hidden roles, under the map: the roles with how many people have each, and the noble areas.
function renderRolesNote(puzzle) {
  if (!hasRoles(puzzle)) return null;
  return el("p", { class: "print-roles" }, rolesSummary(puzzle).join(" "));
}

export function renderPrintView(container, puzzle) {
  clear(container);
  const subtitleParts = [];
  if (puzzle.author) subtitleParts.push(t("di {author}", { author: puzzle.author }));
  if (puzzle.difficulty) subtitleParts.push(t("Difficoltà: {v}", { v: difficultyLabel(puzzle.difficulty) }));
  const page = el("div", { class: "print-page" }, [
    el("h1", { class: "print-title" }, puzzle.title),
    el("p", { class: "print-subtitle" }, subtitleParts.join(" · ")),
    puzzle.briefing ? el("p", { class: "print-briefing" }, puzzle.briefing) : null,
    el("h2", { class: "print-blank-heading" }, t("Mappa del caso")),
    renderMapGrid(puzzle),
    renderRolesNote(puzzle),
    el("h2", { class: "print-blank-heading" }, t("Personaggi e indizi")),
    renderClueCards(puzzle),
    el("h2", { class: "print-blank-heading" }, t("Griglia per risolvere")),
    renderBlankGrid(puzzle),
  ]);
  container.appendChild(page);
}
