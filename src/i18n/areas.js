// Which parts of the English dictionary a PAGE needs. The dictionary is split by area (src/i18n/en/*.js, merged
// by en.js); an English visitor used to load all of it (about 100 KB) on every page, glossary and tutorial texts
// included. Now a page loads its own areas: the glossary strings only on the glossary and the editor (whose clue
// wizard shows them), the tutorial's only on the tutorial, and so on. Italian visitors load none (Italian is the
// source text). `npm run i18n` checks, page by page, that nothing a page uses is left out (tools/lib/i18n-pages.mjs),
// so an area cannot be forgotten silently.
//
// Workers and tests load everything (en.js): they have no page.
export const AREA_LOADERS = {
  ui: () => import("./en/ui.js"),
  clues: () => import("./en/clues.js"),
  medieval: () => import("./en/medieval.js"),
  glossary: () => import("./en/glossary.js"),
  tutorial: () => import("./en/tutorial.js"),
  privacy: () => import("./en/privacy.js"),
  campaign: () => import("./en/campaign.js"),
  community: () => import("./en/community.js"),
};

const COMMON = ["ui", "clues", "medieval"];
// what a page needs on top of the common areas
const EXTRA = {
  // (the glossary examples are little cases whose cast and rooms are translated in the tutorial's area)
  "glossary.html": ["glossary", "tutorial"],
  "editor.html": ["glossary", "community"],
  // (publishing and opening a case by its code)
  "player.html": ["community"],
  // (the list of the cases published by other players)
  "community.html": ["community"],
  // (the administrators' page: reports and what to do with them)
  "moderation.html": ["community"],
  "tutorial.html": ["tutorial"],
  "privacy.html": ["privacy"],
  "campaign.html": ["campaign"],
  "campaign-editor.html": ["campaign"],
};
// pages that are known to need nothing else; any other name (a renamed page, a host that serves the home at "/")
// gets every area, which is always correct
const PLAIN_PAGES = new Set(["", "index.html", "print.html", "achievements.html", "daily.html"]);

// The areas of the page at `pathname` (e.g. "/murdoku/glossary.html").
export function areasForPage(pathname) {
  // Escape hatch for the browser tests that load a page only as a host for modules of OTHER pages (set before load).
  if (globalThis.__MURDOKU_ALL_AREAS__) return Object.keys(AREA_LOADERS);
  const page = String(pathname ?? "")
    .split("/")
    .pop();
  if (EXTRA[page]) return [...COMMON, ...EXTRA[page]];
  if (PLAIN_PAGES.has(page)) return COMMON;
  return Object.keys(AREA_LOADERS);
}

// The pages the check knows by name, with their areas (used by tools/lib/i18n-pages.mjs).
export const PAGE_AREAS = Object.fromEntries(
  [...PLAIN_PAGES]
    .filter(Boolean)
    .map((p) => [p, COMMON])
    .concat(Object.entries(EXTRA).map(([p, extra]) => [p, [...COMMON, ...extra]]))
);
