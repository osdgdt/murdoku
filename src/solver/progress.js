// Small helpers for showing how far a long job has got. Pure: used by the solver modules (in the worker) and by the
// page (solverClient.js, the progress bar).

// A progress callback that only ever hears of a value larger than the last one it was given: a job that starts a new
// search (the slices of a parallel search, the next wave of a hint, the next attempt of the clue composer) begins from
// zero again, and the bar must never step back. Values are held between 0 and 1. `null` stays `null`.
export function monotonic(onProgress) {
  if (!onProgress) return null;
  let last = -1;
  return (fraction) => {
    const value = Math.min(1, Math.max(0, fraction));
    if (value > last) {
      last = value;
      onProgress(value);
    }
  };
}

// The bar of a job made of an UNKNOWN number of stages (waves of deduction, attempts at a clue set): stage k (0, 1, ...)
// at `fraction` of its own way. Stage 0 covers `firstCovers` of the bar (the first one does most of the work, and
// most jobs have one or two), stage 1 the same share of what is left, and so on; so the value never goes back
// whatever the number of stages, and never reaches 1.
export function staged(stage, fraction, firstCovers = 0.8) {
  return 1 - (1 - firstCovers) ** stage * (1 - firstCovers * Math.min(1, Math.max(0, fraction)));
}
