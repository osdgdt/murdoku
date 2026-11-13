// Medieval / dark-fantasy floors, same shape as the entries of ZONE_TEXTURES in
// textures.js ({ label, layers, sizes, tint }; the last layer is the floor's own
// base colour). Merged into ZONE_TEXTURES there. Ids are persisted in saved
// puzzles (zone.textureId): never rename or remove one.
//
// Every pattern is drawn from fixed coordinates and a seeded generator, so a
// floor looks the same on every load and on every device.
import { t } from "../i18n/i18n.js";

const solid = (c) => `linear-gradient(${c}, ${c})`;
const svgUrl = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;
const px = (w, h = w) => `${w}px ${h}px`;

// Small deterministic generator (mulberry32).
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const f = (n) => Math.round(n * 10) / 10;

// n marks scattered over a w×h tile; `draw(x, y, r)` returns the SVG of one mark.
function scatter(seed, n, w, h, draw) {
  const r = rand(seed);
  let out = "";
  for (let i = 0; i < n; i++) out += draw(f(r() * w), f(r() * h), r);
  return out;
}

const floor = (label, body, size, base, tint = 0.3) => ({
  label,
  layers: [svgUrl(size, size, body), solid(base)],
  sizes: [px(size), "auto"],
  tint,
});

// ---------------------------------------------------------------- stone
// Irregular slabs (56px tile): each slab is a polygon with its own tone.
function slabs(seed, tones, line) {
  const r = rand(seed);
  const rows = [
    [0, 18],
    [18, 38],
    [38, 56],
  ];
  let out = "";
  rows.forEach(([y0, y1], ri) => {
    let x = ri === 1 ? -9 : 0;
    while (x < 56) {
      const w = 15 + Math.floor(r() * 14);
      const x1 = x + w;
      const j = () => f((r() - 0.5) * 2);
      out +=
        `<path d='M${f(x + 0.8)} ${f(y0 + 0.8 + j())}L${f(x1 - 0.8)} ${f(y0 + 0.8 + j())}L${f(x1 - 0.8 + j())} ${f(y1 - 0.8)}L${f(x + 0.8 + j())} ${f(y1 - 0.8)}Z'` +
        ` fill='${pick(r, tones)}' stroke='${line}' stroke-width='1.3' stroke-linejoin='round'/>`;
      x = x1;
    }
  });
  return out;
}

const FLAGSTONE_DARK =
  slabs(11, ["#625f5b", "#585552", "#6b6864", "#524f4c"], "#2a2826") +
  scatter(3, 16, 56, 56, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.5 + r() * 0.8)}' fill='rgba(255,255,255,0.14)'/>`);

const MOSS_BLOB = (x, y, r) =>
  `<ellipse cx='${x}' cy='${y}' rx='${f(2 + r() * 3.5)}' ry='${f(1.5 + r() * 2.2)}' fill='${r() < 0.5 ? "#5f8a3c" : "#7aa84c"}' opacity='0.85'/>`;
const FLAGSTONE_MOSS =
  slabs(29, ["#8a8b82", "#7d7e76", "#92938a", "#74756d"], "#3a3d34") +
  scatter(5, 20, 56, 56, MOSS_BLOB) +
  `<path d='M0 18.5H56M0 38.5H56' stroke='#4d6b34' stroke-width='1.2' opacity='0.5'/>`;

const CRACKED =
  `<path d='M0 .8H56M0 28.8H56M.8 0V28M34.8 0V28M18.8 28V56M46.8 28V56' stroke='#7f7c74' stroke-width='1.5' fill='none'/>` +
  `<path d='M6 6L12 12L10 19L16 24M40 4L37 11L43 16L41 24M22 34L28 40L25 47L31 52M50 33L47 40L52 46' stroke='#4a4843' stroke-width='1.1' fill='none' stroke-linecap='round' stroke-linejoin='round'/>` +
  `<path d='M12 12L17 11M43 16L48 18M28 40L34 39M47 40L42 43' stroke='#4a4843' stroke-width='.8' fill='none'/>` +
  scatter(8, 10, 56, 56, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.6 + r() * 0.6)}' fill='rgba(255,255,255,0.3)'/>`);

const CHECKER_STONE =
  `<rect width='28' height='28' fill='#4b4d52'/><rect x='28' width='28' height='28' fill='#8a8d92'/><rect y='28' width='28' height='28' fill='#8a8d92'/><rect x='28' y='28' width='28' height='28' fill='#4b4d52'/>` +
  `<path d='M0 .6H56M0 28H56M.6 0V56M28 0V56' stroke='rgba(0,0,0,0.35)' stroke-width='1.2' fill='none'/>` +
  scatter(13, 14, 56, 56, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.4 + r() * 0.6)}' fill='rgba(255,255,255,0.18)'/>`);

const RUNE_GLYPHS = [
  "M0 -4V4M0 -2L3 -4M0 1L3 -1",
  "M-2 -4L2 0L-2 4M2 -4V4",
  "M-3 -3H3M0 -3V4M-3 4L3 4",
  "M-2 -4V4M2 -4V4M-2 0H2",
  "M-3 4L0 -4L3 4M-2 1H2",
  "M0 -4L3 0L0 4L-3 0Z",
];
const RUNES =
  slabs(41, ["#38404c", "#323946", "#3e4654", "#2d3440"], "#171b22") +
  [
    [14, 9, 0],
    [40, 9, 1],
    [10, 28, 2],
    [30, 28, 3],
    [49, 29, 4],
    [18, 47, 5],
    [42, 47, 0],
  ]
    .map(
      ([x, y, g]) =>
        `<g transform='translate(${x} ${y})'><path d='${RUNE_GLYPHS[g]}' stroke='#58e0d2' stroke-width='3.2' fill='none' stroke-linecap='round' stroke-linejoin='round' opacity='0.22'/><path d='${RUNE_GLYPHS[g]}' stroke='#9ff6ea' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></g>`
    )
    .join("");

// ---------------------------------------------------------------- earth
const DIRT =
  scatter(
    17,
    26,
    28,
    28,
    (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.6 + r() * 1.3)}' fill='${pick(r, ["#6f5236", "#a88862", "#7d5f40", "#5c4429"])}'/>`
  ) +
  scatter(
    23,
    5,
    28,
    28,
    (x, y, r) =>
      `<path d='M${x} ${y}q${f(2 + r() * 3)} ${f(-1 - r())} ${f(4 + r() * 3)} 0' stroke='rgba(60,40,20,0.35)' stroke-width='1' fill='none' stroke-linecap='round'/>`
  );

const MUD =
  `<ellipse cx='9' cy='9' rx='8' ry='4.5' fill='#3e2d1e'/><ellipse cx='8' cy='8' rx='5' ry='2' fill='rgba(150,170,190,0.35)'/>` +
  `<ellipse cx='36' cy='20' rx='10' ry='5' fill='#3e2d1e'/><ellipse cx='34' cy='19' rx='6' ry='2.2' fill='rgba(150,170,190,0.35)'/>` +
  `<ellipse cx='16' cy='42' rx='7' ry='4' fill='#3e2d1e'/><ellipse cx='15' cy='41' rx='4' ry='1.6' fill='rgba(150,170,190,0.3)'/>` +
  `<ellipse cx='46' cy='46' rx='8' ry='4.2' fill='#3e2d1e'/><ellipse cx='45' cy='45' rx='5' ry='1.8' fill='rgba(150,170,190,0.3)'/>` +
  scatter(
    31,
    18,
    56,
    56,
    (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.7 + r() * 1.2)}' fill='${pick(r, ["#7a5a3a", "#4a3624", "#8d6c46"])}'/>`
  );

const STRAW = scatter(37, 70, 28, 28, (x, y, r) => {
  const a = r() * Math.PI;
  const l = 3 + r() * 5;
  return `<path d='M${x} ${y}l${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}' stroke='${pick(r, ["#b8902a", "#e6c565", "#d4a93c", "#9c7a1f"])}' stroke-width='1.1' stroke-linecap='round' fill='none'/>`;
});

const MOSS_GROUND =
  scatter(
    43,
    22,
    28,
    28,
    (x, y, r) =>
      `<ellipse cx='${x}' cy='${y}' rx='${f(1.5 + r() * 3)}' ry='${f(1 + r() * 2)}' fill='${pick(r, ["#4a6b34", "#6f9444", "#3c5a2b", "#86a655"])}'/>`
  ) + scatter(47, 10, 28, 28, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.5 + r() * 0.7)}' fill='rgba(255,255,255,0.25)'/>`);

const LEAF = (x, y, r) => {
  const a = f(r() * 180);
  return `<g transform='translate(${x} ${y}) rotate(${a})'><path d='M0 0Q3 -3 6 0Q3 3 0 0Z' fill='${pick(r, ["#7c4f2a", "#a2691f", "#5f7a2f", "#8a3b22"])}'/><path d='M0 0H6' stroke='rgba(0,0,0,0.3)' stroke-width='.6'/></g>`;
};
const FOREST_FLOOR =
  scatter(53, 12, 28, 28, LEAF) +
  scatter(59, 8, 28, 28, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.5 + r() * 0.8)}' fill='rgba(0,0,0,0.25)'/>`);

const BONE = (x, y, r) => {
  const a = f(r() * 180);
  const l = f(5 + r() * 3);
  return `<g transform='translate(${x} ${y}) rotate(${a})'><rect x='${-l / 2}' y='-0.9' width='${l}' height='1.8' rx='.9' fill='#e8e0cb'/><circle cx='${-l / 2}' cy='-1' r='1.3' fill='#e8e0cb'/><circle cx='${-l / 2}' cy='1' r='1.3' fill='#e8e0cb'/><circle cx='${l / 2}' cy='-1' r='1.3' fill='#e8e0cb'/><circle cx='${l / 2}' cy='1' r='1.3' fill='#e8e0cb'/></g>`;
};
const OSSUARY =
  scatter(61, 14, 56, 56, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.7 + r() * 1.2)}' fill='rgba(255,255,255,0.1)'/>`) +
  scatter(67, 7, 56, 56, BONE) +
  `<g transform='translate(40 40)'><ellipse cx='0' cy='-1' rx='4.2' ry='3.8' fill='#e8e0cb'/><rect x='-2.4' y='1.6' width='4.8' height='3' rx='1' fill='#e8e0cb'/><circle cx='-1.6' cy='-1' r='1.1' fill='#2b2622'/><circle cx='1.6' cy='-1' r='1.1' fill='#2b2622'/></g>`;

const SNOW =
  scatter(
    71,
    12,
    28,
    28,
    (x, y, r) => `<ellipse cx='${x}' cy='${y}' rx='${f(3 + r() * 4)}' ry='${f(1.2 + r() * 1.4)}' fill='rgba(160,190,225,0.45)'/>`
  ) + scatter(73, 14, 28, 28, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${f(0.4 + r() * 0.5)}' fill='#ffffff'/>`);

// ---------------------------------------------------------------- wood and tiles
function boards(seed, base, line, grain, knot) {
  const r = rand(seed);
  let out = "";
  const widths = [9, 11, 8];
  let x = 0;
  let i = 0;
  while (x < 28) {
    const w = widths[i++ % widths.length];
    out += `<path d='M${x + 0.5} 0V28' stroke='${line}' stroke-width='1.3'/>`;
    for (let k = 0; k < 3; k++) {
      const gx = f(x + 2 + r() * (w - 4));
      const gy = f(r() * 24);
      out += `<path d='M${gx} ${gy}v${f(3 + r() * 5)}' stroke='${grain}' stroke-width='.8' stroke-linecap='round'/>`;
    }
    if (r() < 0.6) {
      const kx = f(x + w / 2);
      const ky = f(4 + r() * 20);
      out += `<ellipse cx='${kx}' cy='${ky}' rx='1.5' ry='2.2' fill='${knot}'/>`;
    }
    x += w;
  }
  return out;
}

const BRIDGE =
  `<rect width='28' height='28' fill='#2a3a4a'/>` +
  [0, 7, 14, 21]
    .map(
      (y, i) =>
        `<rect x='0' y='${y + 0.7}' width='28' height='5.6' rx='1' fill='${["#8a6238", "#7d5731", "#946a3f", "#835c35"][i]}'/>` +
        `<path d='M${3 + i * 5} ${y + 2.4}h6M${16 - i * 2} ${y + 4.4}h7' stroke='rgba(40,20,5,0.4)' stroke-width='.8' stroke-linecap='round'/>` +
        `<circle cx='${2 + (i % 2) * 24}' cy='${y + 3.5}' r='.9' fill='#3a2a18'/>`
    )
    .join("");

const HERRINGBONE = (() => {
  // bricks 14×7 laid at right angles in a zig-zag (28px tile)
  const brick = (x, y, horizontal, c) =>
    horizontal
      ? `<rect x='${x + 0.6}' y='${y + 0.6}' width='13' height='6' rx='.8' fill='${c}' stroke='rgba(60,25,10,0.45)' stroke-width='.8'/>`
      : `<rect x='${x + 0.6}' y='${y + 0.6}' width='6' height='13' rx='.8' fill='${c}' stroke='rgba(60,25,10,0.45)' stroke-width='.8'/>`;
  const cols = ["#b0553a", "#a14a33", "#bb6044", "#9a432e"];
  return (
    brick(0, 0, true, cols[0]) +
    brick(14, 0, false, cols[1]) +
    brick(0, 7, false, cols[2]) +
    brick(7, 7, true, cols[3]) +
    brick(21, 14, false, cols[0]) +
    brick(0, 14, true, cols[1]) +
    brick(14, 14, true, cols[2]) +
    brick(7, 21, false, cols[3]) +
    brick(14, 21, true, cols[0])
  );
})();

const ENCAUSTIC = (() => {
  // four 14px tiles: dark cross-and-lozenge motif on cream / terracotta
  const tile = (x, y, bg, fg) =>
    `<rect x='${x + 0.5}' y='${y + 0.5}' width='13' height='13' fill='${bg}' stroke='rgba(60,30,10,0.45)' stroke-width='.8'/>` +
    `<path d='M${x + 7} ${y + 2.5}L${x + 11.5} ${y + 7}L${x + 7} ${y + 11.5}L${x + 2.5} ${y + 7}Z' fill='${fg}'/>` +
    `<circle cx='${x + 7}' cy='${y + 7}' r='1.6' fill='${bg}'/>`;
  return (
    tile(0, 0, "#e6d4a8", "#8c3b25") +
    tile(14, 0, "#8c3b25", "#e6d4a8") +
    tile(0, 14, "#8c3b25", "#e6d4a8") +
    tile(14, 14, "#e6d4a8", "#8c3b25")
  );
})();

const DAMASK =
  // gold lattice of lozenges with a small flower at every crossing
  `<path d='M14 0L28 14L14 28L0 14Z' fill='none' stroke='#d4a93c' stroke-width='1.4'/>` +
  `<path d='M14 5L23 14L14 23L5 14Z' fill='rgba(212,169,60,0.22)' stroke='#d4a93c' stroke-width='.8'/>` +
  `<circle cx='14' cy='14' r='2.2' fill='#d4a93c'/>` +
  [
    [0, 0],
    [28, 0],
    [0, 28],
    [28, 28],
  ]
    .map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2' fill='#d4a93c'/>`)
    .join("");

export const MEDIEVAL_TEXTURES = {
  flagstone_dark: floor(t("Lastre scure"), FLAGSTONE_DARK, 56, "#5a5754"),
  flagstone_moss: floor(t("Pietra muschiosa"), FLAGSTONE_MOSS, 56, "#7f8077"),
  cracked_stone: floor(t("Pietra incrinata"), CRACKED, 56, "#b9b5aa"),
  checker_stone: floor(t("Scacchiera di pietra"), CHECKER_STONE, 56, "#6b6e73"),
  runes: floor(t("Pietra con rune"), RUNES, 56, "#323946"),
  dirt: floor(t("Terra battuta"), DIRT, 28, "#8d6e49"),
  mud: floor(t("Fango"), MUD, 56, "#5f4730"),
  straw: floor(t("Paglia"), STRAW, 28, "#d8b24f"),
  moss: floor(t("Muschio"), MOSS_GROUND, 28, "#5d7f3a"),
  forest: floor(t("Sottobosco"), FOREST_FLOOR, 28, "#4c5a2c"),
  ossuary: floor(t("Ossario"), OSSUARY, 56, "#3a332d"),
  snow: floor(t("Neve"), SNOW, 28, "#eef3f8"),
  rough_planks: floor(
    t("Assi grezze"),
    boards(79, "#6a4a2c", "rgba(25,12,4,0.75)", "rgba(255,225,170,0.22)", "rgba(25,12,4,0.55)"),
    28,
    "#6a4a2c"
  ),
  bridge: floor(t("Assi del ponte"), BRIDGE, 28, "#7d5731", 0.2),
  herringbone: floor(t("Mattoni a intreccio"), HERRINGBONE, 28, "#a14a33"),
  encaustic: floor(t("Piastrelle decorate"), ENCAUSTIC, 28, "#e6d4a8"),
  damask: floor(t("Damasco rosso"), DAMASK, 28, "#7a1f2b", 0.2),
};
