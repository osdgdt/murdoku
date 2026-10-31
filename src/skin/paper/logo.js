// The Murdoku mark: a paper magnifier (coral ring, mustard handle) with two
// little "grid cells" under the glass. `logoMark` is the cream tile used on the
// coloured top bar; `logoApp` is the coral app-icon version (see icons/).
import { SHADOW_FILTER_ID } from "./defs.js";

const lens = (ring, glass, cell, handle) => `
  <g transform="translate(0 2)" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})"><circle cx="28" cy="28" r="17"/><path d="M40 40L55 55" stroke="rgba(40,25,10,.3)" stroke-width="9" stroke-linecap="round"/></g>
  <path d="M40 40L55 55" stroke="${handle}" stroke-width="9" stroke-linecap="round"/>
  <circle cx="28" cy="28" r="17" fill="${ring}"/><circle cx="28" cy="28" r="11.5" fill="${glass}"/>
  <rect x="21.5" y="22" width="7" height="7" rx="1.5" fill="${cell}"/><rect x="29.5" y="29.5" width="7" height="7" rx="1.5" fill="${cell}" opacity=".7"/>`;

export const logoMark = () => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="15" fill="#fff6e4"/>${lens("#b5493a", "#fffaf0", "#e8b84a", "#c2932a")}</svg>`;
export const logoApp = () => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="#b5493a"/>${lens("#fff6e4", "#f3d6cd", "#c2932a", "#e8b84a")}</svg>`;
