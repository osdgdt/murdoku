// Paper-cut portraits of the cast (viewBox 0 0 64 64): a die-cut sticker with a
// white edge, a body in the character's own color (currentColor — callers set
// `color` on the wrapper) and a head whose hair / headgear tells every
// character apart without relying on color. To restyle the cast, replace the
// strings here (or swap the module for another skin).
import { SHADOW_FILTER_ID } from "./defs.js";

const INK = "#3b3028";
const STICKER = "M32 3C46 3 50 20 47 28 56 32 61 44 62 62H2C3 44 8 32 17 28 14 20 18 3 32 3Z";
const BODY = "M32 40C45 40 55 46 57 59L7 59C9 46 19 40 32 40Z";

const frame = (
  art,
  { body = "currentColor", skin = "#fbd9b8", back = "", front = "", trim = "", face = true } = {}
) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="${STICKER}" transform="translate(0 2)" fill="rgba(40,25,10,.35)" filter="url(#${SHADOW_FILTER_ID})"/>
  <path d="${STICKER}" fill="#fffaf0"/>
  ${back}
  <path d="${BODY}" fill="${body}"/><path d="M32 40C26 41 14 46 13 55 9 49 17 41 32 40Z" fill="rgba(255,255,255,.2)"/>
  <rect x="28" y="35" width="8" height="8" rx="2" fill="${skin}"/><path d="M28 39H36" stroke="rgba(0,0,0,.12)" stroke-width="3"/>
  ${trim}
  <circle cx="32" cy="26" r="12.5" fill="${skin}"/>
  ${face ? `<circle cx="27.5" cy="27" r="1.7" fill="${INK}"/><circle cx="36.5" cy="27" r="1.7" fill="${INK}"/><path d="M28.5 32Q32 35 35.5 32" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="23.5" cy="30" r="2.4" fill="#ff8f8f" opacity=".35"/><circle cx="40.5" cy="30" r="2.4" fill="#ff8f8f" opacity=".35"/>` : ""}
  ${front}${art}
</svg>`;

export const CHARACTER_ART = {
  person1: frame(``, {
    back: ``,
    front: `<path d="M19.5 25C19 13 27 9 32 9s13 4 12.5 16c-2-6-6-8-12.5-8s-10.5 2-12.5 8Z" fill="#5b3a29"/>`,
  }),
  person2: frame(``, {
    skin: "#f0c29a",
    back: `<path d="M17 27C15 12 24 8 32 8s17 4 15 19c0 10 2 16 4 20H13c2-4 4-10 4-20Z" fill="#7a3b2a"/>`,
    front: `<path d="M19.5 24C22 14 42 14 44.5 24 40 19 24 19 19.5 24Z" fill="#7a3b2a"/>`,
  }),
  // "Cronista": newsboy cap with a press card in the band
  hat: frame(
    `<path d="M18 21C18 11 26 8 32 8s14 3 14 13Z" fill="#8a7a5a"/><path d="M16 21H48C47 25 43 25 40 24H20C17 25 16 23 16 21Z" fill="#6f6048"/><rect x="38" y="13" width="7" height="5" rx="1" fill="#fffaf0"/>`,
    { skin: "#e3b088" }
  ),
  // "Studioso/a": silver bun and round glasses
  glasses: frame(
    `<g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="27.5" cy="27" r="4.6"/><circle cx="36.5" cy="27" r="4.6"/><path d="M32 27h0"/></g>`,
    {
      back: `<circle cx="32" cy="8" r="5.5" fill="#c9c9d1"/>`,
      front: `<path d="M19.5 25C19 13 27 12 32 12s13 1 12.5 13c-2-6-6-8-12.5-8s-10.5 2-12.5 8Z" fill="#c9c9d1"/>`,
    }
  ),
  detective: frame(
    `<path d="M21 19C21 8 43 8 43 19Z" fill="#8a6a45"/><ellipse cx="32" cy="19" rx="18" ry="4" fill="#6f5233"/><path d="M21 17H43" stroke="#3b2b1e" stroke-width="2.4"/><path d="M28 33Q32 31 36 33" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    { skin: "#e9b98e" }
  ),
  butler: frame(`<path d="M26 40L32 48 38 40Z" fill="#fffaf0"/><path d="M28 43L32 41 36 43 32 45Z" fill="#c0392b"/>`, {
    front: `<path d="M19.5 24C19 12 27 10 32 10s13 2 12.5 14C41 18 23 18 19.5 24Z" fill="#2a2a35"/>`,
  }),
  chef: frame(
    `<path d="M20 19v-3a7 7 0 0 1 4-12 7 7 0 0 1 8-2 7 7 0 0 1 8 2 7 7 0 0 1 4 12v3Z" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1"/><rect x="20" y="17" width="24" height="5" rx="2" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1"/>`
  ),
  maid: frame(
    `<path d="M20 15C22 9 42 9 44 15L44 20C40 17 24 17 20 20Z" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1"/><circle cx="25" cy="14.5" r="1.4" fill="#d8cfbd"/><circle cx="32" cy="12.5" r="1.4" fill="#d8cfbd"/><circle cx="39" cy="14.5" r="1.4" fill="#d8cfbd"/><path d="M26 43H38L40 59H24Z" fill="#fffaf0"/>`,
    { back: `<circle cx="18" cy="30" r="5" fill="#4b2e26"/><circle cx="46" cy="30" r="5" fill="#4b2e26"/>` }
  ),
  gardener: frame(
    `<ellipse cx="32" cy="18" rx="23" ry="5" fill="#e3c36a"/><path d="M21 18C21 7 43 7 43 18Z" fill="#efd47f"/><path d="M21 16H43" stroke="#5aa05a" stroke-width="3"/>`,
    { skin: "#c68863" }
  ),
  driver: frame(
    `<path d="M19 20C19 9 45 9 45 20Z" fill="#33415c"/><path d="M18 20H46L44 24H20Z" fill="#26314a"/><circle cx="32" cy="14.5" r="2.6" fill="#f2c14e"/>`,
    { skin: "#e9b98e" }
  ),
  professor: frame(
    `<path d="M12 15L32 6 52 15 32 24Z" fill="#2c2f3f"/><path d="M50 16V26" stroke="#f2c14e" stroke-width="2"/><circle cx="50" cy="27" r="2" fill="#f2c14e"/>`,
    { front: `<path d="M20 31C20 43 44 43 44 31 40 36 24 36 20 31Z" fill="#e9e9ee"/>`, face: true }
  ),
  artist: frame(`<path d="M16 18C14 8 34 4 46 10 48 14 44 18 40 18Z" fill="#e0453a"/><circle cx="44" cy="8" r="2.4" fill="#e0453a"/>`, {
    skin: "#8d5a3b",
    back: `<circle cx="18" cy="26" r="5" fill="#2a1d18"/><circle cx="46" cy="26" r="5" fill="#2a1d18"/><circle cx="20" cy="20" r="4" fill="#2a1d18"/><circle cx="44" cy="20" r="4" fill="#2a1d18"/>`,
  }),
  // The victim: greyed out, X eyes, a little halo
  victim: frame(
    `<ellipse cx="32" cy="8.5" rx="10" ry="3.2" fill="none" stroke="#f2c14e" stroke-width="2"/><path d="M23 22l7 7m0-7l-7 7M34 22l7 7m0-7l-7 7" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M28 33.5H36" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
    { body: "#b9b4a8", skin: "#e7e1d6", face: false }
  ),
};

// --- The wider cast ----------------------------------------------------------
// More professions, built on the same sticker frame as the originals so they
// stay one family: the body is always the character's own color (currentColor);
// everything that tells the jobs apart — hair, headgear, outfit trim and a
// prop — is flat colored paper in its own colors. Parts are small functions;
// each entry below just picks which ones to combine.
const SK = { fair: "#fbd9b8", light: "#fde6cf", tan: "#e9b98e", warm: "#f0c29a", deep: "#8d5a3b", pale: "#f1e6dc" };
const HC = {
  brown: "#5b3a29",
  black: "#2a2a35",
  auburn: "#7a3b2a",
  gray: "#c9c9d1",
  blond: "#e3b858",
  red: "#c0522d",
  white: "#eeeae0",
  dark: "#3a2a1f",
};

const WHITE = "#fffaf0";
const GOLD = "#e8b84a";
const circles = (list, fill) => `<g fill="${fill}">${list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`;

// Hair: `back` is drawn behind the head (over the body), `front` over it.
const HAIR = {
  bald: () => ({}),
  short: (c) => ({ front: `<path d="M19.5 25C19 13 27 9 32 9s13 4 12.5 16c-2-6-6-8-12.5-8s-10.5 2-12.5 8Z" fill="${c}"/>` }),
  long: (c) => ({
    back: `<path d="M17 27C15 12 24 8 32 8s17 4 15 19c0 10 2 16 4 20H13c2-4 4-10 4-20Z" fill="${c}"/>`,
    front: `<path d="M19.5 24C22 14 42 14 44.5 24 40 19 24 19 19.5 24Z" fill="${c}"/>`,
  }),
  bob: (c) => ({
    back: `<path d="M16.5 24C15 11 25 8 32 8s17 3 15.5 16c-.5 5 .5 9 1.5 11H15c1-2 2-6 1.5-11Z" fill="${c}"/>`,
    front: `<path d="M19 23C22 15 42 15 45 23 40 19 24 19 19 23Z" fill="${c}"/>`,
  }),
  bun: (c) => ({
    back: `<circle cx="32" cy="8" r="5.5" fill="${c}"/>`,
    front: `<path d="M19.5 25C19 13 27 12 32 12s13 1 12.5 13c-2-6-6-8-12.5-8s-10.5 2-12.5 8Z" fill="${c}"/>`,
  }),
  curly: (c) => ({
    back: circles(
      [
        [19, 23, 6],
        [45, 23, 6],
        [22, 15, 6],
        [42, 15, 6],
        [32, 11, 7],
      ],
      c
    ),
    front: `<path d="M20 24C21 17 43 17 44 24 40 20 24 20 20 24Z" fill="${c}"/>`,
  }),
  wild: (c) => ({
    back: `<path d="M15 26L11 14 21 17 22 5 29 12 32 3 36 12 43 5 43 17 53 14 49 26Z" fill="${c}"/>`,
    front: `<path d="M20 24C21 16 43 16 44 24 40 19 24 19 20 24Z" fill="${c}"/>`,
  }),
  mohawk: (c) => ({ front: `<path d="M27 16L25 6 30 10 32 2 34 10 39 6 37 16Z" fill="${c}"/>` }),
  sides: (c) => ({
    front: `<path d="M19.5 28C18.5 19 21 15 25 14 22 19 23 24 24 30ZM44.5 28C45.5 19 43 15 39 14 42 19 41 24 40 30Z" fill="${c}"/>`,
  }),
  slick: (c) => ({ front: `<path d="M19.5 25C19 12 26 10 32 16 38 10 45 12 44.5 25 40 17 24 17 19.5 25Z" fill="${c}"/>` }),
};

// Facial hair, over the face.
const FACIAL = {
  mustache: (c) => `<path d="M24.5 31.5Q28.5 28.5 32 31 35.5 28.5 39.5 31.5 35.5 33.5 32 32.5 28.5 33.5 24.5 31.5Z" fill="${c}"/>`,
  beard: (c) => `<path d="M19.5 29C19 44 45 44 44.5 29 41 36 23 36 19.5 29Z" fill="${c}"/>`,
  goatee: (c) => `<path d="M27.5 34Q32 33 36.5 34 36 40 32 41 28 40 27.5 34Z" fill="${c}"/>`,
};

const ROUND_GLASSES = `<g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="27.5" cy="27" r="4.6"/><circle cx="36.5" cy="27" r="4.6"/></g>`;
const SUNGLASSES = `<rect x="21" y="23.5" width="10.5" height="7" rx="3" fill="#1d1d22"/><rect x="32.5" y="23.5" width="10.5" height="7" rx="3" fill="#1d1d22"/><path d="M31 26h2" stroke="#1d1d22" stroke-width="1.6"/><path d="M23 25.5h4" stroke="rgba(255,255,255,.35)" stroke-width="1.2" stroke-linecap="round"/>`;

// Outfit trim, drawn between the neck and the head so collars tuck under the chin.
const collar = `<path d="M23 41L32 52 41 41 36 38.5 32 44 28 38.5Z" fill="${WHITE}"/>`;
const tie = (c) => `${collar}<path d="M29.5 44h5l-2.5 3Z" fill="${c}"/><path d="M32 47l-2.8 2.5 2 7.5h1.6l2-7.5Z" fill="${c}"/>`;
const bowtie = (c) => `<path d="M32 44.5L24.5 41v7.5ZM32 44.5L39.5 41v7.5Z" fill="${c}"/><circle cx="32" cy="44.5" r="2" fill="${c}"/>`;
const labCoat = `<path d="M32 40C24 41 14 46 12 59H26L32 48Z" fill="${WHITE}"/><path d="M32 40C40 41 50 46 52 59H38L32 48Z" fill="${WHITE}"/><path d="M32 48L26 59M32 48L38 59" stroke="rgba(0,0,0,.1)" stroke-width="1.2"/>`;
const apron = (c) =>
  `<path d="M24 46H40L43.5 59H20.5Z" fill="${c}"/><path d="M28 40.5L30 46M36 40.5L34 46" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
const stripes = (c) => `<path d="M13 49H51M10.5 54H53.5" stroke="${c}" stroke-width="2.4"/>`;
const hiVis = (c) =>
  `<path d="M24 41L21.5 59M40 41L42.5 59" stroke="${c}" stroke-width="3.4"/><path d="M12 54H52" stroke="${c}" stroke-width="2" opacity=".85"/>`;
const clerical = `<rect x="29.2" y="38.6" width="5.6" height="4.4" rx=".9" fill="${WHITE}"/>`;
const scarf = (c) => `<path d="M22 40Q32 48 42 40V45Q32 53 22 45Z" fill="${c}"/><path d="M37.5 47l5 10-5.5 1-1.5-9Z" fill="${c}"/>`;
const pearls = circles(
  [
    [24.5, 41.5, 1.7],
    [26.8, 44.3, 1.7],
    [30, 46, 1.7],
    [34, 46, 1.7],
    [37.2, 44.3, 1.7],
    [39.5, 41.5, 1.7],
  ],
  WHITE
);
const ermine = `<path d="M19.5 42Q32 55 44.5 42L47 49Q32 62 17 49Z" fill="${WHITE}"/>${circles(
  [
    [24, 49, 1.1],
    [32, 54, 1.1],
    [40, 49, 1.1],
  ],
  "#3b3028"
)}`;
const lapels = `<path d="M32 45L24 40l-3.5 19H27Z" fill="rgba(0,0,0,.16)"/><path d="M32 45L40 40l3.5 19H37Z" fill="rgba(0,0,0,.16)"/>`;
const pinstripes = `<path d="M18 50L17 59M46 50L47 59" stroke="rgba(255,255,255,.45)" stroke-width="1"/>`;
const gorget = `<path d="M22 41Q32 50 42 41V46Q32 54 22 46Z" fill="#c9ced6"/>${circles(
  [
    [13.5, 51, 5.5],
    [50.5, 51, 5.5],
  ],
  "#c9ced6"
)}${circles(
  [
    [13.5, 51, 2.2],
    [50.5, 51, 2.2],
  ],
  "#9aa3ad"
)}`;
const medals = `${circles([[21, 51, 2.3]], GOLD)}${circles([[27, 53, 2.3]], "#d9534f")}<path d="M19 45l2 4M25 47l2 4" stroke="#d9534f" stroke-width="1.6"/>`;
const hawaiian = `${circles(
  [
    [16, 50, 2.4],
    [26, 55, 2],
    [38, 50, 2.4],
    [47, 55, 2.2],
    [32, 57, 1.8],
  ],
  WHITE
)}${circles(
  [
    [22, 49, 1.5],
    [44, 49, 1.5],
    [14, 56, 1.5],
  ],
  "#ffd45e"
)}${circles(
  [
    [31, 50, 1.5],
    [52, 52, 1.4],
  ],
  "#f08fa3"
)}`;
const leather = `<path d="M32 42V59" stroke="#c9ced6" stroke-width="1.4"/>${circles(
  [
    [17, 50, 1.2],
    [21, 53, 1.2],
    [47, 50, 1.2],
    [43, 53, 1.2],
  ],
  "#c9ced6"
)}<path d="M14 47L27 43M50 47L37 43" stroke="rgba(255,255,255,.28)" stroke-width="1.6"/>`;
const nunBib = `<path d="M23 40H41L39 54H25Z" fill="${WHITE}"/><path d="M32 42v8M29 45h6" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>`;
const vampireCollar = `<path d="M17 45L22 33 29 42 32 47 35 42 42 33 47 45 32 56Z" fill="#9b2335"/><path d="M32 47L26 59M32 47L38 59" stroke="rgba(0,0,0,.25)" stroke-width="1"/>`;
const spaceRing = `<ellipse cx="32" cy="42" rx="13.5" ry="4.2" fill="#e8e8ee"/><rect x="39" y="46" width="8" height="5.5" rx="1" fill="#d9534f"/><path d="M41 48.8h4" stroke="${WHITE}" stroke-width="1.2"/>`;
const ruff = `<path d="M20.5 42.5Q23.5 37 26.5 42.5 29.5 37 32 42.5 34.5 37 37.5 42.5 40.5 37 43.5 42.5L42 48H22Z" fill="${WHITE}"/>${circles(
  [
    [22, 53, 2.1],
    [42, 53, 2.1],
    [32, 56, 2.1],
  ],
  "#f2c14e"
)}`;
const waiterNapkin = `<path d="M37 50L47 48.5 46.5 59H37Z" fill="${WHITE}"/><path d="M39 52h6" stroke="rgba(0,0,0,.1)" stroke-width="1"/>`;
const monkRope = `<path d="M12 55H52" stroke="rgba(0,0,0,.22)" stroke-width="2.4"/><path d="M34 55l3 5" stroke="#e8dfc8" stroke-width="1.6"/>`;
const farmerStraps = `<path d="M25 41L21 59M39 41L43 59" stroke="rgba(0,0,0,.22)" stroke-width="2.2"/>${circles(
  [
    [24, 48, 1.3],
    [40, 48, 1.3],
  ],
  GOLD
)}`;
const pharmCross = `<rect x="38" y="46" width="9" height="9" rx="1.6" fill="${WHITE}"/><path d="M42.5 47.6v5.8M39.6 50.5h5.8" stroke="#3fae6a" stroke-width="2.2"/>`;
const stethoscope = `<path d="M24 40Q22 53 32 53Q42 53 40 40" fill="none" stroke="#4d5560" stroke-width="2"/><circle cx="32" cy="53.5" r="2.5" fill="#c9ced6"/>`;
const badge = (c) => `<path d="M43 46l1.5 3.1 3.3.4-2.4 2.3.6 3.3L43 53.5l-3 1.6.6-3.3-2.4-2.3 3.3-.4Z" fill="${c}"/>`;

// Headgear and held props, drawn last.
const brimmed = (crown, brim, band, ry = 4) =>
  `<ellipse cx="32" cy="19" rx="19" ry="${ry}" fill="${brim}"/><path d="M21 19C21 6 43 6 43 19Z" fill="${crown}"/><path d="M21.5 16.5H42.5" stroke="${band}" stroke-width="3"/>`;
const capOf = (c, visor = "rgba(0,0,0,.28)") =>
  `<path d="M19 21C19 8 45 8 45 21Z" fill="${c}"/><path d="M16.5 21H47.5L45 25H19Z" fill="${visor}"/>`;
const crown = (gem1, gem2) =>
  `<path d="M21 19L18.5 6 26 11.5 32 3.5 38 11.5 45.5 6 43 19Z" fill="${GOLD}"/><rect x="21" y="16.5" width="22" height="4" rx="1.5" fill="#c9962f"/><circle cx="32" cy="13" r="2" fill="${gem1}"/><circle cx="25" cy="15" r="1.4" fill="${gem2}"/><circle cx="39" cy="15" r="1.4" fill="${gem2}"/>`;
const camera = `<rect x="36" y="48" width="17" height="10.5" rx="2.4" fill="#3b4256"/><rect x="40" y="45.5" width="7" height="4" rx="1.2" fill="#3b4256"/><circle cx="44.5" cy="53.2" r="3.8" fill="#8fc7e6"/><circle cx="44.5" cy="53.2" r="1.6" fill="#3b4256"/>`;
const book = (c) =>
  `<rect x="37" y="46" width="15" height="12" rx="1.6" fill="${c}"/><path d="M38.5 46v12" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/><path d="M42 50h7M42 53h5" stroke="${WHITE}" stroke-width="1.1" stroke-linecap="round"/>`;
const briefcase = `<rect x="35" y="50" width="19" height="9.5" rx="1.8" fill="#8a5a3a"/><path d="M41 50v-2.2h7V50" fill="none" stroke="#5b3a29" stroke-width="1.6"/><rect x="43.6" y="53" width="2.8" height="2.6" fill="${GOLD}"/>`;
const wrench = `<path d="M39 58L50 47" stroke="#aab2bd" stroke-width="3.2" stroke-linecap="round"/><path d="M48.5 43.5a4.2 4.2 0 1 0 4.2 4.2L50 48l-1.5-1.5Z" fill="#aab2bd"/>`;
const cocktail = `<path d="M38 46H52L45 54Z" fill="#f08fa3"/><path d="M45 54v6M41 60h8" stroke="#aab2bd" stroke-width="1.8" stroke-linecap="round"/><circle cx="49" cy="44.5" r="2" fill="#6fa86a"/>`;
const comedyMask = `<ellipse cx="45" cy="51" rx="8" ry="9.5" fill="${WHITE}" stroke="#d8cfbd"/><circle cx="42" cy="49" r="1.5" fill="${INK}"/><circle cx="48" cy="49" r="1.5" fill="${INK}"/><path d="M40.5 54Q45 59 49.5 54" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
const trayArm = `<ellipse cx="45" cy="47" rx="10" ry="2.6" fill="#c9ced6"/><path d="M40 45h10l-1-5h-8Z" fill="rgba(143,199,230,.7)"/>`;
const cigar = `<rect x="33" y="33" width="13" height="3.2" rx="1.6" fill="#8a5a3a"/><circle cx="46.5" cy="34.6" r="1.8" fill="#ff7a3d"/>`;
const fangs = `<path d="M27.5 33.5l1.8 4.6 1.8-4.6ZM32.9 33.5l1.8 4.6 1.8-4.6Z" fill="${WHITE}"/>`;
const eyepatch = `<path d="M18 22L37 31" stroke="#26262b" stroke-width="1.6"/><circle cx="27.5" cy="27" r="4.4" fill="#26262b"/>`;
const clownFace = `<circle cx="27.5" cy="27" r="1.7" fill="${INK}"/><circle cx="36.5" cy="27" r="1.7" fill="${INK}"/><circle cx="32" cy="31.5" r="3.6" fill="#e63946"/><path d="M23.5 33Q32 43 40.5 33" fill="none" stroke="#e63946" stroke-width="2.4" stroke-linecap="round"/>`;
const monocle = `<circle cx="36.5" cy="27" r="5.2" fill="none" stroke="${GOLD}" stroke-width="1.6"/><path d="M41.7 28L44 40" stroke="${GOLD}" stroke-width="1"/>`;
const pirateSkull = `<circle cx="32" cy="13.5" r="2.7" fill="${WHITE}"/><circle cx="31" cy="13" r=".6" fill="#26262b"/><circle cx="33" cy="13" r=".6" fill="#26262b"/>`;
const cross = `<path d="M44 44v13M39.5 49h9" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>`;

const person = ({
  skin = SK.fair,
  hair = ["short", HC.brown],
  facial,
  trim = "",
  hat = "",
  glasses = "",
  prop = "",
  back = "",
  body,
  face,
}) => {
  const h = HAIR[hair[0]](hair[1]);
  const fh = facial ? FACIAL[facial[0]](facial[1]) : "";
  return frame(`${hat}${glasses}${prop}`, { skin, back: `${back}${h.back || ""}`, front: `${h.front || ""}${fh}`, trim, body, face });
};

Object.assign(CHARACTER_ART, {
  doctor: person({
    hair: ["short", HC.dark],
    trim: labCoat + stethoscope,
    hat: `<rect x="19" y="19" width="26" height="3.2" rx="1.6" fill="#cfd6df"/><circle cx="32" cy="17.5" r="4.8" fill="#eef3f8" stroke="#9aa3ad" stroke-width="1"/><circle cx="32" cy="17.5" r="1.8" fill="#9aa3ad"/>`,
  }),
  nurse: person({
    skin: SK.warm,
    hair: ["bun", HC.black],
    trim: `<path d="M24 40L32 50 40 40 36 38.5 32 43 28 38.5Z" fill="${WHITE}"/>`,
    hat: `<path d="M20 20C20 10 44 10 44 20Z" fill="${WHITE}"/><rect x="19" y="18.5" width="26" height="3.4" rx="1.7" fill="#e9eef3"/><path d="M32 11.5v6M29 14.5h6" stroke="#d9534f" stroke-width="2.4" stroke-linecap="round"/>`,
    prop: stethoscope,
  }),
  police: person({
    hair: ["short", HC.dark],
    trim: collar,
    hat: `<path d="M19 19C19 9 45 9 45 19Z" fill="#2c4272"/><path d="M17 19H47L45 23.5H19Z" fill="#1f2f52"/><circle cx="32" cy="14.2" r="2.6" fill="${GOLD}"/>`,
    prop: badge(GOLD),
  }),
  judge: person({
    skin: SK.light,
    hair: ["bald", HC.gray],
    trim: `<path d="M24 40L32 54 40 40 36 38.5 32 46 28 38.5Z" fill="${WHITE}"/>`,
    back: circles(
      [
        [17, 24, 6],
        [47, 24, 6],
        [18, 33, 5],
        [46, 33, 5],
      ],
      "#f3f0ea"
    ),
    hat: `${circles(
      [
        [22, 14.5, 4.5],
        [42, 14.5, 4.5],
        [32, 11, 5],
      ],
      "#f3f0ea"
    )}<path d="M20 22C24 14 40 14 44 22 38 19 26 19 20 22Z" fill="#f3f0ea"/>`,
    prop: `<rect x="37" y="50" width="14" height="4.4" rx="1.4" fill="#8a5a3a"/><path d="M44 54.4V59" stroke="#8a5a3a" stroke-width="2.6" stroke-linecap="round"/>`,
  }),
  lawyer: person({ skin: SK.tan, hair: ["slick", HC.black], trim: tie("#8a1f2d") + lapels, glasses: ROUND_GLASSES, prop: briefcase }),
  pilot: person({
    hair: ["short", HC.brown],
    trim: scarf(WHITE),
    hat: `<path d="M18 25C18 7 46 7 46 25L42 21H22Z" fill="#8a5a3a"/><circle cx="25" cy="17" r="4.2" fill="rgba(143,199,230,.75)" stroke="${GOLD}" stroke-width="1.6"/><circle cx="39" cy="17" r="4.2" fill="rgba(143,199,230,.75)" stroke="${GOLD}" stroke-width="1.6"/><path d="M29.2 17h5.6" stroke="${GOLD}" stroke-width="1.6"/>`,
  }),
  sailor: person({
    skin: SK.tan,
    hair: ["short", HC.brown],
    facial: ["beard", HC.auburn],
    trim: stripes("#2b4c8c"),
    hat: `<path d="M20 22C20 11 44 11 44 22Z" fill="${WHITE}"/><rect x="19.5" y="18.5" width="25" height="3.6" rx="1.8" fill="#2b4c8c"/><path d="M19.5 22.5Q32 25 44.5 22.5" stroke="#d8cfbd" stroke-width="1.2" fill="none"/>`,
  }),
  firefighter: person({
    hair: ["short", HC.dark],
    facial: ["mustache", HC.dark],
    trim: hiVis("#f2c94c"),
    hat: `${capOf("#d9392f", "#a8261f")}<path d="M28 11.5h8v6.5l-4 3-4-3Z" fill="${GOLD}"/>`,
    prop: `<path d="M40 59L51 46" stroke="#8a5a3a" stroke-width="2.6" stroke-linecap="round"/><path d="M47 43l8 5-3 3-7-4Z" fill="#aab2bd"/>`,
  }),
  pharmacist: person({ skin: SK.light, hair: ["bob", HC.red], trim: labCoat, glasses: ROUND_GLASSES, prop: pharmCross }),
  bartender: person({
    skin: SK.tan,
    hair: ["slick", HC.black],
    facial: ["mustache", HC.black],
    trim: `<path d="M32 45L24 40l-4 19h8Z" fill="#3b2a2a"/><path d="M32 45L40 40l4 19h-8Z" fill="#3b2a2a"/>${bowtie("#d9534f")}`,
    prop: cocktail,
  }),
  baker: person({
    hair: ["short", HC.auburn],
    facial: ["mustache", HC.auburn],
    trim: apron("#f0e6cf"),
    hat: `<path d="M22 20L23.5 5.5Q32 3 40.5 5.5L42 20Z" fill="${WHITE}" stroke="#d8cfbd" stroke-width="1"/><rect x="21" y="17.5" width="22" height="4" rx="1.6" fill="#e9dfc8"/>`,
    prop: `<ellipse cx="45" cy="53" rx="9" ry="5" fill="#d9985b"/><path d="M39.5 51l3 4M44 50l3 5M48.5 51l2.5 3.5" stroke="#b9743a" stroke-width="1.4" stroke-linecap="round"/>`,
  }),
  butcher: person({
    skin: SK.tan,
    hair: ["short", HC.black],
    facial: ["beard", HC.dark],
    trim: stripes("#d9534f"),
    hat: `<ellipse cx="32" cy="18.5" rx="17" ry="3.4" fill="#e3c36a"/><path d="M22 18.5V11H42V18.5Z" fill="#efd47f"/><path d="M22 16.5H42" stroke="#d9534f" stroke-width="2.6"/>`,
    prop: `<path d="M38 50H51L53 58H40Z" fill="#c9ced6"/><path d="M47 50V47" stroke="#8a5a3a" stroke-width="3" stroke-linecap="round"/>`,
  }),
  mechanic: person({
    skin: SK.tan,
    hair: ["short", HC.black],
    trim: hiVis("#f2c94c"),
    hat: `<path d="M20 21C20 10 44 10 44 21Z" fill="#3e6fb0"/><path d="M32 21H51L49.5 24H34Z" fill="#2c5285"/>`,
    prop: wrench,
  }),
  musician: person({
    skin: SK.deep,
    hair: ["curly", HC.black],
    trim: `<path d="M32 42V59" stroke="${GOLD}" stroke-width="1.4"/>`,
    hat: `<path d="M19.5 27C18 7 46 7 44.5 27" fill="none" stroke="#3b4256" stroke-width="3"/><rect x="15.5" y="23" width="6" height="10" rx="2.6" fill="#d9715e"/><rect x="42.5" y="23" width="6" height="10" rx="2.6" fill="#d9715e"/>`,
    prop: `<ellipse cx="42" cy="53" rx="6.5" ry="5.5" fill="${GOLD}"/><circle cx="42" cy="53" r="2" fill="#5b3a29"/><path d="M47 49L55 42" stroke="#5b3a29" stroke-width="2.4" stroke-linecap="round"/>`,
  }),
  scientist: person({
    skin: SK.light,
    hair: ["wild", "#e9e9ee"],
    trim: labCoat,
    glasses: ROUND_GLASSES,
    prop: `<path d="M42 46h5v4l4 8H38l4-8Z" fill="rgba(143,224,210,.85)"/><path d="M41 46h7" stroke="#aab2bd" stroke-width="1.8" stroke-linecap="round"/><circle cx="44.5" cy="54" r="1.2" fill="${WHITE}"/>`,
  }),
  explorer: person({
    skin: SK.tan,
    hair: ["short", HC.brown],
    facial: ["mustache", HC.brown],
    trim: scarf("#c9a64a"),
    hat: `<ellipse cx="32" cy="21" rx="19" ry="4" fill="#c3a96f"/><path d="M19 21C19 6 45 6 45 21Z" fill="#d9c28f"/><path d="M19.5 17.5H44.5" stroke="#8a5a3a" stroke-width="2.6"/>`,
    prop: `<circle cx="41" cy="53" r="4.4" fill="#3b4256"/><circle cx="50" cy="53" r="4.4" fill="#3b4256"/><rect x="41" y="49" width="9" height="3" fill="#3b4256"/><circle cx="41" cy="53" r="2" fill="#8fc7e6"/><circle cx="50" cy="53" r="2" fill="#8fc7e6"/>`,
  }),
  priest: person({
    skin: SK.light,
    hair: ["sides", HC.gray],
    trim: clerical,
    hat: `<path d="M23 16C23 9 41 9 41 16Z" fill="#7a3b8f"/>`,
    prop: cross,
  }),
  farmer: person({
    hair: ["short", HC.red],
    facial: ["beard", HC.red],
    trim: farmerStraps,
    hat: brimmed("#efd47f", "#e3c36a", "#c0392b", 5),
    prop: `<path d="M44 59V45" stroke="#8a5a3a" stroke-width="2.6" stroke-linecap="round"/><path d="M39 46v-3M44 46v-4M49 46v-3M39 46h10" stroke="#aab2bd" stroke-width="1.8" stroke-linecap="round"/>`,
  }),
  librarian: person({
    skin: SK.light,
    hair: ["bun", HC.brown],
    trim: `<path d="M24 40L32 49 40 40Z" fill="rgba(255,255,255,.3)"/>${circles(
      [
        [32, 52, 1.2],
        [32, 56, 1.2],
      ],
      WHITE
    )}`,
    glasses: `${ROUND_GLASSES}<path d="M23 28Q19 40 24 46M41 28Q45 40 40 46" fill="none" stroke="${GOLD}" stroke-width=".9"/>`,
    prop: book("#8a1f2d"),
  }),
  photographer: person({
    skin: SK.tan,
    hair: ["short", HC.black],
    facial: ["goatee", HC.black],
    trim: `<path d="M32 40V59" stroke="rgba(0,0,0,.2)" stroke-width="1.4"/>${circles(
      [
        [22, 53, 2.3],
        [42, 53, 2.3],
      ],
      "rgba(0,0,0,.2)"
    )}`,
    hat: `<path d="M16.5 20Q32 25 47.5 20L45.5 23.5Q32 28 18.5 23.5Z" fill="#a08c5a"/><path d="M21 20C21 10 43 10 43 20Z" fill="#b9a574"/>`,
    prop: camera,
  }),
  countess: person({
    skin: SK.light,
    hair: ["long", HC.auburn],
    trim: pearls,
    hat: `<circle cx="32" cy="7.5" r="5" fill="${HC.auburn}"/><path d="M23 17l2.6-5 2.9 3.6L32 9.5l3.5 6.1 2.9-3.6L41 17Z" fill="${GOLD}"/><circle cx="32" cy="13.4" r="1.5" fill="#6ab0e0"/>`,
  }),
  pirate: person({
    skin: SK.tan,
    hair: ["short", HC.black],
    facial: ["beard", HC.black],
    trim: stripes(WHITE),
    glasses: eyepatch,
    hat: `<path d="M9 21Q32 5 55 21Q32 16 9 21Z" fill="#26262b"/><path d="M12 21Q32 12 52 21" fill="none" stroke="${GOLD}" stroke-width="1.6"/>${pirateSkull}`,
  }),
  spy: person({
    hair: ["slick", HC.black],
    trim: collar + lapels,
    glasses: SUNGLASSES,
    hat: `<ellipse cx="32" cy="19" rx="19" ry="4" fill="#2b2d35"/><path d="M21 19C21 8 43 8 43 19Z" fill="#3b3e4a"/><path d="M21.5 16.5H42.5" stroke="#8a1f2d" stroke-width="3"/>`,
  }),
  wizard: person({
    skin: SK.light,
    hair: ["long", HC.white],
    facial: ["beard", HC.white],
    trim: `<path d="M22 41Q32 50 42 41" fill="none" stroke="${GOLD}" stroke-width="2"/>${circles(
      [
        [16, 52, 1.5],
        [48, 52, 1.5],
        [24, 56, 1.2],
      ],
      GOLD
    )}`,
    hat: `<ellipse cx="32" cy="21" rx="20" ry="4.2" fill="#3a2d7d"/><path d="M17 21Q26 19 29 5Q31 2 33.5 5.5Q39 14 47 21Z" fill="#4a3a9a"/><path d="M18 19.5Q32 23 46 19.5" stroke="${GOLD}" stroke-width="2.4" fill="none"/>${circles(
      [
        [31, 11, 1.4],
        [37, 16, 1.2],
        [26, 15, 1.2],
      ],
      GOLD
    )}`,
    prop: `<path d="M47 60V44" stroke="#8a5a3a" stroke-width="2.6" stroke-linecap="round"/><circle cx="47" cy="42.5" r="3.4" fill="#8be0ff"/>`,
  }),
  cowboy: person({
    skin: SK.tan,
    hair: ["short", HC.brown],
    facial: ["mustache", HC.brown],
    trim: `<path d="M23 41L32 53 41 41 36 38.5 32 44 28 38.5Z" fill="#d9392f"/>`,
    hat: `<path d="M8 17Q9 24 22 22H42Q55 24 56 17Q48 21.5 32 21.5Q16 21.5 8 17Z" fill="#a06a3f"/><path d="M21.5 21C20 7 44 7 42.5 21Z" fill="#8a5a35"/><path d="M21 17.5H43" stroke="${GOLD}" stroke-width="2.6"/>`,
    prop: badge(GOLD),
  }),
  king: person({ skin: SK.light, hair: ["long", HC.gray], facial: ["beard", HC.gray], trim: ermine, hat: crown("#d9392f", "#4b8bd9") }),
  queen: person({ hair: ["long", HC.dark], trim: pearls, hat: crown("#8a3fb0", "#d9392f") }),
  knight: person({
    hair: ["bald", HC.brown],
    trim: gorget,
    hat: `<path fill-rule="evenodd" d="M17.5 31C15.5 5 48.5 5 46.5 31V37H17.5ZM23 19.5H41V32.5H23Z" fill="#b8c0cb"/><path d="M32 19.5V31" stroke="#9aa3ad" stroke-width="2"/><path d="M30 8Q31 -1 43 2Q36 3 34 9Z" fill="#d9392f"/>`,
  }),
  monk: person({
    hair: ["sides", HC.brown],
    trim: monkRope,
    prop: cross,
    back: `<path d="M14 40C12 12 21 6 32 6s20 6 18 34Z" fill="#7a5a3a"/>`,
  }),
  astronaut: person({
    hair: ["short", HC.black],
    trim: spaceRing,
    hat: `<circle cx="32" cy="26" r="17.5" fill="rgba(160,210,240,.22)" stroke="#e8e8ee" stroke-width="3.4"/><path d="M21 20Q24 14 31 12.5" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.2" stroke-linecap="round"/>`,
  }),
  ninja: person({
    hair: ["bald", HC.black],
    trim: `<path d="M12 56H52" stroke="#d9392f" stroke-width="3"/>`,
    hat: `<path fill-rule="evenodd" d="M17.5 23C17 7 47 7 46.5 23V39.5H17.5ZM21 21.5H43V30.5H21Z" fill="#26262b"/><path d="M44 15.5L55 20 46 24Z" fill="#d9392f"/><rect x="17.5" y="13" width="29" height="4" fill="#d9392f"/>`,
  }),
  clown: person({
    skin: "#fbf3ea",
    hair: ["curly", "#ff6b3d"],
    trim: ruff,
    hat: `<path d="M25 14L32 1.5 39 14Z" fill="#2f7de1"/><circle cx="32" cy="2.5" r="2.6" fill="#e63946"/>`,
    prop: clownFace,
    face: false,
  }),
  magician: person({
    hair: ["slick", HC.black],
    facial: ["mustache", HC.black],
    trim: bowtie("#d9392f") + lapels,
    hat: `<ellipse cx="32" cy="18.5" rx="17" ry="3.6" fill="#17171b"/><path d="M22 18.5V5.5Q32 3 42 5.5V18.5Z" fill="#26262b"/><path d="M22 15.5H42" stroke="#d9392f" stroke-width="3"/>`,
    prop: `<path d="M38 56L52 44" stroke="#17171b" stroke-width="2.6" stroke-linecap="round"/><path d="M48 47.5L52 44" stroke="${WHITE}" stroke-width="2.6" stroke-linecap="round"/><path d="M52 38v3M56 41h-3M48 38l1.4 1.8" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round"/>`,
  }),
  soldier: person({
    skin: SK.tan,
    hair: ["short", HC.black],
    trim: medals,
    hat: `<path d="M18.5 22C18.5 8 45.5 8 45.5 22Z" fill="#5b6b3a"/><path d="M18.5 22H45.5V24.5H18.5Z" fill="#4a5830"/><path d="M24 12L30 20M33 10l7 10M40 13l3 5" stroke="#6f8148" stroke-width="1.6"/>`,
    prop: badge(GOLD),
  }),
  banker: person({
    skin: SK.light,
    hair: ["sides", "#8a8d95"],
    facial: ["mustache", "#8a8d95"],
    trim: tie("#2e6b4a") + lapels,
    glasses: monocle,
    hat: `<ellipse cx="32" cy="18.5" rx="15" ry="3" fill="#202026"/><path d="M21 18.5C21 6 43 6 43 18.5Z" fill="#2c2c34"/><path d="M21.5 16H42.5" stroke="${GOLD}" stroke-width="2.4"/>`,
    prop: `<circle cx="45" cy="52" r="5.5" fill="${GOLD}"/><circle cx="45" cy="52" r="3.6" fill="none" stroke="#c9962f" stroke-width="1.4"/>`,
  }),
  actor: person({ hair: ["bob", HC.auburn], trim: bowtie("#8a1f4a"), prop: comedyMask }),
  construction: person({
    skin: SK.deep,
    hair: ["short", HC.black],
    facial: ["mustache", HC.black],
    trim: hiVis("#f6f1d0"),
    hat: `<path d="M19 21C19 8 45 8 45 21Z" fill="#f2c94c"/><rect x="29.5" y="8.5" width="5" height="12.5" fill="#d9ac1d"/><path d="M16 21H48V24.5H16Z" fill="#d9ac1d"/>`,
    prop: `<path d="M37 59L48 47" stroke="#8a5a3a" stroke-width="2.6" stroke-linecap="round"/><rect x="44" y="41.5" width="11" height="6" rx="1.4" transform="rotate(-18 49 44)" fill="#aab2bd"/>`,
  }),
  tourist: person({
    skin: SK.light,
    hair: ["short", HC.blond],
    trim: hawaiian,
    hat: `<ellipse cx="32" cy="18.5" rx="22" ry="5" fill="#f1e3a8"/><path d="M21 18.5C21 7 43 7 43 18.5Z" fill="#f7eec2"/><path d="M21.5 16H42.5" stroke="#e8567a" stroke-width="3"/>`,
    prop: camera,
  }),
  rockstar: person({
    hair: ["mohawk", "#e84f9a"],
    trim: leather,
    glasses: SUNGLASSES,
    prop: circles(
      [
        [19.4, 33.6, 1.2],
        [44.6, 33.6, 1.2],
      ],
      "#c9ced6"
    ),
  }),
  vampire: person({ skin: SK.pale, hair: ["slick", "#17171b"], trim: vampireCollar, prop: fangs }),
  nun: person({
    skin: SK.light,
    hair: ["bald", HC.black],
    trim: nunBib,
    back: `<path d="M14.5 42C12 12 20.5 5 32 5s20 7 17.5 37Z" fill="#26262b"/>`,
    hat: `<path d="M19 21C22 15 42 15 45 21V25C40 20 24 20 19 25Z" fill="${WHITE}"/>`,
  }),
  gangster: person({
    skin: SK.tan,
    hair: ["slick", HC.black],
    trim: collar + lapels + pinstripes,
    glasses: SUNGLASSES,
    hat: `<ellipse cx="32" cy="19" rx="19" ry="4" fill="#17171b"/><path d="M21 19C21 8 43 8 43 19Z" fill="#26262b"/><path d="M21.5 16.5H42.5" stroke="#e8e8e8" stroke-width="3"/>`,
    prop: cigar,
  }),
  waiter: person({
    skin: SK.light,
    hair: ["slick", HC.dark],
    facial: ["mustache", HC.dark],
    trim: collar + bowtie("#1d1d22") + waiterNapkin,
    prop: trayArm,
  }),
});
