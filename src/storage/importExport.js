import { validatePuzzleShape } from "../model/puzzle.js";
import { migratePuzzle } from "../model/migrations.js";
import { MAX_IMPORT_BYTES } from "../util/safe.js";
import { t } from "../i18n/i18n.js";

function slugify(text) {
  return (text || "puzzle")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "puzzle";
}

export function exportPuzzle(puzzle) {
  const json = JSON.stringify(puzzle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(puzzle.title)}.murdoku.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Fetch + validate a .murdoku.json from anywhere on the web — the shared
// core of player.html's `?import=<url>`, campaign.html's per-case fetch, and
// campaign-editor.html's "add case by URL", which used to duplicate this
// exact 5-line block (including the Italian error strings) three times.
export async function importPuzzleFromUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url, location.href);
  } catch {
    throw new Error(t("indirizzo non valido."));
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") throw new Error(t("sono ammessi solo indirizzi http(s)."));
  const res = await fetch(parsedUrl.href, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(t("impossibile scaricare il file ({status}).", { status: res.status }));
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_IMPORT_BYTES) throw new Error(t("file troppo grande."));
  const text = await res.text();
  if (text.length > MAX_IMPORT_BYTES) throw new Error(t("file troppo grande."));
  let puzzle;
  try {
    puzzle = JSON.parse(text);
  } catch {
    throw new Error(t("il file non è un JSON valido."));
  }
  migratePuzzle(puzzle);
  const { valid, errors } = validatePuzzleShape(puzzle);
  if (!valid) throw new Error(t("file puzzle non valido: ") + errors.join("; "));
  return puzzle;
}

export function importPuzzleFromFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMPORT_BYTES) {
      reject(new Error(t("File troppo grande.")));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const puzzle = JSON.parse(reader.result);
        migratePuzzle(puzzle);
        const { valid, errors } = validatePuzzleShape(puzzle);
        if (!valid) {
          reject(new Error(t("File puzzle non valido:\n") + errors.join("\n")));
          return;
        }
        resolve(puzzle);
      } catch (err) {
        reject(new Error(t("Impossibile leggere il file JSON: ") + err.message));
      }
    };
    reader.onerror = () => reject(new Error(t("Errore di lettura del file.")));
    reader.readAsText(file);
  });
}
