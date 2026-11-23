// The catalogue of human reasonings (techniques) the "human solver" (engine.js) uses, by difficulty level.
// It is the single source of truth for the difficulty estimate, the clue generator, the hints and the glossary: moving
// a technique to another level is a one-line change here.
//
// The ORDER of the list matters: it is the order in which the solver tries them (always the easiest first, and after
// every deduction it starts again from the top), so the level of a case is "the hardest technique it cannot do without".
//
// No i18n and no DOM here (the solver runs in a worker): the names and explanations the person reads are in names.js.

export const LEVELS = ["easy", "medium", "hard", "expert"];

export const TECHNIQUES = [
  // ---- easy -------------------------------------------------------------------------------------------------------
  // a clue that speaks of the character alone rules cells out (and, when it puts them in a row, a column or alone in a room, rules those cells out for the others)
  { id: "clueFilter", level: "easy" },
  // somebody already placed takes their row and column away from the others
  { id: "rowColTaken", level: "easy" },
  // a character with a single cell left goes there
  { id: "onlyCandidate", level: "easy" },
  // ---- medium -----------------------------------------------------------------------------------------------------
  // a clue that names somebody already placed ("next to X", X known) rules cells out
  { id: "relationalKnown", level: "medium" },
  // a clue about the scene that no cell of a character can satisfy ("the only one next to a rack") rules that cell out
  { id: "sceneUnary", level: "medium" },
  // the victim needs somebody else in the room: rooms where nobody else can reach are ruled out
  { id: "roomCapacity", level: "medium" },
  // the victim shares a room with exactly one person: no third person in that room
  { id: "victimRule", level: "medium" },
  // clues that count people in a room, a row, a column or around a spot ("nobody in", "exactly one in")
  { id: "roomCount", level: "medium" },
  // «exactly N people in this group of cells» (a room; next to a table): the ways to put them rule cells out, and some cells are certainly occupied
  { id: "regionCount", level: "medium" },
  // «somebody ... exists» (a woman on a pallet, a man who is seated): only those who can be that person can; one cell only: somebody is there
  { id: "witness", level: "medium" },
  // somebody certainly stands in this cell (whoever they are): nobody else can be anywhere else in its row or column
  { id: "occupiedCell", level: "medium" },
  // when every row (column) holds somebody, the only character that can still reach a row (column) goes there
  { id: "lastInLine", level: "medium" },
  // a character whose cells are all in one row (column) is in it: nobody else may take that row (column)
  { id: "lineConfined", level: "medium" },
  // K characters whose cells together are exactly K: nobody else may take those cells
  { id: "subsets", level: "medium" },
  // a clue ties a character to ONE other who is still open: cells with no partner cell that satisfies it are ruled out
  { id: "pairSupport", level: "medium" },
  // ---- hard -------------------------------------------------------------------------------------------------------
  // K characters whose cells are in only K rows (columns) share those rows (columns): nobody else may take them
  { id: "lineGroups", level: "hard" },
  // a clue ties a character to TWO others who are still open: cells with no partners' cells that satisfy it are ruled out
  { id: "mutualSupport", level: "hard" },
  // "A or B" clues: what is impossible under both alternatives is ruled out
  { id: "alternatives", level: "hard" },
  // clues about the whole scene (empty rooms of the same size, nobody with a property...)
  { id: "globalCount", level: "hard" },
  // clues that can only be judged with the board complete ("alone with", "the only one next to"): arrangements that break them
  { id: "finishedBoard", level: "hard" },
  // ---- expert -----------------------------------------------------------------------------------------------------
  // try a cell, follow the consequences with the reasonings above, and rule it out if they lead to a contradiction
  { id: "hypothesis", level: "expert" },
  // the same, with a hypothesis inside the hypothesis
  { id: "nestedHypothesis", level: "expert" },
  // nothing above is enough: the answer is found by trying out the possibilities
  { id: "exhaustive", level: "expert" },
];

const BY_ID = new Map(TECHNIQUES.map((t, i) => [t.id, { ...t, index: i }]));

export const techniqueById = (id) => BY_ID.get(id) ?? null;
export const levelIndex = (level) => LEVELS.indexOf(level);
export const levelOfTechnique = (id) => BY_ID.get(id)?.level ?? null;
// The techniques a case of this level may use: its own and all the easier ones.
export const techniquesUpTo = (level) => TECHNIQUES.filter((t) => levelIndex(t.level) <= levelIndex(level));
// The harder of two levels.
export const maxLevel = (a, b) => (levelIndex(a) >= levelIndex(b) ? a : b);
