// Registry of local, per-device player achievements — deliberately NOT
// social (see src/storage/achievementsStore.js): nothing here is compared
// against other players or synced anywhere. Follows the same flat,
// declarative-array convention as DIFFICULTY_LEVELS (puzzle.js): a plain
// exported array of small objects plus a lookup helper, instead of a class
// hierarchy.
//
// Each `check(stats)` is a pure predicate over the CUMULATIVE stats object
// achievementsStore.js maintains (getStats()), not over a single solve's
// details. That keeps every achievement monotonic: once true for a given
// stats snapshot, a later, only-growing stats snapshot can never make it
// false again — "unlocked" is a one-way door.
export const ACHIEVEMENTS = [
  {
    id: "first_solve",
    title: "Primo caso archiviato",
    description: "Hai risolto il tuo primo caso.",
    check: (stats) => stats.totalSolved >= 1,
  },
  {
    id: "ten_solves",
    title: "Investigatore navigato",
    description: "Hai risolto 10 casi.",
    check: (stats) => stats.totalSolved >= 10,
  },
  {
    id: "fifty_solves",
    title: "Detective leggendario",
    description: "Hai risolto 50 casi.",
    check: (stats) => stats.totalSolved >= 50,
  },
  {
    id: "no_hints",
    title: "Intuito infallibile",
    description: "Hai risolto un caso senza usare nessun suggerimento.",
    check: (stats) => stats.totalSolvedWithoutHints >= 1,
  },
  {
    id: "under_2_minutes",
    title: "Lampo di genio",
    description: "Hai risolto un caso in meno di 2 minuti.",
    check: (stats) => stats.fastestSolveSeconds != null && stats.fastestSolveSeconds < 120,
  },
];

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}
