// The editor's live difficulty preview: a line above the clues that says, as the author edits, how many
// solutions the clues leave and how hard the case looks, instead of a button to press.
//
// After every change to the case (not free text like the title) the analysis (solver/analysis.js) is scheduled
// a moment later, on a worker of its own; a newer edit cancels an older analysis that is still running, so a
// slow one on a big grid never piles up. The words say exactly what is known: "limit reached" is not
// "no solution".
import { el, clear } from "../util/dom.js";
import { estimateDifficulty, difficultyLabel } from "../model/puzzle.js";
import { analyzePuzzleAsync } from "../solver/solverClient.js";
import { limitsFor } from "../solver/limits.js";
import { t } from "../i18n/i18n.js";

const DEBOUNCE_MS = 700;

// What to write for an analysis result (pure, so it is tested without a page): { tone, text }.
export function describeAnalysis(result) {
  const { status, forced, total, nodes } = result;
  if (status === "unique") {
    const label = difficultyLabel(estimateDifficulty({ forced, total, nodes }));
    return {
      tone: "ok",
      text: t("✓ Soluzione unica · Difficoltà stimata: {level} · {nodes} nodi · dedotti subito: {forced} su {total}", {
        level: label,
        nodes,
        forced,
        total,
      }),
    };
  }
  if (status === "ambiguous") return { tone: "warn", text: t("⚠ Più di una soluzione: servono altri indizi per renderla unica") };
  if (status === "none" || status === "contradiction") return { tone: "bad", text: t("✗ Nessuna soluzione: gli indizi si contraddicono") };
  return { tone: "info", text: t("… Analisi non conclusa entro il limite: aggiungi indizi per restringere la ricerca") };
}

// `container`: where the line goes; `getPuzzle()`: the current puzzle.
export function createLivePreview({ container, getPuzzle }) {
  let timer = null;
  let controller = null;
  let sequence = 0;

  function show(tone, text) {
    clear(container);
    container.appendChild(el("span", { class: `difficulty-line ${tone}` }, text));
  }

  async function run() {
    const puzzle = getPuzzle();
    const mine = ++sequence;
    if (puzzle.characters.length < 2 || puzzle.clues.length === 0) {
      show("info", t("Aggiungi personaggi e indizi per vedere qui quante soluzioni restano e quanto è difficile."));
      return;
    }
    show("info", t("Analisi in corso…"));
    controller = new AbortController();
    const limits = limitsFor(puzzle).uniqueness;
    try {
      const result = await analyzePuzzleAsync(
        puzzle,
        { maxNodes: limits.maxNodes, timeMs: Math.min(4000, Math.round(limits.timeMs / 3)) },
        { signal: controller.signal }
      );
      if (mine !== sequence) return; // a newer edit has started its own analysis
      const { tone, text } = describeAnalysis(result);
      show(tone, text);
    } catch (err) {
      if (err?.name === "AbortError" || mine !== sequence) return;
      show("info", t("Analisi non disponibile."));
    }
  }

  return {
    // Call after every change to the case.
    schedule() {
      clearTimeout(timer);
      controller?.abort();
      controller = null;
      sequence++;
      timer = setTimeout(run, DEBOUNCE_MS);
    },
  };
}
