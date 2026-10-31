import { el, clear } from "../util/dom.js";
import { ACHIEVEMENTS } from "../model/achievements.js";
import * as achievementsStore from "../storage/achievementsStore.js";
import * as solveHistory from "../storage/solveHistoryStore.js";
import { formatElapsed } from "../util/time.js";
import { t, intlLocale } from "../i18n/i18n.js";

// Always shows every achievement in the registry — unlocked ones with when
// they were earned, locked ones dimmed but with their description still
// visible as a goal to aim for (a personal checklist, not a mystery-box
// reveal mechanic — consistent with "not social").
export function renderAchievementsPage(root) {
  clear(root);
  const stats = achievementsStore.getStats();
  const unlocked = achievementsStore.getUnlocked();

  root.appendChild(
    el("div", { class: "panel achievement-stats" }, [
      el("div", { class: "achievement-stat" }, [el("strong", {}, String(stats.totalSolved)), el("span", {}, t("casi risolti"))]),
      el("div", { class: "achievement-stat" }, [el("strong", {}, String(stats.totalSolvedWithoutHints)), el("span", {}, t("senza indizi"))]),
      el("div", { class: "achievement-stat" }, [
        el("strong", {}, stats.fastestSolveSeconds != null ? formatElapsed(stats.fastestSolveSeconds) : "—"),
        el("span", {}, t("miglior tempo")),
      ]),
    ])
  );

  renderHistory(root);

  const grid = el("div", { class: "achievement-grid" });
  for (const achievement of ACHIEVEMENTS) {
    const unlockedAt = unlocked[achievement.id];
    const dateLabel = unlockedAt
      ? new Date(unlockedAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" })
      : null;
    grid.appendChild(
      el("div", { class: "achievement-tile" + (unlockedAt ? " unlocked" : " locked") }, [
        el("span", { class: "achievement-icon" }, unlockedAt ? "🏆" : "🔒"),
        el("h3", {}, achievement.title),
        el("p", { class: "muted" }, achievement.description),
        dateLabel
          ? el("span", { class: "unlock-date" }, t("Sbloccato il {dateLabel}", { dateLabel }))
          : el("span", { class: "muted locked-label" }, t("Non ancora sbloccato")),
      ])
    );
  }
  root.appendChild(grid);
}

// Personal diary of solves (kept on this device only): a per-case summary and
// the most recent individual solves. Hidden until there is something to show.
function renderHistory(root) {
  const summary = solveHistory.summaryByCase();
  if (summary.length === 0) return;
  const dateOf = (ms) => new Date(ms).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });
  const average = solveHistory.averageSolveSeconds();

  const caseRows = summary.slice(0, 10).map((s) =>
    el("li", {}, [
      el("strong", {}, s.title || "—"),
      el("span", { class: "muted" }, " · " + [
        s.solves === 1 ? t("risolto 1 volta") : t("risolto {count} volte", { count: s.solves }),
        s.bestElapsedSeconds != null ? t("miglior tempo {time}", { time: formatElapsed(s.bestElapsedSeconds) }) : null,
        s.bestHintsUsed === 0 ? t("senza suggerimenti") : t("meno suggerimenti: {count}", { count: s.bestHintsUsed }),
      ].filter(Boolean).join(" · ")),
    ])
  );
  const recentRows = solveHistory.recentSolves(10).map((e) =>
    el("li", {}, [
      el("span", {}, `${dateOf(e.at)} — `),
      el("strong", {}, e.title || "—"),
      el("span", { class: "muted" }, ` · ${e.elapsedSeconds != null ? formatElapsed(e.elapsedSeconds) : "—"} · ` + (e.hintsUsed === 0 ? t("senza suggerimenti") : t("suggerimenti: {count}", { count: e.hintsUsed }))),
    ])
  );

  root.appendChild(
    el("div", { class: "panel solve-history" }, [
      el("h3", {}, t("📜 Il tuo storico")),
      average != null ? el("p", { class: "muted" }, t("Tempo medio di risoluzione: {time}", { time: formatElapsed(average) })) : null,
      el("h4", {}, t("Per caso")),
      el("ul", { class: "history-list" }, caseRows),
      el("h4", {}, t("Ultime risoluzioni")),
      el("ul", { class: "history-list" }, recentRows),
      el("p", { class: "muted" }, t("Lo storico resta solo su questo dispositivo.")),
    ])
  );
}
