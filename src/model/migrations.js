// Puzzle documents are long-lived (saved in localStorage, exported as files,
// hosted by campaigns), so the format needs a real upgrade path instead of
// "every reader tolerates every historical shape". Each entry upgrades a
// document from version N to N+1 *in place* and must be idempotent and
// non-destructive; migratePuzzle() applies them in order.
//
// To change the format: append one function here. CURRENT_SCHEMA_VERSION
// follows automatically, and puzzles saved by a NEWER app version are
// refused by validatePuzzleShape instead of being silently mangled.

const MIGRATIONS = [
  // 0 -> 1: documents written before `schemaVersion` existed. Fill in the
  // optional fields that later code assumes are present.
  (p) => {
    p.author ??= "";
    p.difficulty ??= "";
    p.completed ??= false;
    p.bestTimeSeconds ??= null;
    p.briefing ??= "";
    p.resolutionNote ??= "";
    p.manualHints ??= [];
    for (const c of Array.isArray(p.characters) ? p.characters : []) {
      c.bio ??= "";
      c.gender ??= null;
    }
    for (const z of Array.isArray(p.grid?.zones) ? p.grid.zones : []) {
      z.textureId ??= "hatch";
    }
  },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersionOf(puzzle) {
  const v = puzzle?.schemaVersion;
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

// Returns the same object, upgraded to CURRENT_SCHEMA_VERSION. Non-objects and
// documents from a future version are returned untouched (validation reports
// the latter).
export function migratePuzzle(puzzle) {
  if (!puzzle || typeof puzzle !== "object") return puzzle;
  let version = schemaVersionOf(puzzle);
  if (version > CURRENT_SCHEMA_VERSION) return puzzle;
  while (version < CURRENT_SCHEMA_VERSION) {
    MIGRATIONS[version](puzzle);
    version++;
    puzzle.schemaVersion = version;
  }
  return puzzle;
}
