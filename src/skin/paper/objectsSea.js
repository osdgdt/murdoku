// Paper-cut artwork for the sea and the islands (Pirates), plus the crate (viewBox 0 0 64 64, same recipe as
// objectsNature.js). The raft and the sand are low enough to stand on; every other piece here blocks its cell.
import { SHADOW_FILTER_ID } from "./defs.js";

const L = (shape, fill, dy = 2) =>
  `<g><g transform="translate(0 ${dy})" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})">${shape}</g><g fill="${fill}">${shape}</g></g>`;

export const SEA_OBJECT_ART = {
  // ---- low / flat: a person can stand here
  hammock:
    // a hammock slung between two posts
    L(`<path d="M6 22C16 46 48 46 58 22C48 36 16 36 6 22Z"/>`, "#e6d3a0", 1.6) +
    `<path d="M6 22C16 46 48 46 58 22" stroke="#9a7a3c" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
    `<rect x="3" y="14" width="5" height="22" rx="2" fill="#7a5230"/><rect x="56" y="14" width="5" height="22" rx="2" fill="#7a5230"/>` +
    `<path d="M14 32C24 40 40 40 50 32" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  raft:
    // three logs tied together
    L(`<rect x="6" y="14" width="52" height="11" rx="5"/>`, "#8a5a32", 1) +
    L(`<rect x="6" y="26" width="52" height="11" rx="5"/>`, "#a06a3a", 1) +
    L(`<rect x="6" y="38" width="52" height="11" rx="5"/>`, "#8a5a32", 1) +
    `<path d="M20 12V52M44 12V52" stroke="#d9c79a" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  sand:
    L(`<rect x="4" y="8" width="56" height="48" rx="7"/>`, "#ecd698", 1) +
    `<circle cx="16" cy="20" r="1.6" fill="#c9ad66"/><circle cx="34" cy="16" r="1.4" fill="#c9ad66"/><circle cx="48" cy="30" r="1.8" fill="#c9ad66"/>` +
    `<circle cx="24" cy="38" r="1.6" fill="#c9ad66"/><circle cx="42" cy="46" r="1.4" fill="#c9ad66"/><circle cx="12" cy="46" r="1.2" fill="#c9ad66"/>`,

  // ---- they block the cell
  crate:
    L(`<rect x="8" y="10" width="48" height="44" rx="3"/>`, "#b98550") +
    L(`<rect x="13" y="15" width="38" height="34" rx="1.5"/>`, "#d7a768", 1.2) +
    `<path d="M14 16L50 48M50 16L14 48" stroke="#8a5a32" stroke-width="4" stroke-linecap="round"/>` +
    `<rect x="8" y="10" width="48" height="44" rx="3" fill="none" stroke="#8a5a32" stroke-width="2"/>`,
  pig:
    L(
      `<rect x="14" y="44" width="5" height="11" rx="2"/><rect x="23" y="44" width="5" height="11" rx="2"/><rect x="38" y="44" width="5" height="11" rx="2"/><rect x="46" y="44" width="5" height="11" rx="2"/>`,
      "#c9847f",
      1
    ) +
    L(`<ellipse cx="30" cy="36" rx="22" ry="14"/>`, "#f0a9a4") +
    L(`<ellipse cx="52" cy="35" rx="9" ry="8"/>`, "#f0a9a4", 1.4) +
    L(`<ellipse cx="59" cy="38" rx="3.6" ry="3.2"/>`, "#e58a85", 1) +
    L(`<path d="M46 26L52 20 55 28Z"/>`, "#d98c87", 1) +
    `<path d="M9 32C4 30 4 36 8 36" stroke="#d98c87" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="53" cy="33" r="1.3" fill="#3a2a22"/>`,
  shark:
    // a dorsal fin cutting the water
    `<path d="M6 46C16 42 26 44 32 46C40 44 52 42 58 46" stroke="#9fc4d4" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    L(`<path d="M20 46C24 30 32 18 40 10C40 24 44 36 48 46Z"/>`, "#59656f", 1.6) +
    `<path d="M28 44C30 36 34 28 38 22" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  rock:
    L(`<path d="M6 46C4 34 12 22 24 20C32 12 46 14 52 24C60 30 60 42 54 48C40 54 18 54 6 46Z"/>`, "#8f979c") +
    L(`<path d="M16 42C14 34 20 28 28 28C32 24 40 26 42 32C48 34 48 42 42 44C34 48 22 48 16 42Z"/>`, "#aab2b6", 1.2) +
    `<path d="M22 34C26 30 32 30 36 32" stroke="rgba(255,255,255,.4)" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  cannon:
    // a cannon on its carriage
    L(`<circle cx="20" cy="46" r="9"/><circle cx="44" cy="46" r="9"/>`, "#6b4a2f", 1) +
    L(`<path d="M8 34L52 20 58 30 14 44Z"/>`, "#3f464d") +
    L(`<ellipse cx="55" cy="25" rx="5" ry="6" transform="rotate(-18 55 25)"/>`, "#2b3036", 1) +
    `<circle cx="20" cy="46" r="3" fill="#cfa86a"/><circle cx="44" cy="46" r="3" fill="#cfa86a"/>`,
  rope:
    L(`<circle cx="32" cy="34" r="22"/>`, "#c8ad76") +
    L(`<circle cx="32" cy="34" r="15"/>`, "#b0935a", 1.2) +
    L(`<circle cx="32" cy="34" r="8"/>`, "#8b7340", 1) +
    `<path d="M14 24C26 18 44 20 52 30M16 40C26 48 42 48 50 40" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round" fill="none"/>`,
};
