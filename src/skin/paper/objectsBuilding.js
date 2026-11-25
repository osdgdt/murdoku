// Paper-cut artwork for the ways between the floors of a skyscraper: the lift and the stairs (viewBox 0 0 64 64, same recipe as
// objectsSea.js). Both are low enough to stand on.
import { SHADOW_FILTER_ID } from "./defs.js";

const L = (shape, fill, dy = 2) =>
  `<g><g transform="translate(0 ${dy})" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})">${shape}</g><g fill="${fill}">${shape}</g></g>`;

export const BUILDING_OBJECT_ART = {
  // a lift: two sliding doors with an up and a down arrow above them
  elevator:
    L(`<rect x="10" y="6" width="44" height="52" rx="4"/>`, "#8d97a8") +
    L(`<rect x="15" y="22" width="16" height="32" rx="1.5"/><rect x="33" y="22" width="16" height="32" rx="1.5"/>`, "#d6dbe4", 1) +
    `<path d="M24 16L28 11L32 16Z M36 11L40 16L44 11Z" fill="#fff6e4" transform="translate(-4 0)"/>` +
    `<path d="M31.5 24V52" stroke="#8d97a8" stroke-width="1.6"/>`,
  // a flight of stairs seen from above: steps getting taller
  stairs:
    L(`<rect x="8" y="8" width="48" height="48" rx="4"/>`, "#b99a6a") +
    L(`<rect x="12" y="44" width="40" height="9" rx="1.5"/>`, "#e3cfa3", 1) +
    L(`<rect x="12" y="33" width="40" height="9" rx="1.5"/>`, "#d6bf8c", 1) +
    L(`<rect x="12" y="22" width="40" height="9" rx="1.5"/>`, "#c9ae78", 1) +
    L(`<rect x="12" y="11" width="40" height="9" rx="1.5"/>`, "#b99a6a", 1) +
    `<path d="M32 49V15M26 21L32 14L38 21" stroke="#6f4f3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
};
