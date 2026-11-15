// What the player sees while a hint or the answer check is being worked out: the time so far, a bar against the
// time the search is allowed (limits.js), and a Cancel button. On a 16x16 case it can take half a minute, and a
// bare "calculating…" with nothing moving looks like a hang. For screen-reader users the same is said with the
// announcer: once at the start, then every ten seconds, never every second.
import { el } from "../util/dom.js";
import { announce } from "../util/announcer.js";
import { t } from "../i18n/i18n.js";

const SPOKEN_EVERY_S = 10;

// `label`: what is being done; `expectedMs`: the time budget (the bar fills towards it, and turns into a plain
// "still working" once passed); `onCancel`: called when the person presses Cancel.
// Returns { node, stop() } — put `node` in the page, call stop() when the work is over (it stops the clock).
export function startProgress({ label, expectedMs, onCancel }) {
  const started = performance.now();
  const timeNode = el("span", { class: "progress-time", "aria-hidden": "true" }, "⏱ 0 s");
  const bar = el("progress", { class: "progress-bar", max: String(expectedMs), value: "0", "aria-hidden": "true" });
  const cancelBtn = el("button", { type: "button", class: "progress-cancel", onClick: () => onCancel?.() }, t("Annulla"));
  const node = el("div", { class: "result-banner hint-info progress-banner" }, [
    el("span", { class: "progress-label" }, label),
    " ",
    timeNode,
    bar,
    onCancel ? cancelBtn : null,
  ]);
  announce(label);
  let spokenAt = 0;
  const tick = () => {
    const elapsed = performance.now() - started;
    const seconds = Math.floor(elapsed / 1000);
    timeNode.textContent = `⏱ ${seconds} s`;
    if (elapsed < expectedMs) bar.value = elapsed;
    else bar.removeAttribute("value"); // past the budget: indeterminate
    if (seconds >= SPOKEN_EVERY_S && seconds - spokenAt >= SPOKEN_EVERY_S) {
      spokenAt = seconds;
      announce(t("Ancora in calcolo: {seconds} secondi", { seconds }));
    }
  };
  const timer = setInterval(tick, 500);
  return { node, stop: () => clearInterval(timer) };
}
