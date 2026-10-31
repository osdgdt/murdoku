// Spoiler-free "I solved it" text: title, time and hints only — never the
// murderer or any placement.
import { t } from "../i18n/i18n.js";
import { formatElapsed } from "./time.js";

export function buildShareText({ title, elapsedSeconds, hintsUsed, url }) {
  const time = formatElapsed(elapsedSeconds);
  const line =
    hintsUsed === 0
      ? t("🔎 Ho risolto «{title}» su Murdoku in {time}, senza suggerimenti!", { title, time })
      : t("🔎 Ho risolto «{title}» su Murdoku in {time} (suggerimenti usati: {hints}).", { title, time, hints: hintsUsed });
  return url ? `${line}\n${url}` : line;
}

// Native share sheet when the browser has one (phones), clipboard otherwise.
// Returns "shared" | "copied" | "cancelled"; throws only if nothing worked.
export async function shareResult(text) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
