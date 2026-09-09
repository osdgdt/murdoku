// Worker entry point: runs the three heavy, potentially-slow solver
// operations (computeHintChain, deriveSolution, checkUniqueness) off the
// main thread, so a pathologically slow search (some clue predicates are
// only decidable once the board is complete, and solvePuzzle has no
// internal wall-clock check) never freezes the page — only the requester
// waits, everything else on the page stays interactive. Pure message
// dispatch, no DOM/window access is available or needed here (none of the
// imported modules touch document/window).
//
// Protocol:
//   request  -> { id: number, type: "computeHintChain"|"deriveSolution"|"checkUniqueness", payload }
//   response -> { id: number, ok: true, result } | { id: number, ok: false, error: string }
// `error` is always a plain string (not an Error instance) — reconstructed
// as a real Error on the client side instead, avoiding any doubt about
// Error's structured-clone support varying across engines.
import { computeHintChain } from "./hints.js";
import { deriveSolution } from "./deriveSolution.js";
import { checkUniqueness } from "./validator.js";

const HANDLERS = {
  computeHintChain: (payload) => computeHintChain(payload.puzzle, payload.currentPlacements, payload.candidates),
  deriveSolution: (payload) => deriveSolution(payload.puzzle, payload.options || {}),
  checkUniqueness: (payload) => checkUniqueness(payload.puzzle, payload.options || {}),
};

self.onmessage = (event) => {
  const { id, type, payload } = event.data || {};
  const handler = HANDLERS[type];
  if (!handler) {
    self.postMessage({ id, ok: false, error: `Tipo di richiesta sconosciuto: ${type}` });
    return;
  }
  try {
    self.postMessage({ id, ok: true, result: handler(payload) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err && err.message) || String(err) });
  }
};
