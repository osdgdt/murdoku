// What a person sees while the solver works (a uniqueness check, the solution, a hint, a proposed set of clues, ...): the
// label, the time so far, a bar that fills as the search advances, "about N %", and a Cancel button. A search has no
// known length: the bar shows the solver's own estimate of how much of the search is done (solver.js `onProgress`), which
// never goes back; until the first estimate arrives the bar is the browser's "busy" one. On a 16x16 case it can take
// minutes, and a bare "calculating…" with nothing moving looks like a hang. For screen-reader users the same is said
// with the announcer: once at the start, then every ten seconds (with the percentage once there is one), never every
// second. Used by the editor and by the player.
import { el } from "./dom.js";
import { announce } from "./announcer.js";
import { t } from "../i18n/i18n.js";

const SPOKEN_EVERY_S = 10;
const TICK_MS = 500;

// `label`: what is being done; `onCancel`: called when the person presses Cancel (no button without it);
// `className`: extra classes for the banner (each page dresses it its own way).
// Returns { node, update(fraction), setLabel(text), stop() }: put `node` in the page, feed `update` the estimate (0..1,
// as often as it comes: it only ever moves forward), and call stop() when the work is over (it stops the clock).
export function startProgress({ label, onCancel = null, className = "" }) {
  const started = performance.now();
  const labelNode = el("span", { class: "progress-label" }, label);
  const timeNode = el("span", { class: "progress-time", "aria-hidden": "true" }, "⏱ 0 s");
  const percentNode = el("span", { class: "progress-percent", "aria-hidden": "true" }, "");
  // no `value` yet: the browser draws it as "busy" until the first estimate
  const bar = el("progress", { class: "progress-bar", max: "1", "aria-hidden": "true" });
  const cancelBtn = el("button", { type: "button", class: "progress-cancel cancel-solve", onClick: () => onCancel?.() }, t("Annulla"));
  const node = el("div", { class: `progress-banner ${className}`.trim() }, [
    labelNode,
    timeNode,
    percentNode,
    bar,
    onCancel ? cancelBtn : null,
  ]);
  announce(label);

  let known = -1; // the largest estimate heard so far
  const percent = () => Math.min(99, Math.floor(known * 100)); // never "100 %" while it still runs
  let spokenAt = 0;
  const tick = () => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    timeNode.textContent = `⏱ ${seconds} s`;
    if (seconds >= SPOKEN_EVERY_S && seconds - spokenAt >= SPOKEN_EVERY_S) {
      spokenAt = seconds;
      announce(
        known >= 0
          ? t("Ancora in calcolo: {seconds} secondi, circa {percent} %", { seconds, percent: percent() })
          : t("Ancora in calcolo: {seconds} secondi", { seconds })
      );
    }
  };
  const timer = setInterval(tick, TICK_MS);
  return {
    node,
    update(fraction) {
      if (typeof fraction !== "number" || !(fraction > known)) return; // also drops NaN
      known = Math.min(1, fraction);
      bar.value = known;
      percentNode.textContent = `~${percent()} %`;
    },
    setLabel(text) {
      labelNode.textContent = text;
    },
    stop: () => clearInterval(timer),
  };
}
