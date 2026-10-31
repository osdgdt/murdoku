// Hint-chain logic that doesn't touch the DOM (so it is unit-testable):
// which steps cost the player a hint, manual author-written chains, and the
// one-step oracle extension.
import { zoneOfCell } from "../model/grid.js";
import { t } from "../i18n/i18n.js";

// Which computeHintChain step types count as "a hint actually helped".
// tooComplex/noHint alone disclose zero new information about the puzzle, so
// they don't cost the player their "solved without hints" achievement.
export const REAL_HINT_STEP_TYPES = new Set(["forcedPlacement", "eliminatedCell", "contradiction"]);

export function chainDisclosesSomething(chain) {
  return chain.some((step) => REAL_HINT_STEP_TYPES.has(step.type));
}

// A case with at least one author-written step REPLACES the automatic engine
// entirely — never a hybrid fallback. A highlighted step reuses the literal
// "forcedPlacement" type so the rest of the UI handles it unchanged (and it
// counts toward hintsUsed); a text-only step is "manualNote", which is free.
export function buildManualHintChain(puzzle) {
  const steps = puzzle.manualHints || [];
  if (steps.length === 0) return null;
  return steps.map((step) =>
    step.characterId != null && step.row != null && step.col != null
      ? { type: "forcedPlacement", variant: "success", characterId: step.characterId, row: step.row, col: step.col, message: step.message || "" }
      : { type: "manualNote", variant: "info", message: step.message || "" }
  );
}

// Extends a freshly-computed chain with exactly ONE additional oracle-backed
// placement — never the rest of the solution — when pure logical deduction hit
// a genuine "too complex" wall but a deeper one-time pass has ALSO established
// the unique solution. Mutates `chain` in place.
//
// Soundness: if computeHintChain didn't report a contradiction, the player's
// placements are consistent with the clues; if the clues admit only ONE full
// solution, any completable clue-consistent assignment is a subset of it — so
// the revealed placement can never conflict with anything already confirmed.
export async function extendChainWithOracleStep(chain, { puzzle, placements, getEffectiveSolution }) {
  const last = chain[chain.length - 1];
  if (!last || last.type !== "tooComplex") return; // only extend the honest "stuck" case
  const effective = await getEffectiveSolution();
  if (effective.status !== "unique") return; // never reveal a guess, only a proven answer

  const confirmed = new Map(placements);
  for (const step of chain) {
    if (step.type === "forcedPlacement") confirmed.set(step.characterId, { row: step.row, col: step.col });
  }
  // Deterministic choice: first still-unplaced NON-victim in roster order
  // (the victim only once she's the sole one left) — same "reveal her last"
  // preference as computeWave in solver/hints.js.
  const next = puzzle.characters.find((c) => !confirmed.has(c.id) && !c.isVictim) || puzzle.characters.find((c) => !confirmed.has(c.id));
  if (!next) return;
  const target = effective.placements.find((p) => p.characterId === next.id);
  if (!target) return;

  const zoneId = zoneOfCell(puzzle.grid, target.row, target.col);
  const zone = zoneId && puzzle.grid.zones.find((z) => z.id === zoneId);
  const where = zone ? t(" (nella zona \"{name}\")", { name: zone.name }) : "";
  chain.push({
    type: "forcedPlacement",
    variant: "success",
    characterId: next.id,
    row: target.row,
    col: target.col,
    viaDerivedSolution: true,
    message: t("{name} deve trovarsi nella cella evidenziata{where}: lo rivela un'analisi completa del caso, non uno specifico indizio.", { name: next.name, where }),
  });
}
