// Thin Promise-based wrapper around a single lazily-created solver Worker
// (module-level singleton, created on first actual use, not at import time —
// mirrors gameScreen.js's own "compute lazily, only when first needed"
// philosophy). Every exported *Async function returns a Promise that
// resolves with the callee's normal return value or rejects with a real
// Error, so a slow or pathological search runs off the main thread and can
// never freeze the page — only whichever caller is awaiting it waits.
let worker = null;
let nextRequestId = 1;
const pending = new Map(); // requestId -> { resolve, reject }

function handleWorkerMessage(event) {
  const { id, ok, result, error } = event.data || {};
  const entry = pending.get(id);
  if (!entry) return; // unknown/stale id — nothing to do
  pending.delete(id);
  if (ok) entry.resolve(result);
  else entry.reject(new Error(error));
}

// A genuine worker-level failure (e.g. the module failed to load, or an
// exception escaped solverWorker.js's own try/catch) can't be attributed to
// one specific in-flight request, so every pending request is rejected and
// the dead worker is torn down — the next *Async call transparently spins up
// a fresh one instead of talking to a permanently broken instance forever.
function handleWorkerError(event) {
  const err = new Error(`Errore interno del worker del solver: ${event.message || "errore sconosciuto"}`);
  for (const { reject } of pending.values()) reject(err);
  pending.clear();
  if (worker) worker.terminate();
  worker = null;
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./solverWorker.js", import.meta.url), { type: "module" });
  worker.onmessage = handleWorkerMessage;
  worker.onerror = handleWorkerError;
  return worker;
}

function callWorker(type, payload) {
  const w = ensureWorker();
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, type, payload });
  });
}

export function computeHintChainAsync(puzzle, currentPlacements, candidates = new Map()) {
  return callWorker("computeHintChain", { puzzle, currentPlacements, candidates });
}

export function deriveSolutionAsync(puzzle, options = {}) {
  return callWorker("deriveSolution", { puzzle, options });
}

export function checkUniquenessAsync(puzzle, options = {}) {
  return callWorker("checkUniqueness", { puzzle, options });
}
