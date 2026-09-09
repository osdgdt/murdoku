import { validatePuzzleShape } from "../model/puzzle.js";

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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`impossibile scaricare il file (${res.status}).`);
  const puzzle = await res.json();
  const { valid, errors } = validatePuzzleShape(puzzle);
  if (!valid) throw new Error("file puzzle non valido: " + errors.join("; "));
  return puzzle;
}

export function importPuzzleFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const puzzle = JSON.parse(reader.result);
        const { valid, errors } = validatePuzzleShape(puzzle);
        if (!valid) {
          reject(new Error("File puzzle non valido:\n" + errors.join("\n")));
          return;
        }
        resolve(puzzle);
      } catch (err) {
        reject(new Error("Impossibile leggere il file JSON: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Errore di lettura del file."));
    reader.readAsText(file);
  });
}
