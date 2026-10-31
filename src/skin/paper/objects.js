// Paper-cut artwork for the furniture/props (viewBox 0 0 64 64). Each icon is
// a stack of flat "cut paper" layers, every one with a soft shadow under it.
// To change the look of an object, replace its string here (or swap this whole
// module for another skin): nothing else in the app depends on the drawing.
import "./defs.js";
import { SHADOW_FILTER_ID } from "./defs.js";

// A layer: soft shadow (offset down) + the flat shape.
const L = (shape, fill, dy = 2) =>
  `<g><g transform="translate(0 ${dy})" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})">${shape}</g><g fill="${fill}">${shape}</g></g>`;

export const OBJECT_ART = {
  shelf:
    L(`<rect x="12" y="8" width="40" height="46" rx="4"/>`, "#8a5a3a") +
    L(`<rect x="16" y="12" width="32" height="12" rx="2"/><rect x="16" y="28" width="32" height="10" rx="2"/><rect x="16" y="42" width="32" height="9" rx="2"/>`, "#f1dcb8", 1) +
    `<g fill="#d9715e"><rect x="19" y="14" width="5" height="8"/><rect x="31" y="14" width="5" height="8"/></g><g fill="#5a9788"><rect x="25" y="14" width="5" height="8"/><rect x="38" y="30" width="6" height="6"/></g><g fill="#e8b84a"><rect x="19" y="30" width="6" height="6"/><rect x="26" y="44" width="8" height="5"/></g>`,
  lamp:
    L(`<circle cx="32" cy="22" r="20"/>`, "#fbe9a6", 3) +
    L(`<path d="M20 34L25 12H39L44 34Z"/>`, "#e8b84a") +
    L(`<rect x="30" y="34" width="4" height="18"/><rect x="21" y="50" width="22" height="5" rx="2.5"/>`, "#6f4f3a", 1),
  window:
    L(`<rect x="8" y="8" width="48" height="48" rx="6"/>`, "#fff6e4") +
    L(`<rect x="13" y="13" width="38" height="38" rx="3"/>`, "#8fc7e6", 1) +
    L(`<path d="M13 40 L26 28 L34 36 L42 26 L51 38V51H13Z"/>`, "#7fb77a", 1) +
    `<circle cx="42" cy="22" r="5" fill="#ffd45e"/><path d="M32 13V51M13 32H51" stroke="#fff6e4" stroke-width="3"/>`,
  tv:
    L(`<rect x="7" y="14" width="50" height="34" rx="5"/>`, "#3b4256") +
    L(`<rect x="12" y="19" width="40" height="24" rx="2"/>`, "#8fe0d2", 1) +
    L(`<path d="M12 38L24 28 32 35 40 26 52 36V43H12Z"/>`, "#e8b84a", 1) +
    L(`<rect x="22" y="50" width="20" height="5" rx="2"/>`, "#3b4256", 1),
  table:
    L(`<ellipse cx="32" cy="32" rx="25" ry="20"/>`, "#a8683a") +
    L(`<ellipse cx="32" cy="30" rx="21" ry="16"/>`, "#d9985b", 1.5) +
    L(`<circle cx="25" cy="30" r="6"/><circle cx="40" cy="30" r="6"/>`, "#fff6e4", 1) +
    `<circle cx="25" cy="30" r="3" fill="#d9715e"/><circle cx="40" cy="30" r="3" fill="#7fb7a8"/>`,
  plant:
    L(`<path d="M32 34 C12 32 8 14 14 6 C26 10 34 20 32 34Z"/>`, "#5fa05a") +
    L(`<path d="M32 34 C52 32 56 14 50 6 C38 10 30 20 32 34Z"/>`, "#7cc070") +
    L(`<path d="M32 34 C26 24 28 12 32 4 C38 12 38 24 32 34Z"/>`, "#478a4a") +
    L(`<path d="M20 36H44L40 56H24Z"/>`, "#d9715e"),
  chair:
    L(`<rect x="14" y="6" width="36" height="20" rx="8"/>`, "#b24f3d") +
    L(`<rect x="14" y="24" width="36" height="26" rx="8"/>`, "#d9715e") +
    L(`<rect x="18" y="50" width="6" height="8" rx="2"/><rect x="40" y="50" width="6" height="8" rx="2"/>`, "#6f4f3a", 1),
  stool:
    L(`<ellipse cx="32" cy="30" rx="19" ry="12"/>`, "#c2932a") +
    L(`<ellipse cx="32" cy="27" rx="19" ry="11"/>`, "#e8b84a", 1.5) +
    L(`<rect x="17" y="34" width="5" height="20" rx="2"/><rect x="42" y="34" width="5" height="20" rx="2"/>`, "#6f4f3a", 1),
  door:
    L(`<rect x="12" y="4" width="40" height="54" rx="6"/>`, "#8a5a3a") +
    L(`<rect x="17" y="9" width="30" height="44" rx="3"/>`, "#c98a52", 1.5) +
    L(`<rect x="21" y="14" width="22" height="14" rx="2"/><rect x="21" y="32" width="22" height="16" rx="2"/>`, "#e0a56c", 1) +
    `<circle cx="41" cy="34" r="3" fill="#ffd45e"/>`,
  carpet:
    L(`<rect x="5" y="14" width="54" height="38" rx="5"/>`, "#b24f3d") +
    L(`<rect x="10" y="19" width="44" height="28" rx="3"/>`, "#e8b84a", 1.5) +
    L(`<path d="M32 21L46 33 32 45 18 33Z"/>`, "#b24f3d", 1) +
    L(`<circle cx="32" cy="33" r="5"/>`, "#fff6e4", 1),
};

export const paperSvg = (inner) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
