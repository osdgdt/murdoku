import { t } from "../i18n/i18n.js";

// Registry of CSS-only floors a zone can be painted with — same shape/lookup
// pattern as OBJECT_TYPES in icons.js. No external images: every floor is a
// stack of CSS gradients and/or tiny inline SVG data-URIs.
//
// Each entry: { label, layers: [css <image>...], sizes: [css <size>...], tint }
//  - `layers`/`sizes` are parallel arrays, painted top to bottom; the LAST
//    layer is the floor's own base color (`solid(...)`), so a new-style floor
//    has real colors of its own, independent of the zone's picked color.
//  - `tint` is the share (0..1) of the ZONE color mixed over the floor, so two
//    rooms with the same floor are still told apart. The two legacy floors
//    (`none`, `hatch`) have tint 0 and semi-transparent layers: there the zone
//    color itself is the base, exactly as before floors existed.
// Tile sizes are divisors of the 56px cell (28, 14, 7...), so the pattern
// repeats cleanly inside a cell.
//
// Ids are persisted in saved puzzles (zone.textureId): never rename or remove
// one — an unknown id falls back to "hatch".

const solid = (c) => `linear-gradient(${c}, ${c})`;
const svgUrl = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;
const px = (w, h = w) => `${w}px ${h}px`;

// Boards laid in running bond (each row shifted by half a plank).
function plankFloor(label, base, line, grain) {
  const body =
    `<path d='M0 .5H28M0 14.5H28M.5 0V14M14.5 14V28' stroke='${line}' stroke-width='1' fill='none'/>` +
    `<path d='M3 5h9M17 9h8M5 19h7M18 24h8' stroke='${grain}' stroke-width='.8' fill='none'/>`;
  return { label, layers: [svgUrl(28, 28, body), solid(base)], sizes: [px(28), "auto"], tint: 0.3 };
}

function checkerFloor(label, c1, c2) {
  return {
    label,
    layers: [`conic-gradient(${c1} 25%, ${c2} 0 50%, ${c1} 0 75%, ${c2} 0)`],
    sizes: [px(56)],
    tint: 0.3,
  };
}

function carpetFloor(label, base) {
  return {
    label,
    layers: [
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 4px)",
      "repeating-linear-gradient(-45deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 4px)",
      solid(base),
    ],
    sizes: ["auto", "auto", "auto"],
    tint: 0.3,
  };
}

const MOSAIC_COLORS = ["#2f6f8f", "#4aa3a2", "#e9dcc0", "#c9a24d", "#1f4f6b"];
const MOSAIC_GRID = [
  [0, 1, 2, 1],
  [3, 0, 1, 2],
  [1, 2, 0, 3],
  [2, 1, 3, 0],
];
const mosaicBody = MOSAIC_GRID.map((row, r) =>
  row.map((ci, c) => `<rect x='${c * 7 + 0.5}' y='${r * 7 + 0.5}' width='6' height='6' rx='0.8' fill='${MOSAIC_COLORS[ci]}'/>`).join("")
).join("");

const COBBLES = [
  [8, 8, 8, 7, "#8d867c"],
  [26, 6, 9, 6, "#9a9388"],
  [46, 9, 8, 7, "#837c72"],
  [10, 26, 7, 8, "#a09a8f"],
  [28, 24, 8, 8, "#8a8378"],
  [47, 27, 8, 8, "#9b948a"],
  [8, 46, 8, 8, "#857e74"],
  [27, 45, 9, 8, "#9d968b"],
  [47, 46, 8, 8, "#8c857a"],
];
const cobbleBody = COBBLES.map(
  ([cx, cy, rx, ry, c]) =>
    `<ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' fill='${c}' stroke='rgba(0,0,0,0.3)' stroke-width='1'/>` +
    `<ellipse cx='${cx - 2}' cy='${cy - 2}' rx='${rx * 0.45}' ry='${ry * 0.35}' fill='rgba(255,255,255,0.18)'/>`
).join("");

const dots = (list) => list.map(([x, y, r, c]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${c}'/>`).join("");
const GRAVEL = dots([
  [3, 4, 1.6, "#8f8678"],
  [11, 9, 1.2, "#d9d0c0"],
  [19, 3, 1.8, "#a59b8b"],
  [24, 13, 1.3, "#7d7467"],
  [6, 17, 1.7, "#cfc6b4"],
  [15, 21, 1.4, "#8a8174"],
  [23, 24, 1.9, "#b3a999"],
  [9, 26, 1.1, "#6f675b"],
  [26, 6, 1, "#d9d0c0"],
  [2, 11, 1, "#a59b8b"],
  [18, 14, 1.1, "#cfc6b4"],
]);
const SAND =
  dots([
    [4, 5, 0.7, "#c9b57e"],
    [13, 11, 0.8, "#fff6dc"],
    [22, 4, 0.7, "#c9b57e"],
    [8, 21, 0.8, "#fff6dc"],
    [20, 23, 0.7, "#c9b57e"],
    [26, 16, 0.7, "#fff6dc"],
  ]) +
  `<path d='M0 9q7-3 14 0t14 0' stroke='rgba(180,150,90,0.35)' stroke-width='1' fill='none'/>` +
  `<path d='M0 24q7-3 14 0t14 0' stroke='rgba(180,150,90,0.3)' stroke-width='1' fill='none'/>`;
const GRASS =
  `<path d='M4 24l1-8M10 26l-1-9M16 22l2-8M22 27l-1-9M26 20l1-7M7 12l-1-5M19 9l1-6' stroke='#3f7a35' stroke-width='1.3' stroke-linecap='round' fill='none'/>` +
  `<path d='M2 18l1-6M13 15l-1-7M24 14l1-6M8 27l1-5M20 20l-1-6' stroke='#8cc66d' stroke-width='1.2' stroke-linecap='round' fill='none'/>`;
const LINO = dots([
  [2, 3, 0.8, "rgba(0,0,0,0.13)"],
  [9, 8, 0.7, "rgba(255,255,255,0.4)"],
  [5, 11, 0.8, "rgba(0,0,0,0.1)"],
  [12, 2, 0.7, "rgba(255,255,255,0.35)"],
]);
const CONCRETE = dots([
  [3, 4, 0.9, "rgba(0,0,0,0.16)"],
  [11, 9, 0.8, "rgba(255,255,255,0.3)"],
  [19, 3, 1, "rgba(0,0,0,0.12)"],
  [24, 13, 0.8, "rgba(255,255,255,0.28)"],
  [6, 17, 1, "rgba(0,0,0,0.14)"],
  [15, 21, 0.8, "rgba(255,255,255,0.3)"],
  [23, 24, 1, "rgba(0,0,0,0.12)"],
  [9, 26, 0.8, "rgba(255,255,255,0.25)"],
]);
const BRICK =
  `<path d='M0 .5H28M0 7.5H28M0 14.5H28M0 21.5H28M.5 0V7M14.5 0V7M7.5 7V14M21.5 7V14M.5 14V21M14.5 14V21M7.5 21V28M21.5 21V28' stroke='#d9cbb2' stroke-width='1.4' fill='none'/>` +
  `<path d='M2 3h4M16 3h5M9 10h4M23 10h3M3 17h5M17 17h4M10 24h4M24 24h3' stroke='rgba(0,0,0,0.18)' stroke-width='1' fill='none'/>`;
const STONE_SLABS =
  `<path d='M0 .5H56M0 28.5H56M.5 0V28M34.5 0V28M18.5 28V56M46.5 28V56' stroke='#6f6c64' stroke-width='1.5' fill='none'/>` +
  dots([
    [8, 10, 0.8, "rgba(0,0,0,0.12)"],
    [24, 18, 0.7, "rgba(255,255,255,0.3)"],
    [42, 8, 0.8, "rgba(0,0,0,0.1)"],
    [10, 42, 0.8, "rgba(255,255,255,0.28)"],
    [32, 40, 0.8, "rgba(0,0,0,0.12)"],
  ]);
const MARBLE_WHITE =
  `<path d='M0 40C14 28 22 48 34 32S50 16 56 10' stroke='#a9a398' stroke-width='1.2' fill='none' opacity='0.7'/>` +
  `<path d='M0 12C10 18 18 6 30 14S48 26 56 22' stroke='#c7c2b8' stroke-width='0.9' fill='none' opacity='0.8'/>` +
  `<path d='M20 56C24 44 32 40 40 44' stroke='#bdb7ac' stroke-width='0.8' fill='none' opacity='0.7'/>`;
const MARBLE_BLACK =
  `<path d='M0 40C14 28 22 48 34 32S50 16 56 10' stroke='#b99a5a' stroke-width='1.1' fill='none' opacity='0.6'/>` +
  `<path d='M0 12C10 18 18 6 30 14S48 26 56 22' stroke='#ffffff' stroke-width='0.7' fill='none' opacity='0.25'/>` +
  `<path d='M20 56C24 44 32 40 40 44' stroke='#b99a5a' stroke-width='0.7' fill='none' opacity='0.5'/>`;

export const ZONE_TEXTURES = {
  none: { label: t("Nessuna (tinta unita)"), layers: ["none"], sizes: ["auto"], tint: 0 },
  hatch: {
    label: t("Diagonale (predefinita)"),
    layers: ["repeating-linear-gradient(135deg, rgba(0,0,0,0.055) 0 3px, transparent 3px 10px)"],
    sizes: ["auto"],
    tint: 0,
  },
  wood: {
    label: t("Assi di legno"),
    layers: [
      "repeating-linear-gradient(90deg, rgba(60,30,10,0.4) 0 1px, transparent 1px 14px)",
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, rgba(0,0,0,0.05) 1px 3px)",
      solid("#c08a52"),
    ],
    sizes: ["auto", "auto", "auto"],
    tint: 0.3,
  },
  parquet: {
    label: t("Parquet a quadrotti"),
    layers: [
      svgUrl(
        28,
        28,
        "<rect x='0' y='0' width='14' height='14' fill='rgba(255,255,255,0.1)'/><rect x='14' y='14' width='14' height='14' fill='rgba(255,255,255,0.1)'/>" +
          "<path d='M0 7H14M21 0V14M7 14V28M14 21H28M14 0V28M0 14H28' stroke='rgba(60,30,10,0.5)' stroke-width='1' fill='none'/>"
      ),
      solid("#b9834a"),
    ],
    sizes: [px(28), "auto"],
    tint: 0.3,
  },
  planks: plankFloor(t("Listoni chiari"), "#e2c391", "rgba(90,60,30,0.45)", "rgba(120,80,40,0.35)"),
  planks_dark: plankFloor(t("Listoni scuri"), "#6b4328", "rgba(30,15,5,0.6)", "rgba(255,255,255,0.12)"),
  checker_bw: checkerFloor(t("Scacchiera bianco e nero"), "#26272b", "#f0ede4"),
  checker_cream: checkerFloor(t("Scacchiera crema e cotto"), "#e8d8b8", "#b5603a"),
  terracotta: {
    label: t("Cotto"),
    layers: [
      "repeating-linear-gradient(0deg, #8c4a2c 0 1.5px, transparent 1.5px 28px)",
      "repeating-linear-gradient(90deg, #8c4a2c 0 1.5px, transparent 1.5px 28px)",
      "radial-gradient(circle at 30% 30%, rgba(255,210,170,0.2), transparent 60%)",
      solid("#b8643c"),
    ],
    sizes: ["auto", "auto", px(28), "auto"],
    tint: 0.3,
  },
  stone: { label: t("Lastre di pietra"), layers: [svgUrl(56, 56, STONE_SLABS), solid("#aaa79e")], sizes: [px(56), "auto"], tint: 0.3 },
  cobble: { label: t("Ciottoli"), layers: [svgUrl(56, 56, cobbleBody), solid("#4d4a45")], sizes: [px(56), "auto"], tint: 0.3 },
  slate: {
    label: t("Ardesia"),
    layers: [
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.38) 0 1px, transparent 1px 28px)",
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.38) 0 1px, transparent 1px 28px)",
      "linear-gradient(135deg, rgba(255,255,255,0.09), transparent 55%)",
      solid("#4a5560"),
    ],
    sizes: ["auto", "auto", px(28), "auto"],
    tint: 0.3,
  },
  marble: { label: t("Marmo bianco"), layers: [svgUrl(56, 56, MARBLE_WHITE), solid("#eeebe4")], sizes: [px(56), "auto"], tint: 0.3 },
  marble_black: { label: t("Marmo nero"), layers: [svgUrl(56, 56, MARBLE_BLACK), solid("#25272b")], sizes: [px(56), "auto"], tint: 0.3 },
  carpet: carpetFloor(t("Moquette rossa"), "#8f2d34"),
  carpet_blue: carpetFloor(t("Moquette blu"), "#2f4f8a"),
  carpet_green: carpetFloor(t("Moquette verde"), "#2e6b4a"),
  grass: { label: t("Erba"), layers: [svgUrl(28, 28, GRASS), solid("#5e9b48")], sizes: [px(28), "auto"], tint: 0.3 },
  gravel: { label: t("Ghiaia"), layers: [svgUrl(28, 28, GRAVEL), solid("#b9b0a0")], sizes: [px(28), "auto"], tint: 0.3 },
  sand: { label: t("Sabbia"), layers: [svgUrl(28, 28, SAND), solid("#e6d3a1")], sizes: [px(28), "auto"], tint: 0.3 },
  mosaic: { label: t("Mosaico"), layers: [svgUrl(28, 28, mosaicBody), solid("#efe9da")], sizes: [px(28), "auto"], tint: 0.3 },
  water: {
    label: t("Acqua"),
    layers: [
      "repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.28) 0 2px, transparent 2px 12px)",
      "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(0,40,90,0.16))",
      solid("#4c9bd0"),
    ],
    sizes: ["auto", "auto", "auto"],
    tint: 0.3,
  },
  linoleum: { label: t("Linoleum"), layers: [svgUrl(14, 14, LINO), solid("#b9cdb8")], sizes: [px(14), "auto"], tint: 0.3 },
  brick: { label: t("Mattoni"), layers: [svgUrl(28, 28, BRICK), solid("#a8472f")], sizes: [px(28), "auto"], tint: 0.3 },
  tiles_white: {
    label: t("Piastrelle bianche"),
    layers: [
      "repeating-linear-gradient(0deg, #b9b9b4 0 1.5px, transparent 1.5px 28px)",
      "repeating-linear-gradient(90deg, #b9b9b4 0 1.5px, transparent 1.5px 28px)",
      "linear-gradient(135deg, rgba(255,255,255,0.7), transparent 50%)",
      solid("#ecece6"),
    ],
    sizes: ["auto", "auto", px(28), "auto"],
    tint: 0.3,
  },
  concrete: { label: t("Cemento"), layers: [svgUrl(28, 28, CONCRETE), solid("#a9a9a5")], sizes: [px(28), "auto"], tint: 0.3 },
};

// CSS `background-image` / `background-size` values for a floor. `zoneColor`
// (a hex string) adds the zone tint layer; omit it for a plain preview.
export function floorStyle(textureId, zoneColor = null) {
  const def = ZONE_TEXTURES[textureId || "hatch"] || ZONE_TEXTURES.hatch;
  const layers = [...def.layers];
  const sizes = [...def.sizes];
  if (zoneColor && def.tint > 0) {
    const pct = Math.round(def.tint * 100);
    const mix = `color-mix(in srgb, ${zoneColor} ${pct}%, transparent)`;
    layers.unshift(`linear-gradient(${mix}, ${mix})`);
    sizes.unshift("auto");
  }
  // `own`: the floor brings colors of its own (everything but the two legacy
  // overlay floors), so the skin may wash/dim it to sit on the paper.
  return { image: layers.join(", "), size: sizes.join(", "), own: def.tint > 0 };
}
