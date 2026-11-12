// Budgets and caps shared by the hint computation (hints.js) and the clue
// explanation (hintExplain.js).

// Generous but bounded budgets: at this app's scale (grids capped at 9x9,
// characters capped at 9 by the editor) a well-clued puzzle exhausts its true
// solution count almost immediately; these caps only matter for lightly-clued
// puzzles, where hitting one means "don't know" rather than a guess. Raised
// substantially from the previous round's ~1.5s-per-click target — the user
// explicitly asked for deeper deduction over raw speed ("vari passi avanti,
// non ho vincoli di tempo") — while HINT_TOTAL_TIME_BUDGET_MS still keeps the
// tab from ever looking hung (browsers start showing "page unresponsive"
// somewhere around 5-10s of continuously-blocked main thread; this stays
// under that with margin). True "no limit" would need moving the computation
// off the main thread (a Web Worker — straightforward with this app's native
// ES modules) or chunking it between waves; that's a threading/UX change,
// out of scope here, and left as a follow-up rather than silently assumed.
export const HINT_MAX_SOLUTIONS = 2000;
// Shared across every wave of ONE computeHintChain() call (not re-granted
// per wave) — a richer, multi-wave chain could otherwise cost several times
// this in the worst case.
export const HINT_MAX_NODES = 2000000;
// More modest than the primary pool on purpose: called in an up-to-9x loop
// (once per currently-placed character), so 9 x this stays comfortably
// inside HINT_MAX_NODES even in the worst case.
export const CULPRIT_MAX_NODES = 150000;
// Budget for the "which clues are involved" leave-one-out re-solves (§ attachInvolvedClues),
// also shared across the whole chain — this is explanation quality, not fact
// soundness, so it's fine for it to run out and fall back conservatively.
// Kept modest (not scaled with HINT_MAX_NODES) since it's also loop-called,
// once per clue — potentially dozens of times per chain.
export const INVOLVED_CLUE_TEST_MAX_NODES = 150000;
// Must match HINT_MAX_SOLUTIONS exactly: comparing a leave-one-out re-solve
// against a SMALLER solution cap than the fact was originally derived under
// risks a silent false negative (the reduced search simply not having reached
// a branch that would disprove the fact) with no nodeCapHit/solutionCap
// signal to catch it, since solvePuzzle's search order is deterministic.
export const INVOLVED_CLUE_TEST_MAX_SOLUTIONS = HINT_MAX_SOLUTIONS;
// Primary backstop for the whole computeHintChain() call: propagation's cost
// isn't measured in "solver nodes" at all, so a wall-clock deadline is the
// only thing that uniformly bounds propagation + exhaustive solves +
// explanation re-solves together. See the comment above HINT_MAX_SOLUTIONS
// for why this specific value.
export const HINT_TOTAL_TIME_BUDGET_MS = 8000;
// UX cap, not a soundness one: a character that stays genuinely ambiguous
// could have dozens of remaining candidate cells — no point listing them all.
export const HINT_MAX_ELIMINATIONS_PER_WAVE = 8;
// Deeper deduction (naked-subset cascades, forward-checked exhaustive solves)
// can plausibly produce more distinct one-placement-per-wave advances before
// a chain naturally terminates.
export const HINT_CHAIN_MAX_STEPS = 120;

export function createBudget() {
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const deadline = now() + HINT_TOTAL_TIME_BUDGET_MS;
  return {
    waveNodesRemaining: HINT_MAX_NODES,
    involvedClueNodesRemaining: INVOLVED_CLUE_TEST_MAX_NODES,
    expired() {
      return now() >= deadline;
    },
    spendWaveNodes(n) {
      this.waveNodesRemaining = Math.max(0, this.waveNodesRemaining - (n || 0));
    },
    spendInvolvedClueNodes(n) {
      this.involvedClueNodesRemaining = Math.max(0, this.involvedClueNodesRemaining - (n || 0));
    },
  };
}
