// Tells the visitor when something breaks and offers a one-click way to report
// it — without any external service: the button opens a pre-filled GitHub
// issue that the visitor reviews and submits themselves. Nothing is sent
// automatically, and the report contains only technical details (message,
// stack, page, language, browser).
import { t, getLanguage } from "../i18n/i18n.js";

export const ISSUES_URL = "https://github.com/osdgdt/murdoku/issues/new";
const MAX_URL_LENGTH = 7000; // browsers and GitHub reject much longer URLs
const MAX_BANNERS_PER_PAGE = 3;

// Pure: builds the pre-filled "new issue" URL.
export function buildIssueUrl({ message, stack, page, lang, userAgent }) {
  const title = `[auto] ${String(message || "Error").split("\n")[0].slice(0, 100)}`;
  const body = (stackText) =>
    [
      "**What happened?** (please describe what you were doing)",
      "",
      "",
      "---",
      "_Technical details (added automatically):_",
      `- Page: ${page}`,
      `- Language: ${lang}`,
      `- Browser: ${userAgent}`,
      "",
      "```",
      stackText,
      "```",
    ].join("\n");
  let stackText = String(stack || message || "");
  let url;
  do {
    url = `${ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body(stackText))}`;
    if (url.length <= MAX_URL_LENGTH || stackText.length < 200) break;
    stackText = stackText.slice(0, Math.floor(stackText.length * 0.7)) + "\n…(truncated)";
  } while (true); // eslint-disable-line no-constant-condition
  return url;
}

// Errors that aren't ours to report: browser-extension noise, cross-origin
// "Script error." with no details, and the benign ResizeObserver notice.
export function isReportable({ message, filename }) {
  const text = String(message || "");
  if (!text || text === "Script error." || /ResizeObserver loop/.test(text)) return false;
  if (filename && !filename.startsWith(location.origin)) return false;
  return true;
}

function showBanner(details) {
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.setAttribute("role", "alert");
  const text = document.createElement("span");
  text.textContent = t("Qualcosa non ha funzionato. Se il problema si ripete, puoi segnalarlo.");
  const report = document.createElement("a");
  report.href = buildIssueUrl({ ...details, page: location.pathname + location.search, lang: getLanguage(), userAgent: navigator.userAgent });
  report.target = "_blank";
  report.rel = "noopener";
  report.textContent = t("Segnala il problema");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "✕";
  close.setAttribute("aria-label", t("Chiudi"));
  close.addEventListener("click", () => banner.remove());
  banner.append(text, report, close);
  document.body.appendChild(banner);
}

let shown = 0;
const seen = new Set();
function handle(details) {
  if (!isReportable(details)) return;
  const key = String(details.message);
  if (seen.has(key) || shown >= MAX_BANNERS_PER_PAGE) return;
  seen.add(key);
  shown++;
  showBanner(details);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("error", (e) => handle({ message: e.message, filename: e.filename, stack: e.error?.stack }));
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    handle({ message: reason?.message ?? String(reason), filename: "", stack: reason?.stack });
  });
}
