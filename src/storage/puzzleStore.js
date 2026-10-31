import { readJson, writeJson, remove as removeKey } from "./storage.js";
import { migratePuzzle } from "../model/migrations.js";

const INDEX_KEY = "murdoku:index";
const puzzleKey = (id) => `murdoku:puzzle:${id}`;
// Player progress (placements, X marks, candidates) — separate from the
// puzzle itself, so leaving and reopening player.html restores exactly
// where you left off instead of starting the board over from scratch.
const progressKey = (id) => `murdoku:progress:${id}`;

function readIndex() {
  const index = readJson(INDEX_KEY, []);
  return Array.isArray(index) ? index : [];
}

function writeIndex(index) {
  writeJson(INDEX_KEY, index);
}

export function list() {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function get(id) {
  const puzzle = readJson(puzzleKey(id), null);
  return puzzle ? migratePuzzle(puzzle) : null;
}

export function save(puzzle) {
  const index = readIndex().filter((entry) => entry.id !== puzzle.id);
  index.push({
    id: puzzle.id,
    title: puzzle.title,
    updatedAt: puzzle.updatedAt,
    difficulty: puzzle.difficulty || "",
    completed: !!puzzle.completed,
    bestTimeSeconds: typeof puzzle.bestTimeSeconds === "number" ? puzzle.bestTimeSeconds : null,
  });
  // writeJson throws StorageFullError (quota / storage unavailable).
  writeJson(puzzleKey(puzzle.id), puzzle);
  writeIndex(index);
}

export function remove(id) {
  removeKey(puzzleKey(id));
  removeKey(progressKey(id));
  writeIndex(readIndex().filter((entry) => entry.id !== id));
}

export function getProgress(id) {
  return readJson(progressKey(id), null);
}

export function saveProgress(id, progress) {
  writeJson(progressKey(id), progress);
}
