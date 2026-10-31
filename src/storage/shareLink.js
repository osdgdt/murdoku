// Share a whole case inside a link — no file hosting needed:
//   player.html#case=<payload>
// The payload is the puzzle JSON, deflate-compressed and base64url-encoded.
// It lives in the URL *fragment*, which browsers never send to any server.
// Decoding treats the link as untrusted: size-capped while inflating (no
// decompression bombs), then run through the same migration + shape
// validation as every other import.
import { migratePuzzle } from "../model/migrations.js";
import { validatePuzzleShape } from "../model/puzzle.js";
import { MAX_IMPORT_BYTES } from "../util/safe.js";
import { t } from "../i18n/i18n.js";

const PREFIX = "case=";

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipeThrough(bytes, transform, maxBytes = Infinity) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(t("file troppo grande."));
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

export function isShareLinkSupported() {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}

export async function encodePuzzleToFragment(puzzle) {
  const json = new TextEncoder().encode(JSON.stringify(puzzle));
  const packed = await pipeThrough(json, new CompressionStream("deflate-raw"));
  return PREFIX + toBase64Url(packed);
}

// Returns a validated, migrated puzzle, or null when the fragment carries no
// shared case at all. Throws a readable Error for a malformed/hostile one.
export async function decodePuzzleFromFragment(fragment) {
  const raw = (fragment || "").replace(/^#/, "");
  if (!raw.startsWith(PREFIX)) return null;
  let puzzle;
  try {
    const packed = fromBase64Url(raw.slice(PREFIX.length));
    const json = await pipeThrough(packed, new DecompressionStream("deflate-raw"), MAX_IMPORT_BYTES);
    puzzle = JSON.parse(new TextDecoder().decode(json));
  } catch (err) {
    if (err instanceof Error && err.message === t("file troppo grande.")) throw err;
    throw new Error(t("il link non è valido o è incompleto."));
  }
  migratePuzzle(puzzle);
  const { valid, errors } = validatePuzzleShape(puzzle);
  if (!valid) throw new Error(t("file puzzle non valido: ") + errors.join("; "));
  return puzzle;
}
