import { hasRoles, roleAllowsCell, withRoles } from "../model/roles.js";
import { isOccupiable } from "../model/grid.js";
import { buildPredicates } from "./predicates/index.js";
import { solveOverAssignments } from "./assignments.js";

// Searching a case with hidden roles. The roles are a second unknown beside the places, but they do not change how
// the places are searched: for every way of giving a role to each person that respects the declared numbers (and that
// no clue about roles alone rules out), the ordinary search runs with that assignment known (`puzzle.roleOf`, read by
// the predicates in predicates/roles.js). What the caller wants to know is where the people stand, so solutions are
// counted over the PLACES: the same places reached with two different assignments are one solution.
//
// `solveWithRoles(puzzle, options, solve)` takes the plain search as `solve` (solver.js passes itself: this module
// must not import it back). The result has the same shape as solve()'s, with a `role` on every placement.

// The roles a person may be given, in order: every role, then "no role" unless everybody must have one.
function roleChoices(puzzle) {
  const ids = puzzle.roles.defs.map((d) => d.id);
  return puzzle.roles.everyone ? ids : [...ids, null];
}

// The assignments Map<characterId, roleId|null> worth searching: the declared numbers hold, every person can stand
// somewhere (a cell their role allows), and no clue is false by the roles alone.
export function* roleAssignments(puzzle) {
  const characters = puzzle.characters;
  const choices = roleChoices(puzzle);
  const counts = puzzle.roles.counts || {};

  // Cells each role could use at all (a role whose squares are all reserved for others cannot be given to anyone).
  const usable = new Map();
  for (const role of choices) {
    let any = false;
    for (let r = 0; r < puzzle.grid.size.rows && !any; r++) {
      for (let c = 0; c < puzzle.grid.size.cols && !any; c++) {
        if (isOccupiable(puzzle.grid, r, c) && roleAllowsCell(puzzle, role, r, c)) any = true;
      }
    }
    usable.set(role, any);
  }

  // Judged with the roles known so far and nobody placed: only a clue that the roles alone contradict says false.
  const live = new Map();
  const judge = buildPredicates(withRoles(puzzle, live));
  const empty = new Map();
  const contradicted = () => judge.some(({ predicate }) => predicate(empty, false) === false);

  const used = new Map(choices.map((role) => [role, 0]));
  const capacityOf = (role) => (role !== null && Number.isInteger(counts[role]) ? counts[role] : Infinity);

  function* assign(index) {
    if (index === characters.length) {
      for (const role of choices) {
        if (role !== null && Number.isInteger(counts[role]) && used.get(role) !== counts[role]) return;
      }
      yield new Map(live);
      return;
    }
    // The people still to get a role must be enough to fill the numbers still missing.
    let missing = 0;
    for (const role of choices) if (role !== null && Number.isInteger(counts[role])) missing += Math.max(0, counts[role] - used.get(role));
    if (missing > characters.length - index) return;

    const character = characters[index];
    for (const role of choices) {
      if (!usable.get(role) || used.get(role) >= capacityOf(role)) continue;
      used.set(role, used.get(role) + 1);
      live.set(character.id, role);
      if (!contradicted()) yield* assign(index + 1);
      live.delete(character.id);
      used.set(role, used.get(role) - 1);
    }
  }
  yield* assign(0);
}

export function solveWithRoles(puzzle, options, solve) {
  if (!hasRoles(puzzle)) return solve(puzzle, options);
  return solveOverAssignments({
    options,
    solve,
    assignments: () => roleAssignments(puzzle),
    attach: (roleOf) => withRoles(puzzle, roleOf),
    annotate: (solution, roleOf) => solution.map((p) => ({ ...p, role: roleOf.get(p.characterId) ?? null })),
  });
}
