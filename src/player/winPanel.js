// The "case solved" banner: murderer reveal, time, hints, share button,
// newly unlocked achievements and the author's closing note.
import { el } from "../util/dom.js";
import { formatElapsed } from "../util/time.js";
import { buildShareText, shareResult } from "../util/shareResult.js";
import { t } from "../i18n/i18n.js";

// `previousBest` is the best time BEFORE this solve. `puzzle.bestTimeSeconds`
// only exists on puzzles whose onSolved tracks it (single-puzzle play) —
// campaign mode doesn't, so the time line then simply isn't rendered.
export function renderWinPanel({ puzzle, murderer, elapsed, previousBest, hintsUsed, newlyUnlocked }) {
  let timeLine = null;
  if (typeof puzzle.bestTimeSeconds === "number") {
    const isNewBest = previousBest == null || elapsed <= previousBest;
    timeLine = el(
      "div",
      { class: "time-result" },
      isNewBest
        ? t("⏱ Tempo: {v} — nuovo record personale!", { v: formatElapsed(elapsed) })
        : t("⏱ Tempo: {v} (miglior tempo: {v2})", { v: formatElapsed(elapsed), v2: formatElapsed(puzzle.bestTimeSeconds) })
    );
  }
  const hintLine = el(
    "div",
    { class: "hint-result" },
    hintsUsed === 0 ? t("🎉 Risolto senza alcun suggerimento!") : t("💡 Suggerimenti usati: {hintsUsedForThisSolve}", { hintsUsedForThisSolve: hintsUsed })
  );
  const achievementBanner = newlyUnlocked.length > 0
    ? el(
        "div",
        { class: "achievement-banner" },
        newlyUnlocked.map((a) =>
          el("div", { class: "achievement-unlocked" }, [
            el("div", { class: "achievement-unlocked-title" }, t("🏆 Nuovo traguardo: {title}", { title: a.title })),
            el("p", { class: "achievement-unlocked-desc" }, a.description),
          ])
        )
      )
    : null;

  const shareBtnLabel = t("📤 Condividi risultato");
  const shareBtn = el("button", { type: "button", class: "share-result-btn" }, shareBtnLabel);
  shareBtn.addEventListener("click", async () => {
    try {
      const outcome = await shareResult(
        buildShareText({ title: puzzle.title, elapsedSeconds: elapsed, hintsUsed, url: new URL("index.html", location.href).href })
      );
      if (outcome === "copied") shareBtn.textContent = t("✓ Copiato negli appunti");
    } catch {
      shareBtn.textContent = t("Impossibile condividere");
    }
    setTimeout(() => { shareBtn.textContent = shareBtnLabel; }, 2500);
  });

  return el("div", { class: "win-panel result-banner success" }, [
    el("div", {}, t("🎉 Caso risolto! Tutti i piazzamenti sono corretti.")),
    murderer ? el("div", {}, t("L'assassino è: {murderer}", { murderer })) : null,
    timeLine,
    hintLine,
    shareBtn,
    achievementBanner,
    puzzle.resolutionNote ? el("p", { class: "resolution-note" }, puzzle.resolutionNote) : null,
  ]);
}
