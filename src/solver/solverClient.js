import { getLanguage } from "../i18n/i18n.js";
import { WORKER_GRACE_MS } from "./limits.js";
// Thin Promise-based wrapper around lazily-created solver Workers. Every exported *Async function
// returns a Promise that resolves with the callee's normal return value or rejects with a real
// Error, so a slow or pathological search runs off the main thread and can never freeze the page.
//
// Two workers, so one slow job never blocks an unrelated one:
//   "main"  — what the editor and the answer key need: uniqueness checks, deriving the solution
//   "hints" — a player's hint clicks (the answer key can take long to compute on a big grid, and a
//             hint must not wait behind it)
// A worker runs one job at a time, so a job that must stop (the author pressed Cancel, or it did
// not finish in time) is stopped by terminating its worker; the next call starts a fresh one.
//
// Every call takes `{ signal, timeMs }`: `signal` (an AbortSignal) cancels it; `timeMs` is the
// time the search itself is allowed (it checks its own deadline and answers "gave up"); the
// worker is only terminated if it has not answered WORKER_GRACE_MS after that.
const workers = new Map(); // name -> { worker, pending: Map(requestId -> { resolve, reject, timer }) }
let nextRequestId = 1;

// What a cancelled call rejects with (name "AbortError", like fetch).
export class SolverCancelled extends Error {
  constructor(message = "Operazione annullata.") {
    super(message);
    this.name = "AbortError";
  }
}

function rejectAll(slot, error) {
  for (const { reject, timer } of slot.pending.values()) {
    clearTimeout(timer);
    reject(error);
  }
  slot.pending.clear();
}

function dropWorker(name, error) {
  const slot = workers.get(name);
  if (!slot) return;
  workers.delete(name);
  slot.worker.terminate();
  rejectAll(slot, error);
}

function ensureWorker(name) {
  const existing = workers.get(name);
  if (existing) return existing;
  const worker = new Worker(new URL(`./solverWorker.js?lang=${getLanguage()}`, import.meta.url), { type: "module" });
  const slot = { worker, pending: new Map() };
  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data || {};
    const entry = slot.pending.get(id);
    if (!entry) return; // unknown/stale id — nothing to do
    slot.pending.delete(id);
    clearTimeout(entry.timer);
    if (ok) entry.resolve(result);
    else entry.reject(new Error(error));
  };
  // A genuine worker-level failure (the module failed to load, or an exception escaped the
  // worker's own try/catch) can't be attributed to one request: every pending request is
  // rejected and the dead worker is torn down, so the next call starts a fresh one.
  worker.onerror = (event) => {
    dropWorker(name, new Error(`Errore interno del worker del solver: ${event.message || "errore sconosciuto"}`));
  };
  workers.set(name, slot);
  return slot;
}

function callWorker(name, type, payload, { signal = null, timeMs = null } = {}) {
  if (signal?.aborted) return Promise.reject(new SolverCancelled());
  const slot = ensureWorker(name);
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    const entry = { resolve: null, reject: null, timer: null };
    const onAbort = () => {
      if (slot.pending.get(id) !== entry) return; // already answered
      slot.pending.delete(id);
      clearTimeout(entry.timer);
      reject(new SolverCancelled());
      // the worker is busy with this very job and cannot be interrupted any other way
      if (workers.get(name) === slot) dropWorker(name, new Error("Il calcolo è stato interrotto: riprova."));
    };
    const finish = (fn) => (value) => {
      signal?.removeEventListener("abort", onAbort);
      fn(value);
    };
    entry.resolve = finish(resolve);
    entry.reject = finish(reject);
    if (timeMs != null) {
      entry.timer = setTimeout(
        () => dropWorker(name, new Error("Il calcolo non ha risposto in tempo ed è stato interrotto.")),
        timeMs + WORKER_GRACE_MS
      );
    }
    slot.pending.set(id, entry);
    signal?.addEventListener("abort", onAbort, { once: true });
    slot.worker.postMessage({ id, type, payload });
  });
}

// Stops everything the editor's worker is doing (its pending calls reject with SolverCancelled).
export function cancelSolver(name = "main") {
  dropWorker(name, new SolverCancelled());
}

export function computeHintChainAsync(puzzle, currentPlacements, candidates = new Map(), callOptions = {}) {
  return callWorker("hints", "computeHintChain", { puzzle, currentPlacements, candidates }, callOptions);
}

export function deriveSolutionAsync(puzzle, options = {}, callOptions = {}) {
  return callWorker("main", "deriveSolution", { puzzle, options }, { timeMs: options.timeMs ?? null, ...callOptions });
}

export function checkUniquenessAsync(puzzle, options = {}, callOptions = {}) {
  return callWorker("main", "checkUniqueness", { puzzle, options }, { timeMs: options.timeMs ?? null, ...callOptions });
}
