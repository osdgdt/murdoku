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
