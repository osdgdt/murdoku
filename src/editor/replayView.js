// «Come si risolve» in the editor: the board of a person who solves the case the way the human solver does, after each of its
// steps (src/solver/techniques/replay.js): the notes, the X's and the placements. Under the list of the reasonings a case needs.
//   ◀ ▶ ⏮ ⏭ and a slider walk the steps; «next reasoning» and «next placement» jump; ▶ Play goes on by itself; by default only
//   the notes of the character the step is about are drawn (every character is a note on every cell, which on a big grid is not
//   readable), «Show everybody's notes» draws them all. The cells the step touches are outlined, and a sentence says what it did.
// The board is a picture (inert): the sentence under it, read aloud as it changes, says the same in words.
import { el, clear } from "../util/dom.js";
import { renderPlayerBoard } from "../player/boardView.js";
import { describeClue } from "../model/clueTypes.js";
import { createReplayer, navigationSteps, navigationPositionOf } from "../solver/techniques/replay.js";
import { techniqueName, techniqueText } from "../solver/techniques/names.js";
import { t } from "../i18n/i18n.js";

const PLAY_INTERVAL_MS = 900;

// `puzzle`: the case AS IT WAS ANALYSED (a copy: the author may have edited since); `trace`: its compact steps (replay.js).
export function createReplayView({ puzzle, trace }) {
  const nav = navigationSteps(trace);
  const replayer = createReplayer(puzzle, nav);
  const total = nav.length;
  let position = 0;
  let showEverybody = false;
  let timer = null;

  const nameOf = (id) => puzzle.characters.find((c) => c.id === id)?.name ?? "?";
  const button = (label, onClick, extra = {}) => el("button", { type: "button", class: "replay-btn", onClick, ...extra }, label);

  const first = button("⏮", () => goTo(0), { "aria-label": t("Torna all'inizio"), title: t("Torna all'inizio") });
  const prev = button("◀", () => goTo(position - 1), { "aria-label": t("Passo precedente"), title: t("Passo precedente") });
  const next = button("▶", () => goTo(position + 1), { "aria-label": t("Passo successivo"), title: t("Passo successivo") });
  const last = button("⏭", () => goTo(total), { "aria-label": t("Vai alla fine"), title: t("Vai alla fine") });
  const counter = el("span", { class: "replay-counter" });
  const slider = el("input", { type: "range", min: 0, max: total, value: 0, class: "replay-slider", "aria-label": t("Passo") });
  slider.addEventListener("input", () => goTo(Number(slider.value)));
  const nextReasoning = button(t("Ragionamento successivo"), () => {
    const now = position > 0 ? nav[position - 1].t : null;
    const at = nav.findIndex((step, i) => i >= position && step.t !== now);
    goTo(at < 0 ? total : at + 1);
  });
  const nextPlacement = button(t("Piazzamento successivo"), () => {
    const at = nav.findIndex((step, i) => i >= position && step.p);
    goTo(at < 0 ? total : at + 1);
  });
  const play = button("", () => (timer ? stop() : start()), { "aria-pressed": "false" });
  const everybody = el("input", { type: "checkbox", id: "replay-everybody" });
  everybody.addEventListener("change", () => {
    showEverybody = everybody.checked;
    draw();
  });
  const boardHolder = el("div", { class: "replay-board" });
  boardHolder.setAttribute("inert", "");
  const explanation = el("div", { class: "replay-explain", "aria-live": "polite" });

  const node = el("div", { class: "replay" }, [
    el("div", { class: "replay-bar" }, [first, prev, counter, next, last]),
    slider,
    el("div", { class: "replay-bar replay-jumps" }, [nextReasoning, nextPlacement, play]),
    el("label", { class: "replay-check", for: "replay-everybody" }, [everybody, " ", t("Mostra le note di tutti")]),
    boardHolder,
    explanation,
  ]);

  function start() {
    if (position >= total) goTo(0);
    timer = setInterval(() => {
      if (position >= total) return stop();
      goTo(position + 1);
    }, PLAY_INTERVAL_MS);
    draw();
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    draw();
  }

  function goTo(target) {
    position = Math.max(0, Math.min(total, target));
    if (timer && position >= total) stop();
    draw();
  }

  // the notes to draw: everybody's, or only the character the step is about (none before the first step)
  function visibleState(state, step) {
    if (showEverybody) return state;
    const candidates = new Map();
    if (step) {
      for (const [cell, set] of state.candidates) if (set.has(step.c)) candidates.set(cell, new Set([step.c]));
    }
    return { ...state, candidates };
  }

  function describe(step) {
    if (!step) {
      return [
        el("p", {}, t("Prima di cominciare: ogni personaggio è una nota su ogni casella.")),
        showEverybody
          ? null
          : el("p", { class: "muted" }, t("Si vedono solo le note del personaggio del passo: «Mostra le note di tutti» le mostra tutte.")),
      ];
    }
    const name = nameOf(step.c);
    const what = step.p
      ? step.t === "exhaustive"
        ? t("{name} sta nella casella evidenziata: si trova provando le possibilità.", { name })
        : t("{name} deve stare nella casella evidenziata: è l'unica rimasta.", { name })
      : t("{name}: {count} caselle in meno tra le sue note.", { name, count: step.e?.length ?? 0 });
    const clues = (step.k ?? []).map((id) => puzzle.clues.find((c) => c.id === id)).filter(Boolean);
    return [
      el("p", {}, [el("strong", {}, `${techniqueName(step.t)} `), what]),
      el("p", { class: "muted" }, techniqueText(step.t)),
      step.b?.length
        ? el("p", { class: "muted" }, t("Il ragionamento guarda anche: {names}.", { names: step.b.map(nameOf).join(", ") }))
        : null,
      clues.length
        ? el("div", {}, [
            el("strong", {}, t("Indizi usati:")),
            el(
              "ul",
              { class: "replay-clues" },
              clues.map((clue) => el("li", {}, (clue.characterId ? `${nameOf(clue.characterId)}: ` : "") + describeClue(clue, puzzle)))
            ),
          ])
        : null,
    ];
  }

  function draw() {
    const { state, changed, step } = replayer.goTo(position);
    // the cell size fits the width the board has (a big grid on a phone): 44 px at most, 24 px at least (below that the board scrolls)
    const room = (node.clientWidth || window.innerWidth - 40) - 56;
    const cell = Math.max(24, Math.min(44, Math.floor(room / puzzle.grid.size.cols)));
    boardHolder.style.setProperty("--cell-size", `${cell}px`);
    renderPlayerBoard(boardHolder, puzzle, visibleState(state, step));
    for (const { row, col } of changed)
      boardHolder.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`)?.classList.add("step-changed");
    counter.textContent = t("Passo {n} di {m}", { n: position, m: total });
    slider.value = String(position);
    slider.setAttribute("aria-valuetext", t("Passo {n} di {m}", { n: position, m: total }));
    first.disabled = prev.disabled = position === 0;
    next.disabled = last.disabled = nextReasoning.disabled = nextPlacement.disabled = position >= total;
    play.textContent = timer ? t("⏸ Pausa") : t("▶ Riproduci");
    play.setAttribute("aria-pressed", timer ? "true" : "false");
    clear(explanation);
    for (const child of describe(step)) if (child) explanation.appendChild(child);
  }

  draw();
  return {
    node,
    // from the list of the reasonings: the board at the first step of one (`index`: its place among ALL the steps, from 1)
    goToTechnique(technique, index) {
      if (technique === "rowColTaken") {
        // not a step of its own: it comes with the placement just before
        const before = nav.filter((step) => step.index < index).length;
        goTo(before);
      } else goTo(navigationPositionOf(nav, index));
      node.scrollIntoView?.({ block: "nearest" });
    },
    destroy() {
      clearInterval(timer);
      timer = null;
    },
  };
}
