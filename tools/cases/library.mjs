// Specs of the bundled case library. Each spec fixes the map, the cast and the
// TRUE solution; tools/make-library.mjs proposes the clues. In texts, {murderer}
// = the only other person in the victim's room.
//
// HOUSE RULES for generated cases (do not break them):
//   1. NO clue ever concerns the victim, neither as subject nor as target.
//   2. The victim is placed LAST, in the one cell that remains once the suspects
//      are placed; that is how the murderer is discovered. The generator solves the
//      suspects without her and refuses a spec in which she has more than one cell.
//   3. The clue "is closer to X than to Y" (closerTo) is never used.
//   4. Texts never say where the victim is found: no {victimRoom} in a briefing.
//   5. Names: the suspects come in ALPHABETICAL order (in the cast order, in each
//      language) and the victim's name always starts with V. The builder checks it.
//
// Fields worth knowing:
//   tense    verb tense of every clue of the case ("present" | "past" | "future")
//   require  clue types that must appear (so each case shows off something new)
//   objects  { type, row, col } — doors and windows also take a `side` (N/E/S/W),
//            they sit on the edge of the cell and never block it
export const person = (key, it, en, icon, gender, bioIt, bioEn, extra = {}) => ({ key, names: { it, en }, icon, gender, bio: { it: bioIt, en: bioEn }, ...extra });
export const victim = (it, en, gender, bioIt, bioEn) => person("v", it, en, "victim", gender, bioIt, bioEn, { victim: true });

// The library is empty: add specs here (id, order, difficulty, seed, mode, map, zones, objects, cast, solution, text).
// The former specs are in git history (see the commit that emptied the library).
export const LIBRARY = [];
