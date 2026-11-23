// The judge of the machine-learning pipeline (ml/): given a case (and, if known, the solution printed in the source), says
// whether it is a valid Murdoku case, whether its solution is unique, whether it is the printed one, who the culprit is and
// what the human solver makes of it (level, hardest reasoning, steps). The same functions back `tools/ml-validate.mjs`,
// which Python calls as a subprocess (ml/murdoku_ml/validate.py), and the tests.
//
//   input   { puzzle, printed?: { placements: [{ name, row, col }] }, maxNodes? }     (row and col from 0)
//   output  { ok, stage, problems, solutionCount, unique, solution, matchesPrinted, mismatches, culprit, human, declared }
//     stage    where it stopped: "shape" (not a valid case), "search" (no / several / unknown solutions), "done"
//     ok       true only for a valid case with ONE solution that (when given) is the printed one
import { validatePuzzleShape } from "../../src/model/puzzle.js";
import { migratePuzzle } from "../../src/model/migrations.js";
import { analyzePuzzle } from "../../src/solver/analysis.js";
import { solvePuzzle } from "../../src/solver/solver.js";
import { zoneAt, victimId } from "../../src/solver/predicates/helpers.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export function validateForMl(input) {
  const out = {
    ok: false,
    stage: "shape",
    problems: [],
    solutionCount: 0,
    unique: false,
    solution: null,
    matchesPrinted: null,
    mismatches: [],
    culprit: null,
    human: null,
    declared: null,
  };
  let puzzle;
  try {
    puzzle = migratePuzzle(clone(input.puzzle));
  } catch (error) {
    out.problems.push(`il caso non si legge: ${error.message}`);
    return out;
  }
  const shape = validatePuzzleShape(puzzle);
  if (!shape.valid) {
    out.problems.push(...shape.errors);
    return out;
  }
  out.declared = puzzle.difficulty || null;
  if (puzzle.characters.length < 2) out.problems.push("servono almeno due personaggi");
  if (puzzle.clues.length === 0) out.problems.push("non ci sono indizi");
  if (out.problems.length > 0) return out;

  out.stage = "search";
  const analysis = analyzePuzzle(puzzle, { maxNodes: input.maxNodes ?? 3_000_000 });
  out.solutionCount = analysis.solutionCount ?? 0;
  if (analysis.status === "contradiction" || analysis.status === "none")
    out.problems.push("nessuna soluzione: gli indizi si contraddicono");
  else if (analysis.status === "ambiguous") out.problems.push("più di una soluzione: servono altri indizi");
  else if (analysis.status === "limit") out.problems.push("la ricerca non è finita entro il limite: non so se la soluzione è unica");
  if (analysis.status !== "unique") return out;

  out.stage = "done";
  out.unique = true;
  const name = (id) => puzzle.characters.find((c) => c.id === id)?.name ?? id;
  const [placements] = solvePuzzle(puzzle, { maxSolutions: 1 });
  out.solution = placements.map((p) => ({ name: name(p.characterId), row: p.row, col: p.col }));
  out.human = analysis.human ?? null;

  // the culprit: the one who shares the victim's room (the base rule says there is exactly one)
  const victim = victimId(puzzle);
  const where = new Map(placements.map((p) => [p.characterId, p]));
  if (victim && where.has(victim)) {
    const room = zoneAt(puzzle, where.get(victim));
    const others = placements.filter((p) => p.characterId !== victim && room !== null && zoneAt(puzzle, p) === room);
    if (others.length === 1) out.culprit = name(others[0].characterId);
  }

  if (input.printed?.placements) {
    const printed = new Map(input.printed.placements.map((p) => [p.name, p]));
    out.matchesPrinted = true;
    for (const p of out.solution) {
      const q = printed.get(p.name);
      if (!q || q.row !== p.row || q.col !== p.col) {
        out.matchesPrinted = false;
        out.mismatches.push({ name: p.name, found: [p.row, p.col], printed: q ? [q.row, q.col] : null });
      }
    }
    for (const name of printed.keys())
      if (!out.solution.some((p) => p.name === name))
        out.mismatches.push({ name, found: null, printed: [printed.get(name).row, printed.get(name).col] });
    if (out.mismatches.length > 0) out.matchesPrinted = false;
  }
  out.ok = out.matchesPrinted !== false;
  return out;
}
