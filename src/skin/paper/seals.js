// Paper-cut artwork for the seals of Egypt / Rome (viewBox 0 0 24 24), drawn in a corner of the cell they mark.
// Anubis is a dark medallion with the pointed ears of a jackal, Ra a golden sun: they differ in shape and tone,
// so they stay distinguishable in a black-and-white print.
import { t } from "../../i18n/i18n.js";

const ICONS = {
  anubis:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#2f3550" stroke="#e8d9a8" stroke-width="1.5"/>` +
    `<path d="M6.5 15.5L7.5 5.5L11 9.6H13L16.5 5.5L17.5 15.5C17.5 18.6 14.9 20 12 20C9.1 20 6.5 18.6 6.5 15.5Z" fill="#e8d9a8"/>` +
    `<circle cx="9.9" cy="13" r="1.1" fill="#2f3550"/><circle cx="14.1" cy="13" r="1.1" fill="#2f3550"/><path d="M10.4 16.6H13.6" stroke="#2f3550" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  ra:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#fff4cf" stroke="#c98a14" stroke-width="1.5"/>` +
    `<g stroke="#c98a14" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.6V5M12 19V21.4M2.6 12H5M19 12H21.4M5.4 5.4L7.1 7.1M16.9 16.9L18.6 18.6M5.4 18.6L7.1 16.9M16.9 7.1L18.6 5.4"/></g>` +
    `<circle cx="12" cy="12" r="4.2" fill="#e9a825"/></svg>`,
};

// The seal drawing for "anubis" | "ra" (empty text for anything else).
export function sealIcon(kind) {
  return ICONS[kind] || "";
}

export function sealLabel(kind) {
  if (kind === "anubis") return t("sigillo di Anubi");
  if (kind === "ra") return t("sigillo di Ra");
  return "";
}
