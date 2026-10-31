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
// NOTE: no static imports on purpose. The solver modules pull in i18n.js,
// which uses top-level await to load the English dictionary; a module worker
// whose graph is still evaluating when the first message arrives silently
// drops it. So `self.onmessage` is installed synchronously below, and the
// real modules are loaded lazily — requests simply wait on `ready`.
let handlers = null;
const ready = (async () => {
  const [{ computeHintChain }, { deriveSolution }, { checkUniqueness }] = await Promise.all([
    import("./hints.js"),
    import("./deriveSolution.js"),
    import("./validator.js"),
  ]);
  handlers = {
    computeHintChain: (payload) => computeHintChain(payload.puzzle, payload.currentPlacements, payload.candidates),
    deriveSolution: (payload) => deriveSolution(payload.puzzle, payload.options || {}),
    checkUniqueness: (payload) => checkUniqueness(payload.puzzle, payload.options || {}),
  };
})();

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    await ready;
  } catch (err) {
    self.postMessage({ id, ok: false, error: `Errore di caricamento del solver: ${(err && err.message) || String(err)}` });
    return;
  }
  const handler = handlers[type];
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
