// Minimal browser-API shims so the (browser-first) test suite also runs under
// plain Node: `npm test`. Only what the tests actually touch is emulated.

class MemoryStorage {
  #map = new Map();
  get length() {
    return this.#map.size;
  }
  key(i) {
    return [...this.#map.keys()][i] ?? null;
  }
  getItem(k) {
    return this.#map.has(String(k)) ? this.#map.get(String(k)) : null;
  }
  setItem(k, v) {
    this.#map.set(String(k), String(v));
  }
  removeItem(k) {
    this.#map.delete(String(k));
  }
  clear() {
    this.#map.clear();
  }
}

export function installLocalStorage() {
  globalThis.localStorage = new MemoryStorage();
}

// In-process stand-in for the solver Web Worker: loads solverWorker.js against
// a fake `self` and round-trips messages through structuredClone, which is the
// same data-fidelity constraint a real postMessage imposes.
export function installWorkerShim() {
  let ready = null;
  const workerScope = { onmessage: null, postMessage: null };
  // The real page has one worker per job kind ("main", "hints"); here they all share this one
  // in-process scope, so a reply is routed back to whichever fake worker sent that request.
  const senders = new Map(); // request id -> FakeWorker
  workerScope.postMessage = (data) => {
    const sender = senders.get(data?.id);
    if (data?.ok !== undefined) senders.delete(data?.id); // a progress message is not the answer: the request stays open
    queueMicrotask(() => sender?.onmessage?.({ data: structuredClone(data) }));
  };
  globalThis.Worker = class FakeWorker {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
      if (!ready) {
        globalThis.self = workerScope;
        ready = import("../../src/solver/solverWorker.js");
      }
    }
    postMessage(data) {
      const clone = structuredClone(data);
      senders.set(clone.id, this);
      ready.then(() => workerScope.onmessage({ data: clone }));
    }
    terminate() {}
  };
}
