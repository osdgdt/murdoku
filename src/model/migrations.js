// Puzzle documents are long-lived (saved in localStorage, exported as files,
// hosted by campaigns), so the format needs a real upgrade path instead of
// "every reader tolerates every historical shape". Each entry upgrades a
// document from version N to N+1 *in place* and must be idempotent and
// non-destructive; migratePuzzle() applies them in order.
//
// To change the format: append one function here. CURRENT_SCHEMA_VERSION
// follows automatically, and puzzles saved by a NEWER app version are
// refused by validatePuzzleShape instead of being silently mangled.

// The palettes live in puzzle.js, which imports this module for the schema
// version — so they are duplicated by value here to avoid an import cycle
// (test/test-palette.js fails if the two copies ever drift apart).
export const LEGACY_CHARACTER_COLORS = ["#8a1f2d", "#2b6b4a", "#1f4e79", "#b0813a", "#6b3f8a", "#1f7a7a", "#b3541e", "#4a4a63", "#a8456b", "#5c6b1f"];
export const MIGRATED_CHARACTER_COLORS = ["#608aea", "#ea558a", "#158060", "#9f5595", "#bf8020", "#4a6aca", "#9f80b5", "#6a9560", "#2b9f95", "#9f6a0b"];

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
  // 1 -> 2: character colors move to the color-blind-safe palette. Only the
  // old default swatches are remapped (index for index); a color the author
  // picked outside the palette is left alone.
  (p) => {
    for (const c of Array.isArray(p.characters) ? p.characters : []) {
      const index = typeof c.color === "string" ? LEGACY_CHARACTER_COLORS.indexOf(c.color.toLowerCase()) : -1;
      if (index !== -1) c.color = MIGRATED_CHARACTER_COLORS[index];
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
