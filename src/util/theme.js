import { writeRaw } from "../storage/storage.js";
import { t } from "../i18n/i18n.js";

function tryWriteRaw(key, value) {
  try {
    writeRaw(key, value);
  } catch {
    /* theme just won't persist */
  }
}

// The theme attribute (`data-theme="dark"` / `"contrast"`; light is no attribute) is applied synchronously by
// a tiny inline script in each page's <head> (before first paint, to avoid a flash): the visitor's saved
// choice wins, otherwise the device decides — "more contrast" / forced colors ⇒ the high-contrast theme,
// else its own light/dark setting. This module wires up the visible toggle button(s) afterwards (they cycle
// light → dark → high contrast), and keeps following the device while no explicit choice has been made.
const STORAGE_KEY = "murdoku:theme";
export const THEMES = ["light", "dark", "contrast"];

export function currentTheme() {
  const v = document.documentElement.getAttribute("data-theme");
  return v === "dark" || v === "contrast" ? v : "light";
}

function hasExplicitChoice() {
  try {
    return THEMES.includes(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

// What the device asks for when nothing was chosen (the same rule as the inline script in the pages).
export function deviceTheme() {
  const media = (q) => typeof matchMedia === "function" && matchMedia(q).matches;
  if (media("(prefers-contrast: more)") || media("(forced-colors: active)")) return "contrast";
  return media("(prefers-color-scheme: dark)") ? "dark" : "light";
}

export function applyTheme(theme) {
  if (theme === "light") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  updateToggleLabels();
}

// Paper-cut icons (currentColor), showing the theme a press switches TO: a sun (light), a moon (dark), a
// half-filled disc (high contrast).
const ICONS = {
  light:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></g></svg>',
  dark: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>',
  contrast:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/></svg>',
};

// light → dark → contrast → light
export function nextTheme(theme) {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

function labelFor(next) {
  return next === "dark"
    ? t("Passa al tema scuro")
    : next === "contrast"
      ? t("Passa al tema ad alto contrasto")
      : t("Passa al tema chiaro");
}

function updateToggleLabels() {
  const next = nextTheme(currentTheme());
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    const label = labelFor(next);
    btn.innerHTML = ICONS[next];
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }
}

export function toggleTheme() {
  const next = nextTheme(currentTheme());
  applyTheme(next);
  tryWriteRaw(STORAGE_KEY, next);
}

export function wireThemeToggle() {
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    btn.addEventListener("click", toggleTheme);
  }
  updateToggleLabels();
  if (typeof matchMedia === "function") {
    for (const query of ["(prefers-color-scheme: dark)", "(prefers-contrast: more)", "(forced-colors: active)"]) {
      matchMedia(query).addEventListener("change", () => {
        if (!hasExplicitChoice()) applyTheme(deviceTheme());
      });
    }
  }
}
