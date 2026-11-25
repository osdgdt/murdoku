// Searching a case with a second unknown beside the places (the hidden roles, the names of unknown places). Both work the
// same way: for every assignment worth trying (a generator), the ordinary search runs with that assignment known, and
// what the caller wants to know is where the people stand, so solutions are counted over the PLACES: the same places
// reached with two different assignments are one solution.
//
// `solveOverAssignments({ options, solve, assignments, attach, annotate })`:
//   assignments()  a fresh generator of the assignments to try (called twice: to count them, for the progress bar, then to run)
//   attach(a)      the puzzle to hand to `solve` with the assignment `a` known
//   annotate(s,a)  the solution `s` (a list of placements) as it is reported, e.g. with each person's role
// The result has the same shape as the plain search's.

const placementsKey = (solution) =>
  solution
    .map((p) => `${p.characterId}:${p.row},${p.col}`)
    .sort()
    .join("|");

export function solveOverAssignments({ options, solve, assignments, attach, annotate = (solution) => solution }) {
  const maxSolutions = options.maxSolutions ?? 2;
  const stats = options.stats || null;
  const total = { nodesVisited: 0, evaluations: 0, nodeCapHit: false, workCapHit: false, timedOut: false };
  const found = [];
  const seen = new Set();

  let tried = 0;
  let howMany = 0;
  // only to tell the progress: counting is far cheaper than searching
  for (const counting = assignments(); !counting.next().done;) howMany++;
  for (const assignment of assignments()) {
    const own = {};
    const budgetNodes = (options.maxNodes ?? Infinity) - total.nodesVisited;
    const budgetWork = (options.maxWork ?? Infinity) - total.evaluations;
    const done = tried;
    const solutions = solve(attach(assignment), {
      ...options,
      stats: own,
      maxNodes: budgetNodes,
      maxWork: budgetWork,
      onProgress: options.onProgress ? (fraction) => options.onProgress((done + fraction) / howMany) : null,
    });
    tried++;
    total.nodesVisited += own.nodesVisited ?? 0;
    total.evaluations += own.evaluations ?? 0;
    total.nodeCapHit ||= !!own.nodeCapHit;
    total.workCapHit ||= !!own.workCapHit;
    total.timedOut ||= !!own.timedOut;
    for (const solution of solutions) {
      const key = placementsKey(solution);
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(annotate(solution, assignment));
    }
    if (found.length >= maxSolutions || total.nodeCapHit || total.workCapHit || total.timedOut) break;
  }
  if (stats) Object.assign(stats, total);
  return found.slice(0, maxSolutions);
}
