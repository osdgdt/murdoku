// serializeBoardState() (board.js) produces arrays-of-pairs (Map.entries()
// shape) for placements/candidates/autoXByCharacter — Firestore rejects
// nested arrays outright. Converted to arrays-of-objects here, on the way
// in/out, so board.js itself never needs to know Firestore exists.
// NOTE: this is a strict field allowlist, not a shallow passthrough — a new
// scalar field added to serializeBoardState()'s output (e.g. hintsUsed)
// still has to be listed here explicitly in both directions, or it's
// silently dropped before ever reaching Firestore.
//
// Pure, Firebase-free on purpose (unlike progressStore.js, which imports the
// Firebase SDK at module scope) — this is what lets these two functions be
// unit-tested (test/test-progress-codec.js) without making that the first
// Firebase-touching import anywhere in the test suite. Same pure/orchestration
// split this codebase already uses for achievementsStore.js (pure) vs.
// achievementsSyncStore.js (Firebase).
export function toFirestoreSafe(serialized) {
  return {
    placements: serialized.placements.map(([charId, pos]) => ({ charId, row: pos.row, col: pos.col })),
    xMarks: serialized.xMarks,
    candidates: serialized.candidates.map(([key, ids]) => ({ key, ids })),
    autoXByCharacter: serialized.autoXByCharacter.map(([charId, cells]) => ({ charId, cells })),
    hintsUsed: serialized.hintsUsed,
  };
}

// Inverse of toFirestoreSafe — output matches exactly what
// deserializeBoardState() (board.js, unmodified) already expects.
export function fromFirestoreSafe(saved) {
  if (!saved) return undefined;
  return {
    placements: (saved.placements || []).map((p) => [p.charId, { row: p.row, col: p.col }]),
    xMarks: saved.xMarks || [],
    candidates: (saved.candidates || []).map((c) => [c.key, c.ids]),
    autoXByCharacter: (saved.autoXByCharacter || []).map((a) => [a.charId, a.cells]),
    hintsUsed: typeof saved.hintsUsed === "number" ? saved.hintsUsed : 0,
  };
}
