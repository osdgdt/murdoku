import { writeRaw } from "../storage/storage.js";
import { t } from "../i18n/i18n.js";

function tryWriteRaw(key, value) {
  try { writeRaw(key, value); } catch { /* theme just won't persist */ }
}

// The dark/light attribute is applied synchronously by a tiny inline script
// in each page's <head> (before first paint, to avoid a flash): the visitor's
// saved choice wins, otherwise the device's own light/dark setting is
// followed. This module wires up the visible toggle button(s) afterwards, and
// keeps following the device setting while no explicit choice has been made.
const STORAGE_KEY = "murdoku:theme";

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function hasExplicitChoice() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark";
  } catch {
    return false;
  }
}

function applyTheme(dark) {
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  updateToggleLabels();
}

// Paper-cut icons (currentColor): a sun to switch to the light theme, a moon
// to switch to the dark one.
const SUN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></g></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>';

function updateToggleLabels() {
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    const label = isDark() ? t("Passa al tema chiaro") : t("Passa al tema scuro");
    btn.innerHTML = isDark() ? SUN : MOON;
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }
}

export function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  applyTheme(next === "dark");
  tryWriteRaw(STORAGE_KEY, next);
}

export function wireThemeToggle() {
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    btn.addEventListener("click", toggleTheme);
  }
  updateToggleLabels();
  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!hasExplicitChoice()) applyTheme(e.matches);
    });
  }
}
