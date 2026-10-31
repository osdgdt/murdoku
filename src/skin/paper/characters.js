// Paper-cut portraits of the cast (viewBox 0 0 64 64): a die-cut sticker with a
// white edge, a body in the character's own color (currentColor — callers set
// `color` on the wrapper) and a head whose hair / headgear tells every
// character apart without relying on color. To restyle the cast, replace the
// strings here (or swap the module for another skin).
import { SHADOW_FILTER_ID } from "./defs.js";

const INK = "#3b3028";
const STICKER = "M32 3C46 3 50 20 47 28 56 32 61 44 62 62H2C3 44 8 32 17 28 14 20 18 3 32 3Z";
const BODY = "M32 40C45 40 55 46 57 59L7 59C9 46 19 40 32 40Z";

const frame = (art, { body = "currentColor", skin = "#fbd9b8", back = "", front = "", face = true } = {}) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="${STICKER}" transform="translate(0 2)" fill="rgba(40,25,10,.35)" filter="url(#${SHADOW_FILTER_ID})"/>
  <path d="${STICKER}" fill="#fffaf0"/>
  ${back}
  <path d="${BODY}" fill="${body}"/><path d="M32 40C26 41 14 46 13 55 9 49 17 41 32 40Z" fill="rgba(255,255,255,.2)"/>
  <rect x="28" y="35" width="8" height="8" rx="2" fill="${skin}"/><path d="M28 39H36" stroke="rgba(0,0,0,.12)" stroke-width="3"/>
  <circle cx="32" cy="26" r="12.5" fill="${skin}"/>
  ${face ? `<circle cx="27.5" cy="27" r="1.7" fill="${INK}"/><circle cx="36.5" cy="27" r="1.7" fill="${INK}"/><path d="M28.5 32Q32 35 35.5 32" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="23.5" cy="30" r="2.4" fill="#ff8f8f" opacity=".35"/><circle cx="40.5" cy="30" r="2.4" fill="#ff8f8f" opacity=".35"/>` : ""}
  ${front}${art}
</svg>`;

export const CHARACTER_ART = {
  person1: frame(``, { back: ``, front: `<path d="M19.5 25C19 13 27 9 32 9s13 4 12.5 16c-2-6-6-8-12.5-8s-10.5 2-12.5 8Z" fill="#5b3a29"/>` }),
  person2: frame(``, { skin: "#f0c29a", back: `<path d="M17 27C15 12 24 8 32 8s17 4 15 19c0 10 2 16 4 20H13c2-4 4-10 4-20Z" fill="#7a3b2a"/>`, front: `<path d="M19.5 24C22 14 42 14 44.5 24 40 19 24 19 19.5 24Z" fill="#7a3b2a"/>` }),
  // "Cronista": newsboy cap with a press card in the band
  hat: frame(`<path d="M18 21C18 11 26 8 32 8s14 3 14 13Z" fill="#8a7a5a"/><path d="M16 21H48C47 25 43 25 40 24H20C17 25 16 23 16 21Z" fill="#6f6048"/><rect x="38" y="13" width="7" height="5" rx="1" fill="#fffaf0"/>`, { skin: "#e3b088" }),
  // "Studioso/a": silver bun and round glasses
  glasses: frame(`<g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="27.5" cy="27" r="4.6"/><circle cx="36.5" cy="27" r="4.6"/><path d="M32 27h0"/></g>`, { back: `<circle cx="32" cy="8" r="5.5" fill="#c9c9d1"/>`, front: `<path d="M19.5 25C19 13 27 12 32 12s13 1 12.5 13c-2-6-6-8-12.5-8s-10.5 2-12.5 8Z" fill="#c9c9d1"/>` }),
  detective: frame(`<path d="M21 19C21 8 43 8 43 19Z" fill="#8a6a45"/><ellipse cx="32" cy="19" rx="18" ry="4" fill="#6f5233"/><path d="M21 17H43" stroke="#3b2b1e" stroke-width="2.4"/><path d="M28 33Q32 31 36 33" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`, { skin: "#e9b98e" }),
  butler: frame(`<path d="M26 40L32 48 38 40Z" fill="#fffaf0"/><path d="M28 43L32 41 36 43 32 45Z" fill="#c0392b"/>`, { front: `<path d="M19.5 24C19 12 27 10 32 10s13 2 12.5 14C41 18 23 18 19.5 24Z" fill="#2a2a35"/>` }),
  chef: frame(`<path d="M20 19v-3a7 7 0 0 1 4-12 7 7 0 0 1 8-2 7 7 0 0 1 8 2 7 7 0 0 1 4 12v3Z" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1"/><rect x="20" y="17" width="24" height="5" rx="2" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1"/>`),
  maid: frame(`<path d="M20 15C22 9 42 9 44 15L44 20C40 17 24 17 20 20Z" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1"/><circle cx="25" cy="14.5" r="1.4" fill="#d8cfbd"/><circle cx="32" cy="12.5" r="1.4" fill="#d8cfbd"/><circle cx="39" cy="14.5" r="1.4" fill="#d8cfbd"/><path d="M26 43H38L40 59H24Z" fill="#fffaf0"/>`, { back: `<circle cx="18" cy="30" r="5" fill="#4b2e26"/><circle cx="46" cy="30" r="5" fill="#4b2e26"/>` }),
  gardener: frame(`<ellipse cx="32" cy="18" rx="23" ry="5" fill="#e3c36a"/><path d="M21 18C21 7 43 7 43 18Z" fill="#efd47f"/><path d="M21 16H43" stroke="#5aa05a" stroke-width="3"/>`, { skin: "#c68863" }),
  driver: frame(`<path d="M19 20C19 9 45 9 45 20Z" fill="#33415c"/><path d="M18 20H46L44 24H20Z" fill="#26314a"/><circle cx="32" cy="14.5" r="2.6" fill="#f2c14e"/>`, { skin: "#e9b98e" }),
  professor: frame(`<path d="M12 15L32 6 52 15 32 24Z" fill="#2c2f3f"/><path d="M50 16V26" stroke="#f2c14e" stroke-width="2"/><circle cx="50" cy="27" r="2" fill="#f2c14e"/>`, { front: `<path d="M20 31C20 43 44 43 44 31 40 36 24 36 20 31Z" fill="#e9e9ee"/>`, face: true }),
  artist: frame(`<path d="M16 18C14 8 34 4 46 10 48 14 44 18 40 18Z" fill="#e0453a"/><circle cx="44" cy="8" r="2.4" fill="#e0453a"/>`, { skin: "#8d5a3b", back: `<circle cx="18" cy="26" r="5" fill="#2a1d18"/><circle cx="46" cy="26" r="5" fill="#2a1d18"/><circle cx="20" cy="20" r="4" fill="#2a1d18"/><circle cx="44" cy="20" r="4" fill="#2a1d18"/>` }),
  // The victim: greyed out, X eyes, a little halo
  victim: frame(`<ellipse cx="32" cy="8.5" rx="10" ry="3.2" fill="none" stroke="#f2c14e" stroke-width="2"/><path d="M23 22l7 7m0-7l-7 7M34 22l7 7m0-7l-7 7" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M28 33.5H36" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`, { body: "#b9b4a8", skin: "#e7e1d6", face: false }),
};
