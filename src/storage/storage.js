import { t } from "../i18n/i18n.js";
// The single door to localStorage. Every store goes through here so that the
// three real-world failure modes are handled in exactly one place instead of
// per call site: storage unavailable (private mode, blocked cookies — merely
// *touching* `localStorage` can throw), corrupted/foreign JSON under one of
// our keys, and a full quota on write.

export class StorageFullError extends Error {
  constructor(message = t("Spazio di archiviazione locale esaurito: impossibile salvare le modifiche.")) {
    super(message);
    this.name = "StorageFullError";
  }
}

function backend() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key) {
  try {
    return backend()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// Parsed JSON, or `fallback` for a missing / unparseable value.
export function readJson(key, fallback = null) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Throws StorageFullError when the write cannot be completed (quota or
// storage unavailable) — callers that consider the write best-effort use
// tryWriteJson instead.
export function writeRaw(key, value) {
  const store = backend();
  if (!store) throw new StorageFullError(t("Archiviazione locale non disponibile in questo browser."));
  try {
    store.setItem(key, value);
  } catch {
    throw new StorageFullError();
  }
}

export function writeJson(key, value) {
  writeRaw(key, JSON.stringify(value));
}

export function tryWriteJson(key, value) {
  try {
    writeJson(key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    backend()?.removeItem(key);
  } catch {
    // nothing sensible to do if even removal fails
  }
}
