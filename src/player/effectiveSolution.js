// The "answer key" used for win-checking, the murderer reveal and the hint
// system's last-resort fallback — never taken on trust from the file.
//
// A declared solution that passes validateSolution() (row/col-distinct,
// satisfies every clue) is only a CANDIDATE, not a proof: validateSolution
// never checks uniqueness. An author who never ran "Verifica unicità" could
// ship an ambiguous puzzle; blindly trusting puzzle.solution.placements would
// then mark a player's equally-valid alternative wrong and name an arbitrary
// murderer among several valid ones. So a clue-consistent declared solution is
// CONFIRMED (confirmDeclaredSolutionUnique) before use; anything else
// (missing, incomplete, wrong) is derived from the clues off the main thread.
//
// Computed lazily and memoized as an in-flight PROMISE (not the resolved
// value) so a submit and a hint request arriving close together share one
// call instead of racing into two.
import { zoneOfCell } from "../model/grid.js";
import { validateSolution } from "../solver/validator.js";
import { deriveSolutionAsync, checkUniquenessAsync } from "../solver/solverClient.js";
import { t } from "../i18n/i18n.js";

export const SOLUTION_UNSATISFIABLE_MSG =
  t("Gli indizi di questo caso non ammettono nessuna soluzione: il caso non può essere risolto così com'è. Se sei l'autore, correggilo nell'editor.");
export const SOLUTION_AMBIGUOUS_MSG =
  t("Gli indizi di questo caso ammettono più soluzioni diverse: non è possibile stabilire con certezza quale sia quella corretta. Se sei l'autore, usa \"Verifica unicità\" nell'editor per individuare l'ambiguità.");
export const SOLUTION_INCONCLUSIVE_MSG =
  t("Non riesco a stabilire con certezza la soluzione di questo caso: gli indizi lasciano lo spazio di ricerca troppo ampio anche per un'analisi approfondita. Se sei l'autore, aggiungi indizi più stringenti.");

// Budget for confirming an already clue-consistent declared solution is also
// the UNIQUE one — well under deriveSolution.js's cap (10,000,000): with
// forwardCheck:true this is still ~5x deeper than the editor's own "Verifica
// unicità" click, while staying an order of magnitude cheaper than the full
// from-scratch derive it escalates to on the rare puzzle this can't settle.
const DECLARED_SOLUTION_CHECK_MAX_NODES = 1_000_000;

// `deps` is injectable so the logic is unit-testable without a Web Worker.
export function createEffectiveSolution(puzzle, deps = { deriveSolutionAsync, checkUniquenessAsync, validateSolution }) {
  let promise = null;

  // Don't freeze a transient failure (e.g. a worker hiccup) into a permanent
  // one for the rest of the page's life: the next attempt retries.
  const retryable = (p) =>
    p.catch((err) => {
      promise = null;
      throw err;
    });

  // checkUniqueness has no fixedPlacements support: it re-searches the clues
  // from scratch under a smaller node cap. solutionCount can never be 0 here —
  // validateSolution() already proved the declared solution is one valid solution.
  function confirmDeclaredSolutionUnique() {
    return deps
      .checkUniquenessAsync(puzzle, { maxSolutions: 2, forwardCheck: true, maxNodes: DECLARED_SOLUTION_CHECK_MAX_NODES })
      .then((report) => {
        if (report.solutionCount >= 2) return { status: "ambiguous", placements: null };
        if (report.solutionCount === 1 && !report.truncated) return { status: "unique", placements: puzzle.solution.placements };
        // The cheap tier couldn't settle it — escalate instead of guessing.
        return deps.deriveSolutionAsync(puzzle);
      });
  }

  return {
    get() {
      if (!promise) {
        promise = retryable(deps.validateSolution(puzzle).valid ? confirmDeclaredSolutionUnique() : deps.deriveSolutionAsync(puzzle));
      }
      return promise;
    },
  };
}

// Name of the character alone with the victim in the victim's room, or null
// whenever the answer isn't a proven unique one.
export function murdererName(puzzle, effective) {
  if (!effective || effective.status !== "unique") return null;
  const victim = puzzle.characters.find((c) => c.isVictim);
  if (!victim) return null;
  const vPlacement = effective.placements.find((p) => p.characterId === victim.id);
  if (!vPlacement) return null;
  const vZone = zoneOfCell(puzzle.grid, vPlacement.row, vPlacement.col);
  if (vZone === null) return null;
  const sameZoneChars = effective.placements.filter((p) => p.characterId !== victim.id && zoneOfCell(puzzle.grid, p.row, p.col) === vZone);
  if (sameZoneChars.length !== 1) return null;
  const murderer = puzzle.characters.find((c) => c.id === sameZoneChars[0].characterId);
  return murderer ? murderer.name : null;
}
