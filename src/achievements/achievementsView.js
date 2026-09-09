import { el, clear } from "../util/dom.js";
import { ACHIEVEMENTS } from "../model/achievements.js";
import * as achievementsStore from "../storage/achievementsStore.js";
import { formatElapsed } from "../util/time.js";

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
      el("div", { class: "achievement-stat" }, [el("strong", {}, String(stats.totalSolved)), el("span", {}, "casi risolti")]),
      el("div", { class: "achievement-stat" }, [el("strong", {}, String(stats.totalSolvedWithoutHints)), el("span", {}, "senza indizi")]),
      el("div", { class: "achievement-stat" }, [
        el("strong", {}, stats.fastestSolveSeconds != null ? formatElapsed(stats.fastestSolveSeconds) : "—"),
        el("span", {}, "miglior tempo"),
      ]),
    ])
  );

  const grid = el("div", { class: "achievement-grid" });
  for (const achievement of ACHIEVEMENTS) {
    const unlockedAt = unlocked[achievement.id];
    const dateLabel = unlockedAt
      ? new Date(unlockedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
      : null;
    grid.appendChild(
      el("div", { class: "achievement-tile" + (unlockedAt ? " unlocked" : " locked") }, [
        el("span", { class: "achievement-icon" }, unlockedAt ? "🏆" : "🔒"),
        el("h3", {}, achievement.title),
        el("p", { class: "muted" }, achievement.description),
        dateLabel
          ? el("span", { class: "unlock-date" }, `Sbloccato il ${dateLabel}`)
          : el("span", { class: "muted locked-label" }, "Non ancora sbloccato"),
      ])
    );
  }
  root.appendChild(grid);
}
