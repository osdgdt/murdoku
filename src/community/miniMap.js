// The little map on the card of a case in the gallery: the rooms in their colours, the walls between rooms, blocked cells. It
// is drawn from `card.preview` ({ cells, colors }, see buildPreview in casePolicy.js), which anybody can write into a card's
// place only through the server, but is still treated as untrusted text: checked, drawn with createElementNS, never as markup.
import { roomColor } from "../skin/paper/rooms.js";

const SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyz";
const SVG = "http://www.w3.org/2000/svg";

// -> the cells to draw and the walls between rooms, or null when the preview does not fit the card's size.
//    { cells: [{ row, col, fill }], walls: [[x1, y1, x2, y2], ...], rows, cols }
export function miniMapModel(preview, rows, cols) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 16 || cols > 16) return null;
  if (!preview || typeof preview.cells !== "string" || !Array.isArray(preview.colors)) return null;
  if (preview.cells.length !== rows * cols || preview.colors.length < 1 || preview.colors.length > SYMBOLS.length) return null;
  if (!preview.colors.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))) return null;
  const at = (r, c) => preview.cells[r * cols + c];
  const cells = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const symbol = at(row, col);
      let fill;
      if (symbol === "#") fill = "#6b6358";
      else if (symbol === "-") fill = "#e6dfd0";
      else {
        const index = SYMBOLS.indexOf(symbol);
        if (index < 0 || index >= preview.colors.length) return null;
        fill = roomColor(preview.colors[index]);
      }
      cells.push({ row, col, fill });
    }
  const walls = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (col + 1 < cols && at(row, col) !== at(row, col + 1)) walls.push([col + 1, row, col + 1, row + 1]);
      if (row + 1 < rows && at(row, col) !== at(row + 1, col)) walls.push([col, row + 1, col + 1, row + 1]);
    }
  return { cells, walls, rows, cols };
}

// The SVG for the model, or null. `label` is its accessible name (the card also says the size in words).
export function miniMapSvg(preview, rows, cols, label = "") {
  const model = miniMapModel(preview, rows, cols);
  if (!model) return null;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${cols} ${rows}`);
  svg.setAttribute("class", "mini-map");
  svg.setAttribute("shape-rendering", "crispEdges");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else svg.setAttribute("aria-hidden", "true");
  for (const { row, col, fill } of model.cells) {
    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("x", String(col));
    rect.setAttribute("y", String(row));
    rect.setAttribute("width", "1");
    rect.setAttribute("height", "1");
    rect.setAttribute("fill", fill);
    svg.appendChild(rect);
  }
  const lines = document.createElementNS(SVG, "path");
  lines.setAttribute("d", model.walls.map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`).join(""));
  lines.setAttribute("class", "mini-map-walls");
  lines.setAttribute("fill", "none");
  lines.setAttribute("stroke-width", "0.14");
  svg.appendChild(lines);
  return svg;
}
