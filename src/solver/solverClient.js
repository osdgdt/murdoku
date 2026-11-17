import { getLanguage } from "../i18n/i18n.js";
import { WORKER_GRACE_MS } from "./limits.js";
// Thin Promise-based wrapper around lazily-created solver Workers. Every exported *Async function
// returns a Promise that resolves with the callee's normal return value or rejects with a real
// Error, so a slow or pathological search runs off the main thread and can never freeze the page.
//
// Four workers, so one slow job never blocks an unrelated one:
//   "main"  — what the editor and the answer key need: uniqueness checks, deriving the solution
//   "preview" — the editor's live difficulty preview (cancelled and restarted on every edit, so it must
//             never share a worker with a check the author asked for)
//   "compose" — the editor's "Propose a set of clues" (can run for many seconds; cancellable)
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

// ---- remembering what was settled -----------------------------------------------------------------------------
// "Verifica unicità", the check before sharing or exporting and "Calcola soluzione" all search the same case to the end,
// and an author runs them one after the other on a case that has not changed. Whenever a search ENDS in a verdict
// ("exactly one solution" / "none"), it is remembered, and the next such request for the same case is answered from it
// without a search; a result a limit cut short is never remembered. Only what the solver reads takes part in the key
// (map, cast, clues), so editing a title or the declared solution keeps it, and changing a clue drops it.
const settled = new Map(); // key -> { status: "unique" | "unsatisfiable", placements: [{characterId,row,col}] | null }
const SETTLED_MAX = 16;

function settledKey(puzzle) {
  const { size, cells, zones, objects } = puzzle.grid;
  return JSON.stringify([
    size,
    cells.map((row) => row.map((c) => [c.zoneId, c.objectId, !!c.blocked])),
    zones.map((z) => z.id),
    objects.map((o) => [o.id, o.typeId, o.row, o.col, o.side ?? null]),
    puzzle.characters.map((c) => [c.id, c.gender ?? null, !!c.isVictim]),
    puzzle.clues.map((c) => [c.id, c.characterId, c.type, c.params ?? null, !!c.negate]),
  ]);
}

// Forgets everything settled so far (tests that need a real search to cancel, or a changed rule of the solver).
export function forgetSettledResults() {
  settled.clear();
}

function remember(key, status, placements) {
  settled.delete(key); // re-inserted last, so the oldest goes first
  settled.set(key, { status, placements });
  if (settled.size > SETTLED_MAX) settled.delete(settled.keys().next().value);
}

// A search that was not steered by a caller's own placements/domains and that ran to its end with at least room for two
// solutions (so "one found" really means "one exists").
const plainUniquenessRequest = (options) =>
  !options.fixedPlacements && !options.domains && !options.shouldStop && (options.maxSolutions ?? 2) >= 2;

export function deriveSolutionAsync(puzzle, options = {}, callOptions = {}) {
  const key = settledKey(puzzle);
  const known = settled.get(key);
  if (known && !callOptions.signal?.aborted)
    return Promise.resolve(structuredClone({ status: known.status, placements: known.placements }));
  return callWorker("main", "deriveSolution", { puzzle, options }, { timeMs: options.timeMs ?? null, ...callOptions }).then((result) => {
    if (result.status === "unique" || result.status === "unsatisfiable") remember(key, result.status, result.placements ?? null);
    return result;
  });
}

export function checkUniquenessAsync(puzzle, options = {}, callOptions = {}) {
  const plain = plainUniquenessRequest(options);
  const key = plain ? settledKey(puzzle) : null;
  const known = plain ? settled.get(key) : null;
  if (known && !callOptions.signal?.aborted) {
    const solutions = known.status === "unique" ? [structuredClone(known.placements)] : [];
    return Promise.resolve({
      solutionCount: solutions.length,
      unique: solutions.length === 1,
      solutions,
      truncated: false,
      exhausted: true,
      stoppedBy: null,
      nodesVisited: 0,
      evaluations: 0,
    });
  }
  return callWorker("main", "checkUniqueness", { puzzle, options }, { timeMs: options.timeMs ?? null, ...callOptions }).then((report) => {
    if (plain && report.exhausted && report.solutionCount === 1) remember(key, "unique", report.solutions[0]);
    else if (plain && report.exhausted && report.solutionCount === 0) remember(key, "unsatisfiable", null);
    return report;
  });
}

// The editor's live preview: a quick analysis of the case (see analysis.js), on its own worker.
export function analyzePuzzleAsync(puzzle, options = {}, callOptions = {}) {
  return callWorker("preview", "analyze", { puzzle, options }, { timeMs: options.timeMs ?? null, ...callOptions });
}

// The editor's "Propose a set of clues" (see composer.js), on its own worker; cancellable with a signal.
export function composeCluesAsync(puzzle, options = {}, callOptions = {}) {
  return callWorker("compose", "compose", { puzzle, options }, { timeMs: options.timeMs ?? null, ...callOptions });
}
