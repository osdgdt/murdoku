// Tiny, build-free i18n. The *Italian source text is the key*: `t("Gioca")`
// returns "Gioca" in Italian and the English entry of the dictionary
// (src/i18n/en.js) otherwise. That keeps the code readable and Italian the
// zero-cost default; a missing English entry simply falls back to the
// Italian text (and `npm run i18n` lists them).
//
// Interpolation uses `{name}` placeholders: t("Aggiornato il {date}", { date }).
// Static markup in the .html pages is translated at load by translateDom(),
// so pages need no per-element annotations.

export const LANGUAGES = ["it", "en"];
const LANG_KEY = "murdoku:lang";

// Own tiny localStorage access (not storage/storage.js, which itself needs
// t() for its error messages — that would be an import cycle through the
// top-level await below).
function readStored() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

function detectLanguage() {
  // Escape hatch for non-browser contexts: the test runners pin Italian so
  // assertions on UI text stay deterministic whatever the host's locale is.
  if (LANGUAGES.includes(globalThis.__MURDOKU_LANG__)) return globalThis.__MURDOKU_LANG__;
  // A Web Worker has no localStorage: the page tells it which language to use
  // through the worker script's own URL (`solverWorker.js?lang=en`).
  if (typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope) {
    const fromUrl = new URLSearchParams(self.location?.search || "").get("lang");
    if (LANGUAGES.includes(fromUrl)) return fromUrl;
  }
  const stored = readStored();
  if (LANGUAGES.includes(stored)) return stored;
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("it") ? "it" : "en";
}

let lang = detectLanguage();
let dictionary = {};

async function loadDictionary(target) {
  dictionary = target === "en" ? (await import("./en.js")).default : {};
}

// Top-level await: any module importing this one only runs once the
// dictionary is ready, so t() never needs to be async.
await loadDictionary(lang);

export function getLanguage() {
  return lang;
}

// For non-DOM contexts (Web Worker, tests) that can't read the user's
// preference themselves.
export async function setLanguageForSession(target) {
  if (!LANGUAGES.includes(target) || target === lang) return;
  lang = target;
  await loadDictionary(lang);
}

// Persists the choice; callers reload so every already-built string is redone.
export function setLanguage(target) {
  if (!LANGUAGES.includes(target)) return;
  try {
    localStorage.setItem(LANG_KEY, target);
  } catch {
    // preference simply won't persist
  }
}

export function intlLocale() {
  return lang === "en" ? "en-GB" : "it-IT";
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function t(key, params) {
  const text = lang === "it" ? key : dictionary[key] ?? key;
  return interpolate(text, params);
}

// --- static markup ---------------------------------------------------

const TRANSLATABLE_ATTRS = ["title", "placeholder", "aria-label", "alt"];

function translateLiteral(raw) {
  const key = raw.trim().replace(/\s+/g, " ");
  if (!key) return null;
  const translated = dictionary[key];
  if (translated === undefined) return null;
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  return lead + translated + trail;
}

// Translates text nodes and a few attributes under `root` in place. Meant for
// *static* page markup, run once before dynamic content (which may contain
// user-authored text that must never be translated) is rendered.
export function translateDom(root = document) {
  if (lang === "it") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("script, style, [data-no-i18n]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const out = translateLiteral(node.nodeValue);
    if (out !== null) node.nodeValue = out;
  }
  const scope = root.querySelectorAll ? root : document;
  for (const el of scope.querySelectorAll("*")) {
    if (el.closest("[data-no-i18n]")) continue;
    for (const attr of TRANSLATABLE_ATTRS) {
      const value = el.getAttribute(attr);
      if (value) {
        const out = translateLiteral(value);
        if (out !== null) el.setAttribute(attr, out);
      }
    }
  }
}

function wireLanguageToggle() {
  for (const btn of document.querySelectorAll("[data-lang-toggle]")) {
    btn.textContent = lang === "it" ? "EN" : "IT";
    btn.title = lang === "it" ? "Switch to English" : "Passa all'italiano";
    // WCAG 2.5.3: the accessible name must contain the visible text ("EN").
    btn.setAttribute("aria-label", `${btn.textContent} — ${btn.title}`);
    btn.setAttribute("lang", lang === "it" ? "en" : "it");
    btn.addEventListener("click", () => {
      setLanguage(lang === "it" ? "en" : "it");
      location.reload();
    });
  }
}

if (typeof document !== "undefined") {
  document.documentElement.lang = lang;
  translateDom();
  if (document.title) {
    const title = translateLiteral(document.title);
    if (title !== null) document.title = title;
  }
  wireLanguageToggle();
}
