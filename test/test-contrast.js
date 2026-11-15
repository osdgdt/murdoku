// The three themes' colours, read from the stylesheets: text must stay readable, and the high-contrast theme
// must really be high contrast (WCAG ratios: 7:1 is the AAA level for normal text). A change to a colour
// that makes a pair worse fails here, instead of being noticed by someone who cannot read the page.
import { readRepoFile } from "./helpers/read-file.js";
import { assert } from "./assert.js";

const block = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};
const tokens = (b) => Object.fromEntries([...b.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function themes() {
  const skin = await readRepoFile("styles/skin-paper.css");
  const contrast = await readRepoFile("styles/contrast.css");
  return {
    light: tokens(block(skin, "\n:root")),
    dark: tokens(block(skin, ':root[data-theme="dark"]')),
    contrast: tokens(block(contrast, ':root[data-theme="contrast"]')),
  };
}

// [foreground token, background token, minimum ratio]
const EVERY_THEME = [
  ["ink", "panel", 7],
  ["ink", "bg", 7],
  ["ink", "panel-alt", 7],
  ["ink-soft", "panel", 4.5],
  ["accent", "panel", 4.5],
  ["danger", "panel", 4.5],
  ["success", "panel", 4.5],
  ["topbar-ink", "topbar-bg", 4.5],
  ["ink", "accent-soft", 7],
  ["ink", "danger-soft", 7],
  ["ink", "success-soft", 7],
];
const HIGH_CONTRAST_ONLY = [
  ["ink-faint", "panel", 7],
  ["gold", "panel", 7],
  ["border", "panel", 7],
  ["border-soft", "panel", 7],
  ["cell-border", "cell-bg", 7],
  ["ink", "gold-soft", 7],
];

export const tests = [
  {
    name: "contrasto: ogni tema definisce tutti i colori che servono",
    fn: async () => {
      const all = await themes();
      for (const [name, t] of Object.entries(all)) {
        for (const [fg, bg] of [...EVERY_THEME, ...(name === "contrast" ? HIGH_CONTRAST_ONLY : [])]) {
          assert(t[fg] && t[bg], `tema ${name}: manca --${fg} o --${bg}`);
        }
      }
    },
  },
  {
    name: "contrasto: testo leggibile in tutti e tre i temi (ink 7:1, colori di stato e accento 4,5:1)",
    fn: async () => {
      const all = await themes();
      for (const [name, t] of Object.entries(all)) {
        for (const [fg, bg, min] of EVERY_THEME) {
          const ratio = contrastRatio(t[fg], t[bg]);
          assert(ratio >= min, `tema ${name}: --${fg} su --${bg} è ${ratio.toFixed(1)}:1, serve almeno ${min}:1`);
        }
      }
    },
  },
  {
    name: "contrasto: il tema ad alto contrasto è davvero ad alto contrasto (testo, bordi e griglia ≥ 7:1)",
    fn: async () => {
      const { contrast } = await themes();
      for (const [fg, bg, min] of HIGH_CONTRAST_ONLY) {
        const ratio = contrastRatio(contrast[fg], contrast[bg]);
        assert(ratio >= min, `contrasto: --${fg} su --${bg} è ${ratio.toFixed(1)}:1, serve almeno ${min}:1`);
      }
    },
  },
];
