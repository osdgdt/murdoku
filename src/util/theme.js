import { writeRaw } from "../storage/storage.js";
import { t } from "../i18n/i18n.js";

function tryWriteRaw(key, value) {
  try { writeRaw(key, value); } catch { /* theme just won't persist */ }
}

// The actual dark/light attribute is applied synchronously by a tiny inline
// script in each page's <head> (before first paint, to avoid a light-mode
// flash) — see the `<script>` snippet duplicated at the top of every HTML
// page. This module only wires up the visible toggle button(s) afterwards.
const STORAGE_KEY = "murdoku:theme";

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function updateToggleLabels() {
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    btn.textContent = isDark() ? "☀️" : "🌙";
    btn.title = isDark() ? t("Passa al tema chiaro") : t("Passa al tema scuro");
  }
}

export function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  tryWriteRaw(STORAGE_KEY, next);
  updateToggleLabels();
}

export function wireThemeToggle() {
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    btn.addEventListener("click", toggleTheme);
  }
  updateToggleLabels();
}
