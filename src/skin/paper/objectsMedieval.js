// Paper-cut artwork for the medieval / dark-fantasy props (viewBox 0 0 64 64,
// same recipe as objects.js: a stack of flat "cut paper" layers, each with a
// soft shadow under it). Merged into OBJECT_ART / EDGE_ART there.
import { SHADOW_FILTER_ID } from "./defs.js";

const L = (shape, fill, dy = 2) =>
  `<g><g transform="translate(0 ${dy})" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})">${shape}</g><g fill="${fill}">${shape}</g></g>`;

const WOOD = "#8a5a3a";
const WOOD_L = "#c98a52";
const IRON = "#4b5563";
const IRON_L = "#8b93a3";
const STEEL = "#cfd5dd";
const STONE = "#9d998e";
const STONE_L = "#c4bfb1";
const GOLD = "#e8b84a";
const RED = "#a8323a";
const CREAM = "#f3ead6";

const flame = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -9C4 -4 5 0 0 3C-5 0 -4 -4 0 -9Z" fill="#e8622f"/><path d="M0 -5C2.4 -2 2.6 0 0 2C-2.6 0 -2.4 -2 0 -5Z" fill="#ffd45e"/></g>`;

export const MEDIEVAL_OBJECT_ART = {
  // ---- low / flat: a person can stand on these
  bed:
    L(`<rect x="7" y="7" width="50" height="52" rx="5"/>`, WOOD) +
    L(`<rect x="11" y="11" width="42" height="44" rx="3"/>`, CREAM, 1) +
    L(`<rect x="15" y="14" width="34" height="11" rx="5"/>`, "#fffaf0", 1) +
    L(`<path d="M11 31H53V52a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3Z"/>`, RED, 1) +
    L(`<rect x="11" y="31" width="42" height="6"/>`, "#c9525a", 0.5),
  bench:
    L(`<rect x="4" y="20" width="56" height="16" rx="4"/>`, "#a8683a") +
    L(`<rect x="7" y="22" width="50" height="11" rx="3"/>`, WOOD_L, 1.2) +
    `<path d="M20 22.5V32.5M34 22.5V32.5M46 22.5V32.5" stroke="rgba(60,30,10,.28)" stroke-width="1.2"/>` +
    L(`<rect x="9" y="36" width="7" height="20" rx="2"/><rect x="48" y="36" width="7" height="20" rx="2"/>`, "#6f4f3a", 1),
  throne:
    L(`<path d="M14 8a6 6 0 0 1 6-5h24a6 6 0 0 1 6 5V42H14Z"/>`, WOOD) +
    L(`<path d="M19 9a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3V40H19Z"/>`, RED, 1.2) +
    L(`<rect x="8" y="34" width="48" height="16" rx="5"/>`, GOLD) +
    L(`<rect x="14" y="30" width="36" height="14" rx="4"/>`, "#c9525a", 1) +
    L(`<rect x="12" y="50" width="8" height="9" rx="2"/><rect x="44" y="50" width="8" height="9" rx="2"/>`, "#6f4f3a", 1) +
    `<circle cx="16.5" cy="6" r="3.2" fill="${GOLD}"/><circle cx="47.5" cy="6" r="3.2" fill="${GOLD}"/>` +
    `<path d="M26 18l3 6 3-8 3 8 3-6v9H26Z" fill="${GOLD}"/>`,
  bearskin:
    L(
      `<ellipse cx="14" cy="22" rx="7" ry="9"/><ellipse cx="50" cy="22" rx="7" ry="9"/><ellipse cx="14" cy="48" rx="8" ry="9"/><ellipse cx="50" cy="48" rx="8" ry="9"/>`,
      "#6b4026"
    ) +
    L(`<ellipse cx="32" cy="38" rx="20" ry="22"/>`, "#7a4a2b") +
    L(`<ellipse cx="32" cy="40" rx="14" ry="16"/>`, "#93603a", 1) +
    L(`<circle cx="22" cy="8" r="4.5"/><circle cx="42" cy="8" r="4.5"/>`, "#6b4026", 1) +
    L(`<circle cx="32" cy="14" r="11"/>`, "#7a4a2b", 1.5) +
    `<ellipse cx="32" cy="19" rx="6" ry="4.4" fill="#d9b48a"/><ellipse cx="32" cy="17.2" rx="2.4" ry="1.7" fill="#2b2622"/>` +
    `<path d="M26.5 21.5Q32 27.5 37.5 21.5Q32 23.4 26.5 21.5Z" fill="#a8323a"/><path d="M28.4 22.2l1-2.2 1 2.4M33.6 22.4l1-2.4 1 2.2" fill="#fffaf0"/>` +
    `<path d="M24.5 9.6l4 1.8M39.5 9.6l-4 1.8" stroke="#2b2622" stroke-width="1.8" stroke-linecap="round"/><circle cx="27" cy="12" r="1.5" fill="#2b2622"/><circle cx="37" cy="12" r="1.5" fill="#2b2622"/>`,
  pallet:
    L(`<rect x="6" y="14" width="52" height="38" rx="9"/>`, "#b8902a") +
    L(`<rect x="10" y="18" width="44" height="30" rx="6"/>`, "#e6c565", 1.2) +
    `<path d="M16 24l9 3M30 22l8 5M42 26l7 2M14 34l10-2M28 36l9 4M40 40l9-3M18 42l8 2" stroke="#b8902a" stroke-width="1.6" stroke-linecap="round"/>` +
    L(`<rect x="8" y="16" width="16" height="12" rx="5"/>`, "#8b93a3", 1),
  // ---- furniture and props that block the cell
  barrel:
    L(`<path d="M16 8C8 20 8 42 16 56H48C56 42 56 20 48 8Z"/>`, "#a8683a") +
    L(`<path d="M20 10C14 22 14 42 20 54H44C50 42 50 22 44 10Z"/>`, WOOD_L, 1) +
    `<path d="M26 10V54M32 9V55M38 10V54" stroke="rgba(60,30,10,.28)" stroke-width="1.2"/>` +
    L(`<path d="M11 19H53V24H11ZM9.5 40H54.5V45H9.5Z"/>`, IRON, 1) +
    L(`<ellipse cx="32" cy="9" rx="16" ry="5"/>`, "#d9985b", 1),
  chest:
    L(`<rect x="7" y="28" width="50" height="27" rx="3"/>`, "#7a4a2b") +
    L(`<path d="M7 30C7 12 57 12 57 30Z"/>`, WOOD_L, 1.4) +
    L(`<rect x="7" y="28" width="50" height="5"/>`, IRON, 0.8) +
    L(`<rect x="13" y="16" width="5" height="39"/><rect x="46" y="16" width="5" height="39"/>`, IRON, 0.8) +
    L(`<rect x="27" y="28" width="10" height="12" rx="2"/>`, GOLD, 0.8) +
    `<circle cx="32" cy="33" r="1.8" fill="#3b3028"/><rect x="31.2" y="33" width="1.6" height="4" fill="#3b3028"/>`,
  fireplace:
    L(`<rect x="5" y="6" width="54" height="52" rx="3"/>`, "#8d897f") +
    L(`<rect x="3" y="6" width="58" height="9" rx="2"/>`, STONE_L, 1.2) +
    `<path d="M5 24H59M5 36H59M5 48H59M17 15V24M41 15V24M29 24V36M9 36V48M49 36V48" stroke="rgba(40,35,30,.35)" stroke-width="1.2"/>` +
    L(`<path d="M15 58V32C15 22 49 22 49 32V58Z"/>`, "#2a2522", 1) +
    L(`<path d="M20 55H44L42 49H22Z"/>`, "#6f4f3a", 1) +
    flame(32, 46, 1.9) +
    flame(24, 50, 1.1) +
    flame(40, 50, 1.1),
  anvil:
    L(`<path d="M3 20Q16 21 21 16H57V29H22Q15 27 3 20Z"/>`, "#6b7280") +
    L(`<path d="M23 29H52L47 37V43H28V37Z"/>`, IRON, 1.4) +
    L(`<rect x="16" y="43" width="40" height="12" rx="2"/>`, "#374151", 1.4) +
    `<rect x="23" y="17.4" width="32" height="2.2" rx="1" fill="rgba(255,255,255,.35)"/>` +
    L(`<rect x="3" y="47" width="10" height="8" rx="1"/>`, "#6f4f3a", 1) +
    `<path d="M58 8l2 3 3-1-2 3 2 3-3-1-2 3-1-3-3-1 3-1Z" fill="#ffd45e"/>`,
  altar:
    L(`<rect x="6" y="30" width="52" height="27" rx="3"/>`, "#8d897f") +
    L(`<rect x="4" y="26" width="56" height="9" rx="2"/>`, STONE_L, 1.2) +
    L(`<path d="M10 33H54V48L50 45L46 49L42 45L38 49L34 45L30 49L26 45L22 49L18 45L14 49L10 46Z"/>`, "#fffaf0", 1) +
    `<rect x="10" y="33" width="44" height="3" fill="${GOLD}"/>` +
    L(`<rect x="11" y="13" width="7" height="15" rx="1.5"/><rect x="46" y="13" width="7" height="15" rx="1.5"/>`, CREAM, 1) +
    flame(14.5, 10, 0.8) +
    flame(49.5, 10, 0.8) +
    L(
      `<path d="M26 14H38L37 20Q32 25 27 20Z"/><rect x="30.6" y="22" width="2.8" height="5"/><rect x="27" y="26" width="10" height="2.2" rx="1"/>`,
      GOLD,
      1
    ),
  statue:
    L(`<rect x="14" y="48" width="36" height="10" rx="2"/>`, STONE) +
    L(`<rect x="18" y="42" width="28" height="8" rx="2"/>`, STONE_L, 1) +
    L(`<path d="M21 44L25 21H39L43 44Z"/>`, "#d6d2c6", 1.4) +
    L(`<circle cx="32" cy="13" r="7"/>`, "#e3dfd3", 1.4) +
    L(`<rect x="44" y="9" width="3.4" height="34" rx="1"/><rect x="39" y="16" width="13" height="3" rx="1"/>`, STEEL, 1) +
    `<path d="M26 28L38 28M25 33L39 33" stroke="rgba(120,115,100,.4)" stroke-width="1.2"/>`,
  armor:
    L(`<rect x="14" y="55" width="36" height="5" rx="2"/>`, "#6f4f3a", 1) +
    L(`<path d="M22 52L24 36H40L42 52Z"/>`, "#8b93a3", 1.2) +
    L(`<path d="M16 30Q16 24 24 26L25 38L18 38Z"/><path d="M48 30Q48 24 40 26L39 38L46 38Z"/>`, STEEL, 1) +
    L(`<path d="M22 24Q32 20 42 24L40 40H24Z"/>`, "#aab2bd", 1.4) +
    `<path d="M32 26V40M26 31H38" stroke="rgba(60,70,85,.4)" stroke-width="1.4"/>` +
    L(`<path d="M23 15a9 9 0 0 1 18 0V26H23Z"/>`, STEEL, 1.4) +
    `<rect x="25" y="14" width="14" height="3.4" rx="1.4" fill="#2b2d35"/><rect x="31" y="14" width="2" height="12" fill="rgba(60,70,85,.45)"/>` +
    `<path d="M32 6C26 -2 20 2 22 8C26 5 30 6 32 6Z" fill="#c0392b"/>`,
  weapon_rack:
    L(`<rect x="6" y="9" width="52" height="5" rx="2"/><rect x="6" y="49" width="52" height="5" rx="2"/>`, WOOD) +
    L(`<rect x="9" y="9" width="5" height="45" rx="2"/><rect x="50" y="9" width="5" height="45" rx="2"/>`, "#6f4f3a", 1) +
    L(`<path d="M20 5L23 10V37H17V10Z"/>`, STEEL, 1) +
    L(`<rect x="14" y="37" width="12" height="3" rx="1"/><rect x="18.4" y="40" width="3.2" height="12" rx="1"/>`, GOLD, 1) +
    L(`<path d="M33 3L38 15H28Z"/><rect x="31.6" y="14" width="2.8" height="43" rx="1"/>`, IRON_L, 1) +
    L(`<path d="M46 14Q58 12 58 26Q52 22 46 23Z"/><rect x="44.8" y="12" width="2.8" height="43" rx="1"/>`, IRON_L, 1),
  cauldron:
    flame(20, 52, 1.1) +
    flame(32, 52, 1.5) +
    flame(44, 52, 1.1) +
    L(`<rect x="14" y="48" width="36" height="5" rx="2"/>`, "#6f4f3a", 1) +
    L(`<path d="M10 24C10 56 54 56 54 24Z"/>`, "#2b2d35", 1.5) +
    L(`<ellipse cx="32" cy="24" rx="22" ry="6"/>`, "#4b4f5c", 1) +
    L(`<ellipse cx="32" cy="24" rx="18" ry="4.2"/>`, "#7ac04a", 0.6) +
    `<circle cx="24" cy="23" r="2.6" fill="#b6e87e"/><circle cx="35" cy="25" r="3" fill="#b6e87e"/><circle cx="41" cy="22" r="1.8" fill="#b6e87e"/><circle cx="29" cy="17" r="2" fill="rgba(182,232,126,.7)"/><circle cx="37" cy="14" r="1.4" fill="rgba(182,232,126,.6)"/>` +
    `<path d="M10 28C4 28 4 38 10 38M54 28C60 28 60 38 54 38" stroke="#2b2d35" stroke-width="3" fill="none"/>`,
  well:
    L(`<circle cx="32" cy="32" r="26"/>`, "#8d897f") +
    L(`<circle cx="32" cy="32" r="20"/>`, STONE_L, 1.2) +
    `<path d="M32 6V14M32 50V58M6 32H14M50 32H58M13.6 13.6L19.3 19.3M44.7 44.7L50.4 50.4M50.4 13.6L44.7 19.3M19.3 44.7L13.6 50.4" stroke="rgba(60,55,45,.45)" stroke-width="1.4"/>` +
    L(`<circle cx="32" cy="32" r="14"/>`, "#44413b", 1) +
    L(`<circle cx="32" cy="32" r="12"/>`, "#3f7fb0", 0.6) +
    `<circle cx="32" cy="32" r="8" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/><circle cx="32" cy="32" r="4" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>` +
    L(`<rect x="29" y="2" width="6" height="12" rx="2"/>`, WOOD, 1),
  cart:
    L(`<path d="M2 36L14 32V36L2 40Z"/>`, "#6f4f3a", 1) +
    L(`<path d="M10 22H56L52 42H14Z"/>`, WOOD, 1.4) +
    L(`<path d="M12 24H54L51 40H15Z"/>`, WOOD_L, 1) +
    `<path d="M20 24V40M28 24V40M36 24V40M44 24V40" stroke="rgba(60,30,10,.3)" stroke-width="1.2"/>` +
    L(`<path d="M16 22Q22 8 32 12Q40 6 48 20Z"/>`, "#e6c565", 1) +
    L(`<circle cx="34" cy="46" r="12"/>`, "#6f4f3a", 1.4) +
    L(`<circle cx="34" cy="46" r="9"/>`, WOOD_L, 0.8) +
    `<path d="M34 37V55M25 46H43M27.6 39.6L40.4 52.4M40.4 39.6L27.6 52.4" stroke="#6f4f3a" stroke-width="2"/><circle cx="34" cy="46" r="3" fill="#3b3028"/>`,
  sarcophagus:
    L(`<rect x="12" y="3" width="40" height="58" rx="11"/>`, "#8d897f") +
    L(`<rect x="17" y="8" width="30" height="48" rx="8"/>`, "#b5b1a5", 1.4) +
    L(`<circle cx="32" cy="19" r="5.5"/>`, "#d6d2c6", 1) +
    `<path d="M32 26V50M23 33H41" stroke="#7a766b" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M20 12h24M20 52h24" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>`,
  lectern:
    L(`<rect x="29" y="28" width="6" height="26" rx="2"/>`, "#6f4f3a", 1) +
    L(`<path d="M20 58L24 51H40L44 58Z"/>`, WOOD, 1) +
    L(`<path d="M8 10H56L48 33H16Z"/>`, WOOD, 1.4) +
    L(`<path d="M11 12L31 14V30L17 29Z"/><path d="M53 12L33 14V30L47 29Z"/>`, "#fffaf0", 1) +
    `<path d="M16 17L28 18.4M16 21L28 22.4M16 25L28 26.4M48 17L36 18.4M48 21L36 22.4M48 25L36 26.4" stroke="#9a8f78" stroke-width="1.1"/>` +
    `<path d="M32 14V34" stroke="${RED}" stroke-width="2.4"/>`,
  banner:
    L(`<rect x="29.6" y="4" width="4.8" height="54" rx="2"/>`, "#6f4f3a", 1) +
    L(`<rect x="12" y="9" width="40" height="4" rx="2"/>`, WOOD, 1) +
    L(`<path d="M16 13H48V48L32 39L16 48Z"/>`, RED, 1.6) +
    `<path d="M16 13H48V17H16Z" fill="rgba(255,255,255,.18)"/>` +
    `<path d="M19 44V16M45 44V16" stroke="${GOLD}" stroke-width="1.6"/>` +
    `<path d="M32 17l3.2 6.8 7.4 1-5.4 5.2 1.3 7.4L32 33.8 25.5 37.4l1.3-7.4-5.4-5.2 7.4-1Z" fill="${GOLD}"/>` +
    `<circle cx="32" cy="5" r="3.4" fill="${GOLD}"/><circle cx="14" cy="11" r="2.6" fill="${GOLD}"/><circle cx="50" cy="11" r="2.6" fill="${GOLD}"/>`,
  candelabrum:
    `<circle cx="32" cy="20" r="19" fill="rgba(255,236,150,.4)"/>` +
    L(`<ellipse cx="32" cy="56" rx="14" ry="4.5"/>`, "#a8832a", 1) +
    L(`<rect x="29.5" y="24" width="5" height="32" rx="2"/>`, GOLD, 1) +
    L(`<path d="M10 20Q12 36 32 36Q52 36 54 20L50 20Q48 31 32 31Q16 31 14 20Z"/>`, GOLD, 1) +
    L(
      `<rect x="8" y="12" width="7" height="12" rx="1.6"/><rect x="28.5" y="9" width="7" height="14" rx="1.6"/><rect x="49" y="12" width="7" height="12" rx="1.6"/>`,
      CREAM,
      1
    ) +
    flame(11.5, 11, 0.7) +
    flame(32, 8, 0.8) +
    flame(52.5, 11, 0.7),
  cage:
    L(`<circle cx="32" cy="6" r="4"/>`, IRON, 1) +
    L(`<path d="M13 56V26C13 6 51 6 51 26V56Z"/>`, "#2f3440", 1.4) +
    L(`<path d="M17 52V26C17 11 47 11 47 26V52Z"/>`, "#e8e0cb", 0.5) +
    `<ellipse cx="32" cy="42" rx="7" ry="6" fill="#c9c3ad"/><circle cx="29.6" cy="41" r="1.6" fill="#2b2622"/><circle cx="34.4" cy="41" r="1.6" fill="#2b2622"/>` +
    `<path d="M20 12V54M26 9V54M32 8V54M38 9V54M44 12V54" stroke="${IRON_L}" stroke-width="2.6"/>` +
    `<rect x="12" y="24" width="40" height="3.4" fill="${IRON_L}"/><rect x="11" y="52" width="42" height="5" rx="2" fill="${IRON}"/>`,
  gravestone:
    L(`<ellipse cx="32" cy="55" rx="26" ry="6"/>`, "#6f5236", 1) +
    L(`<path d="M16 56V24a16 16 0 0 1 32 0V56Z"/>`, "#aeb0aa", 1.6) +
    L(`<path d="M20 56V25a12 12 0 0 1 24 0V56Z"/>`, "#c5c7c0", 0.8) +
    `<path d="M32 17V40M25 24H39" stroke="#6f7068" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M18 52l-3-5M22 54l-1-5M44 53l2-5M48 51l3-4" stroke="#5f8a3c" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="46" rx="5" ry="2.4" fill="#7aa84c" opacity=".8"/>`,
  // edge types: the full-size icon (palette); the thin strip is in MEDIEVAL_EDGE_ART
  portcullis:
    L(`<path d="M6 60V28a26 26 0 0 1 52 0V60Z"/>`, "#8d897f") +
    L(`<path d="M12 60V30a20 20 0 0 1 40 0V60Z"/>`, "#2f3440", 1) +
    `<path d="M20 16V60M26 12V60M32 11V60M38 12V60M44 16V60" stroke="${IRON_L}" stroke-width="3"/>` +
    `<path d="M12 30H52M12 44H52" stroke="${IRON_L}" stroke-width="2.4"/>` +
    `<path d="M20 60l0-4 0 0M20 58l3 5M26 58l3 5M32 58l3 5M38 58l3 5M44 58l3 5" stroke="${IRON_L}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M2 62H62" stroke="rgba(60,55,45,.4)" stroke-width="2"/>`,
  arrow_slit:
    L(`<rect x="8" y="4" width="48" height="56" rx="4"/>`, "#8d897f") +
    `<path d="M8 18H56M8 32H56M8 46H56M22 4V18M42 4V18M14 18V32M34 18V32M52 18V32M22 32V46M42 32V46M14 46V60M34 46V60M52 46V60" stroke="rgba(40,35,30,.35)" stroke-width="1.3"/>` +
    L(`<rect x="28" y="12" width="8" height="40" rx="4"/>`, "#26262b", 1) +
    `<rect x="30.4" y="16" width="3.2" height="32" rx="1.6" fill="#ffd98a"/><rect x="22" y="29" width="20" height="3.4" rx="1.7" fill="#26262b"/><rect x="22.8" y="29.8" width="18.4" height="1.8" rx=".9" fill="#ffd98a"/>`,
  crystal_ball:
    L(`<path d="M16 59H48L43 47H21Z"/>`, "#4a3a66", 1) +
    L(`<ellipse cx="32" cy="47" rx="14" ry="4"/>`, "#6a5590", 0.8) +
    L(`<circle cx="32" cy="29" r="19"/>`, "#8d78d8", 1.5) +
    `<circle cx="32" cy="29" r="15.5" fill="#c4b5f7"/><path d="M20 33Q28 20 38 27T46 36" stroke="rgba(255,255,255,.55)" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M24 20Q27 15 33 15" stroke="rgba(255,255,255,.9)" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M36 33l1.2 2.6 2.6 1.2-2.6 1.2L36 40.6l-1.2-2.6-2.6-1.2 2.6-1.2Z" fill="#fff6c8"/><circle cx="26" cy="35" r="1.3" fill="#fff6c8"/>`,
};

// Edge pieces (viewBox 0 0 64 16, drawn horizontally; CSS rotates them for E/W).
export const MEDIEVAL_EDGE_ART = {
  portcullis:
    L(`<rect x="2" y="2" width="60" height="12" rx="2.5"/>`, "#2f3440", 1.2) +
    `<path d="M8 3V13M16 3V13M24 3V13M32 3V13M40 3V13M48 3V13M56 3V13" stroke="${IRON_L}" stroke-width="2.2"/>` +
    `<path d="M3 6H61M3 10.5H61" stroke="${IRON_L}" stroke-width="1.6"/>` +
    `<path d="M8 13.4l1.4 2.4 1.4-2.4M24 13.4l1.4 2.4 1.4-2.4M40 13.4l1.4 2.4 1.4-2.4M56 13.4l1.4 2.4 1.4-2.4" fill="${IRON_L}"/>`,
  arrow_slit:
    L(`<rect x="2" y="2" width="60" height="12" rx="3.5"/>`, "#8d897f", 1.2) +
    `<path d="M5 5.5H59M5 10.5H59" stroke="rgba(40,35,30,.3)" stroke-width="1"/>` +
    `<rect x="12" y="6.2" width="40" height="3.6" rx="1.8" fill="#26262b"/>` +
    `<rect x="14" y="7.2" width="36" height="1.4" rx=".7" fill="#ffd98a"/>`,
};
