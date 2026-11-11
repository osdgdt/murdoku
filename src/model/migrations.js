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
  // 2 -> 3: doors and windows live on a SIDE of a cell instead of filling it.
  // Each old one gets `side: "N"` and its cell is freed (a person can stand
  // there now). The ids of the two edge types are duplicated by value here
  // (see icons.js's `edge` flag) to keep this module import-free.
  (p) => {
    const grid = p.grid;
    if (!grid || !Array.isArray(grid.objects) || !Array.isArray(grid.cells)) return;
    for (const obj of grid.objects) {
      if (!obj || (obj.typeId !== "door" && obj.typeId !== "window") || obj.side) continue;
      obj.side = "N";
      const cell = grid.cells[obj.row] && grid.cells[obj.row][obj.col];
      if (cell && cell.objectId === obj.id) cell.objectId = null;
    }
  },
  // 3 -> 4: the obsolete clue types are gone, and a case now has a verb tense
  // for its clues. Each old clue is rewritten into the equivalent unified form
  // (same meaning, same solutions): "not…" types become the positive type with
  // `negate`, `direction` becomes `directionDistance` with no distance, and so
  // on. Type names are duplicated by value (this module stays import-free).
  (p) => {
    p.tense ??= "present";
    const victim = (Array.isArray(p.characters) ? p.characters : []).find((c) => c && c.isVictim);
    const flip = (spec, type) => { spec.type = type; spec.negate = !spec.negate; };

    // Upgrades one clue-shaped object ({type, params, negate}) in place.
    // Returns false when it has no equivalent and must be dropped.
    const upgrade = (spec) => {
      if (!spec || typeof spec !== "object") return true;
      const params = (spec.params && typeof spec.params === "object") ? spec.params : (spec.params = {});
      for (const key of ["a", "b", "customClue"]) {
        if (params[key] && typeof params[key] === "object") upgrade(params[key]);
      }
      switch (spec.type) {
        case "notAdjacent": flip(spec, "adjacent"); break;
        case "notInRoom": flip(spec, "inRoom"); break;
        case "notSameRoomAs": flip(spec, "sameRoomAs"); break;
        case "direction": spec.type = "directionDistance"; params.distance = null; break;
        case "onlyPersonInRoom": spec.type = "aloneInRoom"; break;
        case "emptyRoomsCount": spec.type = "roomsWithStateCount"; spec.params = { count: params.count, state: "empty" }; break;
        case "eitherAdjacent":
          spec.type = "orClue";
          spec.params = {
            a: { type: "adjacent", params: { targetId: params.targetAId } },
            b: { type: "adjacent", params: { targetId: params.targetBId } },
          };
          break;
        case "aloneWithVictim":
          if (!victim) return false;
          spec.type = "aloneWithPerson";
          spec.params = { targetId: victim.id };
          break;
        default: break;
      }
      return true;
    };

    if (Array.isArray(p.clues)) p.clues = p.clues.filter((clue) => upgrade(clue));
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
