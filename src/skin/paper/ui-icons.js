// Paper-cut illustrations for the landing page cards and the hero strip.
import { SHADOW_FILTER_ID } from "./defs.js";
import { OBJECT_ART } from "./objects.js";
import { CHARACTER_ART } from "./characters.js";

const L = (shape, fill, dy = 2) =>
  `<g><g transform="translate(0 ${dy})" fill="rgba(40,25,10,.3)" filter="url(#${SHADOW_FILTER_ID})">${shape}</g><g fill="${fill}">${shape}</g></g>`;
const wrap = (inner) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export const UI_ICONS = {
  tutorial: wrap(
    L(`<path d="M6 30C16 26 26 28 32 34 38 28 48 26 58 30V54C48 50 38 52 32 58 26 52 16 50 6 54Z"/>`, "#fff6e4") +
    `<path d="M32 34V57" stroke="#d3b97f" stroke-width="2"/><g stroke="#d9715e" stroke-width="2.2" stroke-linecap="round"><path d="M12 38C18 37 24 38 28 41M12 44C18 43 24 44 28 47"/></g>` +
    L(`<path d="M8 20L32 8 56 20 32 32Z"/>`, "#3b4256") + L(`<path d="M20 26V34C26 38 38 38 44 34V26L32 32Z"/>`, "#4b5470", 1) +
    `<path d="M52 21V32" stroke="#e8b84a" stroke-width="2.4"/><circle cx="52" cy="34" r="3" fill="#e8b84a"/>`),
  editor: wrap(
    L(`<rect x="8" y="10" width="40" height="46" rx="4"/>`, "#fff6e4") + `<g stroke="#d3b97f" stroke-width="2" stroke-linecap="round"><path d="M15 22H41M15 30H41M15 38H30"/></g>` +
    `<g transform="rotate(38 40 38)">` + L(`<rect x="34" y="6" width="12" height="40" rx="2"/>`, "#e8b84a") + L(`<rect x="34" y="6" width="12" height="7" rx="2"/>`, "#d9715e", 1) + L(`<rect x="34" y="13" width="12" height="4"/>`, "#c9c3b8", 1) + L(`<path d="M34 46H46L40 58Z"/>`, "#f1dcb8", 1) + `<path d="M38 54.5L40 58 42 54.5Z" fill="#3b3028"/></g>`),
  play: wrap(
    L(`<circle cx="26" cy="26" r="19"/>`, "#d9715e") + L(`<circle cx="26" cy="26" r="13"/>`, "#dff1f8", 1) +
    `<path d="M16 22C18 17 22 15 27 15" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` +
    L(`<path d="M39 39L56 56" stroke="#6f4f3a" stroke-width="10" stroke-linecap="round" fill="none"/>`, "none", 2) + `<path d="M39 39L56 56" stroke="#8a5a3a" stroke-width="9" stroke-linecap="round"/>` +
    `<rect x="19" y="21" width="8" height="8" rx="1.5" fill="#e8b84a"/><rect x="27" y="29" width="8" height="8" rx="1.5" fill="#7fb7a8"/>`),
  campaign: wrap(
    L(`<ellipse cx="32" cy="44" rx="27" ry="8"/>`, "#6f5233") + L(`<path d="M14 44C14 16 50 16 50 44Z"/>`, "#8a6a45") + `<path d="M14 40H50" stroke="#3b2b1e" stroke-width="6"/><path d="M26 22C28 18 36 18 38 22" stroke="#6f5233" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    L(`<path d="M48 8L51 15 58 15 52.500 19.500 54.500 26.500 48 22.500 41.500 26.500 43.500 19.500 38 15 45 15Z"/>`, "#e8b84a", 1.5)),
  achievements: wrap(
    L(`<path d="M16 10H48V26C48 36 40 42 32 42S16 36 16 26Z"/>`, "#e8b84a") +
    L(`<path d="M16 14H8C8 24 12 30 18 31M48 14H56C56 24 52 30 46 31" fill="none" stroke="#c2932a" stroke-width="4" stroke-linecap="round"/>`, "none", 1.5) +
    `<path d="M22 14V28C22 33 26 36 30 37" stroke="#fff6e4" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` +
    L(`<rect x="28" y="42" width="8" height="8"/><rect x="18" y="50" width="28" height="8" rx="3"/>`, "#c2932a", 1.5) +
    L(`<path d="M32 15L34.500 21 41 21.500 36 26 37.500 32.500 32 29 26.500 32.500 28 26 23 21.500 29.500 21Z"/>`, "#fff6e4", 1)),
  resume: wrap(L(`<circle cx="32" cy="32" r="26"/>`, "#b5493a") + L(`<path d="M25 18L47 32 25 46Z"/>`, "#fff6e4", 1.5)),
};

// A little scene of cut-paper rooms, furniture and two suspects.
export function heroArt() {
  const room = (x, y, w, h, fill, dark) =>
    L(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>`, fill, 3) + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="none" stroke="${dark}" stroke-width="2" opacity=".35"/>`;
  const icon = (art, x, y, s) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 64 64">${art}</svg>`;
  const person = (art, x, y, s, color) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 64 64" style="color:${color}">${art.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</svg>`;
  return `<svg class="hero-art" viewBox="0 0 440 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${room(18, 30, 150, 120, "#e8b84a", "#c2932a")}${room(176, 30, 118, 120, "#7fb7a8", "#5a9788")}${room(302, 30, 120, 120, "#d9715e", "#b24f3d")}
    ${icon(OBJECT_ART.shelf, 24, 36, 58)}${icon(OBJECT_ART.table, 56, 86, 62)}${icon(OBJECT_ART.lamp, 108, 38, 54)}
    ${icon(OBJECT_ART.window, 186, 34, 54)}${icon(OBJECT_ART.plant, 238, 84, 56)}
    ${icon(OBJECT_ART.carpet, 314, 84, 64)}${icon(OBJECT_ART.door, 372, 38, 52)}
    ${person(CHARACTER_ART.detective, 84, 78, 56, "#bf8020")}${person(CHARACTER_ART.artist, 190, 82, 54, "#9f5595")}${person(CHARACTER_ART.victim, 330, 74, 56, "#a83a2e")}
    <g transform="translate(300 4) rotate(-12 40 40) scale(1.1)">${UI_ICONS.play.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g></svg>`;
}
