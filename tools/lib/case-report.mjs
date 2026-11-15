// What is wrong (or doubtful) about a case, in plain words — for the author of a library case, before it goes
// into examples/library/. The same functions back `npm run check:case` and the library tests, so the rules an
// author is warned about are exactly the ones the test suite enforces.
//
//   errors    the case cannot go in the library (or is broken): no/many solutions, the declared solution breaks a
//             rule, a house rule of generated cases is not respected.
//   warnings  worth a look, never blocking: superfluous clues, a declared difficulty far from what the solver
//             measures, a search that did not finish.
import { validatePuzzleShape, DIFFICULTY_LEVELS, estimateDifficulty, difficultyLabel } from "../../src/model/puzzle.js";
import { migratePuzzle } from "../../src/model/migrations.js";
import { validateSolution, checkUniqueness } from "../../src/solver/validator.js";
import { analyzePuzzle } from "../../src/solver/analysis.js";
import { findRedundantClues } from "../../src/solver/redundancy.js";

// House rules of the bundled cases (see tools/cases/library.mjs): the victim is the last character, her name starts
// with V, the suspects are in alphabetical order, one character per row, no clue about the victim, no "closer to",
// no diagonal towards a room, and the briefing never names a room. Returns a list of problems (empty = fine).
export function houseRuleProblems(puzzle, lang) {
  const problems = [];
  const victim = puzzle.characters[puzzle.characters.length - 1];
  if (!victim?.isVictim || puzzle.characters.filter((x) => x.isVictim).length !== 1) {
    problems.push("la vittima deve essere l'ultima della lista dei personaggi (e l'unica)");
    return problems; // the other rules refer to her
  }
  if (!/^V/i.test(victim.name)) problems.push(`il nome della vittima («${victim.name}») deve iniziare con la V`);
  const suspects = puzzle.characters.slice(0, -1).map((x) => x.name);
  for (let i = 1; i < suspects.length; i++) {
    if (suspects[i - 1].localeCompare(suspects[i], lang) >= 0)
      problems.push(`i sospettati vanno in ordine alfabetico: «${suspects[i - 1]}» prima di «${suspects[i]}»`);
  }
  if (puzzle.grid.size.rows !== puzzle.characters.length) {
    problems.push("serve un personaggio per riga (righe = personaggi), così alla vittima resta una sola casella");
  }
  const zones = new Set(puzzle.grid.zones.map((z) => z.id));
  for (const k of puzzle.clues) {
    if (k.characterId === victim.id || JSON.stringify(k.params).includes(victim.id)) problems.push(`l'indizio ${k.id} riguarda la vittima`);
    if (k.type === "closerTo") problems.push(`l'indizio ${k.id} usa «è più vicino a»`);
    if (k.type === "diagonal" && zones.has(k.params.targetId)) problems.push(`l'indizio ${k.id} è una diagonale rispetto a una stanza`);
  }
  for (const z of puzzle.grid.zones) if (puzzle.briefing?.includes(z.name)) problems.push(`il briefing nomina la stanza «${z.name}»`);
  return problems;
}

// The Italian and the English file of a case must be the same case: same map, clues, solution and cast.
export function pairProblems(it, en) {
  const problems = [];
  const same = (what, a, b) =>
    JSON.stringify(a) !== JSON.stringify(b) && problems.push(`${what} diversi tra la versione italiana e quella inglese`);
  same("celle", it.grid.cells, en.grid.cells);
  same("indizi", it.clues, en.clues);
  same("soluzione", it.solution, en.solution);
  same(
    "id dei personaggi",
    it.characters.map((x) => x.id),
    en.characters.map((x) => x.id)
  );
  if (!it.title || !en.title) problems.push("manca il titolo in una delle due lingue");
  if (/\{(victimRoom|murderer|room)\}/.test(JSON.stringify(it) + JSON.stringify(en)))
    problems.push("segnaposto ({murderer}, {room}…) non sostituiti");
  return problems;
}

const levelIndex = (value) => DIFFICULTY_LEVELS.findIndex((d) => d.value === (value || ""));

// `library`: also apply the house rules of library cases. `lang` is "it" | "en" (alphabetical order, accents).
export async function reportCase(raw, { lang = "it", library = true, maxNodes = 3_000_000, timeMs = null } = {}) {
  const errors = [];
  const warnings = [];
  const puzzle = migratePuzzle(JSON.parse(JSON.stringify(raw)));
  const shape = validatePuzzleShape(puzzle);
  if (!shape.valid) return { errors: shape.errors.map((e) => `file non valido: ${e}`), warnings, metrics: {} };
  if (puzzle.characters.length < 2) errors.push("servono almeno due personaggi");
  if (puzzle.clues.length === 0) errors.push("non ci sono indizi");

  const metrics = { characters: puzzle.characters.length, clues: puzzle.clues.length, declared: puzzle.difficulty || "" };

  const solution = validateSolution(puzzle);
  if (!solution.valid) for (const v of solution.violations) errors.push(`la soluzione dichiarata non rispetta una regola: ${v.message}`);

  const analysis = analyzePuzzle(puzzle, { maxNodes, timeMs });
  Object.assign(metrics, { status: analysis.status, nodes: analysis.nodes, forced: analysis.forced });
  if (analysis.status === "contradiction") errors.push("gli indizi si contraddicono: non esiste nessuna soluzione");
  else if (analysis.status === "none") errors.push("nessuna soluzione: gli indizi non ammettono alcuna disposizione");
  else if (analysis.status === "ambiguous") errors.push("più di una soluzione: servono altri indizi per renderla unica");
  else if (analysis.status === "limit")
    errors.push(`la ricerca non è finita entro il limite (${analysis.nodes} nodi): non posso dire se la soluzione è unica`);

  if (analysis.status === "unique") {
    const estimated = estimateDifficulty({ forced: analysis.forced, total: analysis.total, nodes: analysis.nodes });
    metrics.estimated = estimated;
    if (puzzle.difficulty && Math.abs(levelIndex(estimated) - levelIndex(puzzle.difficulty)) >= 2) {
      warnings.push(
        `difficoltà dichiarata «${difficultyLabel(puzzle.difficulty)}», ma il solutore la stima «${difficultyLabel(estimated)}» (${analysis.forced} su ${analysis.total} personaggi si deducono subito, ${analysis.nodes} nodi): ricontrolla`
      );
    } else if (!puzzle.difficulty) {
      warnings.push(`difficoltà non specificata (il solutore stima «${difficultyLabel(estimated)}», ${analysis.nodes} nodi)`);
    }
    const redundancy = await findRedundantClues(puzzle, async (candidate) =>
      checkUniqueness(candidate, { maxSolutions: 2, forwardCheck: true, maxNodes })
    );
    metrics.redundant = redundancy.redundant ?? [];
    if (redundancy.ok && redundancy.redundant.length)
      warnings.push(`indizi superflui (la soluzione resta unica senza ciascuno di loro): ${redundancy.redundant.join(", ")}`);
    else if (!redundancy.ok && redundancy.reason === "limit")
      warnings.push("non sono riuscito a controllare gli indizi superflui entro il limite");
  }

  if (library) for (const problem of houseRuleProblems(puzzle, lang)) errors.push(`regola della libreria: ${problem}`);
  return { errors, warnings, metrics };
}
