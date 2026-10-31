// Room colors for the paper-cut skin. The editor stores a pastel per room; on
// the board each one is shown as the matching sheet of coloured paper.
// Unknown colors (hand-edited files, older cases) are derived: same hue,
// brought to the paper palette's saturation and lightness.
const PAPER_ROOMS = {
  "#f4c2c2": "#d9715e", // pink    -> terracotta
  "#c2e0f4": "#8fa9c9", // blue    -> dusty blue
  "#c9f4c2": "#8ec08a", // green   -> sage
  "#f4ecc2": "#e8b84a", // yellow  -> mustard
  "#e0c2f4": "#b9a3d3", // lilac   -> lavender
  "#f4d3c2": "#e89a5a", // peach   -> orange
  "#c2f4e8": "#7fb7a8", // mint    -> teal
  "#e8e8e8": "#c9c0b0", // grey    -> warm grey
};

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [((h * 60) + 360) % 360, s, l];
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function roomColor(stored) {
  const key = String(stored || "").toLowerCase();
  if (PAPER_ROOMS[key]) return PAPER_ROOMS[key];
  if (!/^#[0-9a-f]{6}$/.test(key)) return "#c9c0b0";
  const [h, s] = hexToHsl(key);
  return hslToHex(h, Math.min(0.55, Math.max(0.3, s * 0.6 + 0.25)), 0.64);
}
