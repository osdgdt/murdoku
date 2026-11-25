// Paper-cut artwork for animals and outdoor props (viewBox 0 0 64 64, same recipe as
// objects.js / objectsMedieval.js: flat "cut paper" layers, each with a soft shadow).
// Merged into OBJECT_ART in objects.js. The horse and the mud puddle are low enough
// to stand on; every other piece here blocks its cell.
import { SHADOW_FILTER_ID } from "./defs.js";

const L = (shape, fill, dy = 2) =>
  `<g><g transform="translate(0 ${dy})" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})">${shape}</g><g fill="${fill}">${shape}</g></g>`;

const flame = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -9C4 -4 5 0 0 3C-5 0 -4 -4 0 -9Z" fill="#e8622f"/><path d="M0 -5C2.4 -2 2.6 0 0 2C-2.6 0 -2.4 -2 0 -5Z" fill="#ffd45e"/></g>`;

export const NATURE_OBJECT_ART = {
  // ---- low / flat: a person can stand (or ride) here
  horse:
    // legs, tail, body, neck and head, saddle, mane: a horse seen from the side
    L(
      `<rect x="14" y="40" width="5" height="17" rx="2"/><rect x="22" y="40" width="5" height="17" rx="2"/><rect x="38" y="40" width="5" height="17" rx="2"/><rect x="46" y="40" width="5" height="17" rx="2"/>`,
      "#7a4f2a",
      1
    ) +
    L(`<path d="M12 28C6 30 5 40 8 46C10 40 11 35 14 33Z"/>`, "#4a3220", 1) +
    L(`<rect x="10" y="24" width="42" height="20" rx="10"/>`, "#a9743f") +
    L(`<path d="M44 28L50 10Q56 6 60 12L58 20 54 24 52 34Z"/>`, "#a9743f", 1.4) +
    L(`<path d="M52 12Q58 11 60 16L59 21Q55 19 52 20Z"/>`, "#c99663", 1) +
    L(`<rect x="22" y="22" width="18" height="8" rx="3"/>`, "#a8323a", 1) +
    L(`<path d="M44 12Q47 10 50 8L51 24 46 26Z"/>`, "#4a3220", 1) +
    `<circle cx="56.6" cy="12.8" r="1.2" fill="#1f1b16"/>`,
  mud:
    L(`<path d="M8 36C6 26 18 20 30 22C42 18 58 24 56 36C58 46 44 52 32 50C20 54 6 48 8 36Z"/>`, "#6b4a2f") +
    `<path d="M14 36C16 30 26 28 34 30" stroke="rgba(255,255,255,.2)" stroke-width="2" stroke-linecap="round" fill="none"/>` +
    `<circle cx="42" cy="40" r="2.5" fill="rgba(255,255,255,.18)"/><circle cx="24" cy="44" r="1.6" fill="rgba(255,255,255,.16)"/>`,

  // ---- they block the cell
  boar:
    L(
      `<rect x="14" y="44" width="5" height="12" rx="2"/><rect x="24" y="44" width="5" height="12" rx="2"/><rect x="38" y="44" width="5" height="12" rx="2"/><rect x="47" y="44" width="5" height="12" rx="2"/>`,
      "#3a2a22",
      1
    ) +
    L(`<ellipse cx="32" cy="36" rx="24" ry="14"/>`, "#5a4033") +
    L(`<path d="M8 28L14 24 20 30 26 22 32 30 38 22 42 30 48 28 52 34 14 40Z"/>`, "#3a2a22", 1) +
    L(`<ellipse cx="53" cy="38" rx="8" ry="7"/>`, "#6b4c3c", 1.4) +
    L(`<ellipse cx="59" cy="41" rx="3.4" ry="3.4"/>`, "#d9a7a0", 1) +
    `<path d="M54 44L52 49M58 45L60 49" stroke="#f3ead6" stroke-width="2.4" stroke-linecap="round"/><circle cx="52" cy="34" r="1.2" fill="#1f1b16"/>`,
  cow:
    L(
      `<rect x="14" y="44" width="5" height="13" rx="2"/><rect x="23" y="44" width="5" height="13" rx="2"/><rect x="38" y="44" width="5" height="13" rx="2"/><rect x="47" y="44" width="5" height="13" rx="2"/>`,
      "#5b4a40",
      1
    ) +
    L(`<rect x="8" y="22" width="40" height="26" rx="12"/>`, "#f6f2ea") +
    `<path d="M16 26C22 24 24 30 20 34C14 34 12 29 16 26ZM32 32C38 30 42 34 38 40C32 42 28 36 32 32Z" fill="#26262b"/>` +
    L(`<rect x="44" y="20" width="16" height="17" rx="6"/>`, "#f6f2ea", 1.4) +
    `<rect x="50" y="30" width="10" height="7" rx="3" fill="#e9a6a0"/><path d="M45 19L43 13M58 19L60 13" stroke="#d8cfa8" stroke-width="2.6" stroke-linecap="round"/><circle cx="51" cy="26" r="1.2" fill="#1f1b16"/>` +
    L(`<ellipse cx="30" cy="48" rx="6" ry="3"/>`, "#e9a6a0", 0.5),
  tiger:
    L(
      `<rect x="12" y="44" width="5" height="12" rx="2"/><rect x="22" y="44" width="5" height="12" rx="2"/><rect x="38" y="44" width="5" height="12" rx="2"/><rect x="47" y="44" width="5" height="12" rx="2"/>`,
      "#c9761f",
      1
    ) +
    L(`<path d="M12 36C4 36 2 24 8 18L10 24Z"/>`, "#e08a2c", 1) +
    L(`<rect x="8" y="26" width="42" height="20" rx="10"/>`, "#e08a2c") +
    L(`<ellipse cx="53" cy="30" rx="9" ry="8"/>`, "#e08a2c", 1.4) +
    `<path d="M16 28L18 44M24 27L26 45M32 27L34 45M40 28L41 44" stroke="#2b1c10" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M47 24L49 28M53 22L53 27M59 24L57 28" stroke="#2b1c10" stroke-width="2" stroke-linecap="round"/><ellipse cx="55" cy="34" rx="4" ry="2.8" fill="#f6ead2"/><circle cx="52" cy="29" r="1.2" fill="#1f1b16"/>`,
  tree:
    L(`<rect x="28" y="38" width="8" height="20" rx="2"/>`, "#7a4f2a", 1) +
    L(`<circle cx="32" cy="22" r="16"/>`, "#3f7d3a") +
    L(`<circle cx="22" cy="30" r="11"/><circle cx="43" cy="30" r="11"/>`, "#4f9446", 1.4) +
    L(`<circle cx="32" cy="18" r="9"/>`, "#63ab55", 1) +
    `<circle cx="27" cy="16" r="2" fill="rgba(255,255,255,.18)"/>`,
  vase:
    L(`<path d="M24 52H40L42 56H22Z"/>`, "#7d4a2a", 1) +
    L(`<path d="M25 52C14 46 14 30 24 24L24 16H40L40 24C50 30 50 46 39 52Z"/>`, "#4b6fa5") +
    L(`<rect x="22" y="12" width="20" height="6" rx="3"/>`, "#3d5d8c", 1) +
    `<path d="M20 34Q32 40 44 34M21 42Q32 48 43 42" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>`,
  fire:
    L(
      `<rect x="12" y="50" width="40" height="6" rx="3" transform="rotate(-8 32 53)"/><rect x="12" y="50" width="40" height="6" rx="3" transform="rotate(8 32 53)"/>`,
      "#6f4f3a",
      1
    ) +
    flame(22, 46, 1.2) +
    flame(42, 46, 1.2) +
    flame(32, 44, 2.1),
  bones:
    L(
      `<rect x="6" y="40" width="46" height="7" rx="3.5" transform="rotate(-18 29 43)"/><rect x="10" y="40" width="46" height="7" rx="3.5" transform="rotate(18 33 43)"/>`,
      "#efe6cf",
      1
    ) +
    L(
      `<circle cx="10" cy="47" r="4"/><circle cx="55" cy="47" r="4"/><circle cx="10" cy="26" r="4"/><circle cx="55" cy="26" r="4"/>`,
      "#efe6cf",
      1
    ) +
    L(`<ellipse cx="32" cy="30" rx="12" ry="10"/><rect x="26" y="36" width="12" height="7" rx="2"/>`, "#f6efdc", 1.4) +
    `<ellipse cx="27.5" cy="30" rx="3" ry="3.4" fill="#4a4034"/><ellipse cx="36.5" cy="30" rx="3" ry="3.4" fill="#4a4034"/><path d="M30 39V43M34 39V43" stroke="#9a8f77" stroke-width="1.2"/>`,
};
