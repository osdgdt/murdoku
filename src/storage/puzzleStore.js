const INDEX_KEY = "murdoku:index";
const puzzleKey = (id) => `murdoku:puzzle:${id}`;
// Player progress (placements, X marks, candidates) — separate from the
// puzzle itself, so leaving and reopening player.html restores exactly
// where you left off instead of starting the board over from scratch.
const progressKey = (id) => `murdoku:progress:${id}`;

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function list() {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function get(id) {
  const raw = localStorage.getItem(puzzleKey(id));
  return raw ? JSON.parse(raw) : null;
}

export function save(puzzle) {
  localStorage.setItem(puzzleKey(puzzle.id), JSON.stringify(puzzle));
  const index = readIndex().filter((entry) => entry.id !== puzzle.id);
  index.push({
    id: puzzle.id,
    title: puzzle.title,
    updatedAt: puzzle.updatedAt,
    difficulty: puzzle.difficulty || "",
    completed: !!puzzle.completed,
    bestTimeSeconds: typeof puzzle.bestTimeSeconds === "number" ? puzzle.bestTimeSeconds : null,
  });
  writeIndex(index);
}

export function remove(id) {
  localStorage.removeItem(puzzleKey(id));
  localStorage.removeItem(progressKey(id));
  writeIndex(readIndex().filter((entry) => entry.id !== id));
}

export function getProgress(id) {
  try {
    const raw = localStorage.getItem(progressKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProgress(id, progress) {
  localStorage.setItem(progressKey(id), JSON.stringify(progress));
}
