// Minimal browser-API shims so the (browser-first) test suite also runs under
// plain Node: `npm test`. Only what the tests actually touch is emulated.

class MemoryStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  key(i) { return [...this.#map.keys()][i] ?? null; }
  getItem(k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null; }
  setItem(k, v) { this.#map.set(String(k), String(v)); }
  removeItem(k) { this.#map.delete(String(k)); }
  clear() { this.#map.clear(); }
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
  globalThis.Worker = class FakeWorker {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
      workerScope.postMessage = (data) => {
        queueMicrotask(() => this.onmessage?.({ data: structuredClone(data) }));
      };
      if (!ready) {
        globalThis.self = workerScope;
        ready = import("../../src/solver/solverWorker.js");
      }
    }
    postMessage(data) {
      const clone = structuredClone(data);
      ready.then(() => workerScope.onmessage({ data: clone }));
    }
    terminate() {}
  };
}
