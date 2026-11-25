import { hasHiddenNames, hiddenNameZones, placeNameLabels, withNames } from "../model/placeNames.js";
import { solveOverAssignments } from "./assignments.js";

// Searching a case with places whose name is to be deduced (model/placeNames.js). Which room carries which name is a
// second unknown: for every way of giving the names to the hidden rooms (every permutation: the names are those of the
// rooms themselves), the ordinary search runs with that assignment known (`puzzle.nameOf`, read by the predicate of
// «è nel luogo chiamato X»). Solutions are counted over the PLACES (see assignments.js).
//
// `solveWithNames(puzzle, options, solve)` takes the plain search as `solve` (solver.js passes itself: this module must
// not import it back).

// Every Map<zoneId, name> that gives each hidden room one of the names, each name once.
export function* nameAssignments(puzzle) {
  const zones = hiddenNameZones(puzzle.grid);
  const labels = placeNameLabels(puzzle.grid);
  const chosen = new Map();
  const taken = new Set();
  function* assign(index) {
    if (index === zones.length) {
      yield new Map(chosen);
      return;
    }
    for (const label of labels) {
      if (taken.has(label)) continue;
      taken.add(label);
      chosen.set(zones[index].id, label);
      yield* assign(index + 1);
      chosen.delete(zones[index].id);
      taken.delete(label);
    }
  }
  yield* assign(0);
}

export function solveWithNames(puzzle, options, solve) {
  if (!hasHiddenNames(puzzle)) return solve(puzzle, options);
  return solveOverAssignments({
    options,
    solve,
    assignments: () => nameAssignments(puzzle),
    attach: (nameOf) => withNames(puzzle, nameOf),
  });
}
