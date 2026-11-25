// The "human solver": solves a case the way a person would, one named reasoning at a time (the catalogue is in
// catalog.js), always with the easiest reasoning that still gets somewhere, and says which ones it needed.
//
//   humanSolve(puzzle, options) -> {
//     status:  "solved"        every character was placed by reasonings (the case has one solution)
//              "stuck"         the reasonings allowed by `maxLevel` are not enough
//              "contradiction" the clues cannot all hold
//              "ambiguous"     only with the exhaustive search allowed: two or more solutions
//              "limit"         the work/time budget ended before the answer was known
//     level:   the level of the hardest reasoning used ("easy" | "medium" | "hard" | "expert" | null)
//     hardest: id of that reasoning (catalog.js), null if none was needed
//     steps:   [{ technique, level, characterId, placed?: {row,col}, eliminated?: [{row,col}], clueIds, byCharacterIds? }]
//     counts:  { technique id -> how many steps }
//     placements: Map<characterId, {row,col}> (the solution when solved)
//     work: number of clue evaluations made
//   }
//
// It is a layer ON TOP of the exact search (solver.js), which stays the judge of uniqueness: here nothing is ever ruled
// out unless it is impossible (every reasoning is sound), so when the human solver says "solved" the case has that one
// solution (test-human-solver.js checks it against the exact search).
//
// How each reasoning is told from the others: a clue is treated differently depending on whom it talks about and on what
// is already placed, at the moment it is used. "The cook is in the kitchen" is a plain filter; "the cook is next to the
// maid" is a filter once the maid is placed (relationalKnown) but needs the two open characters to be looked at together
// before that (mutualSupport). Types that count people (roomCount), that look at the whole scene (globalCount), or that
// can only be judged when the board is complete (finishedBoard) have their own reasonings.
import { buildPredicates } from "../predicates/index.js";
import { dependenciesOf } from "../predicates/dependencies.js";
import { isNextTo, resolveTargetPositions, victimId, zoneAt } from "../predicates/helpers.js";
import { buildPredicate } from "../predicates/index.js";
import { applyNakedSubsets, createOpsBudget, PROPAGATION_MAX_SUBSET_OPS } from "../propagation.js";
import { lineKeyFns, makeLineTracker, sharedAxes, hasFloors } from "../../model/sectors.js";
import { solvePuzzle } from "../solver.js";
import { isOccupiable } from "../../model/grid.js";
import { TECHNIQUES, LEVELS, levelIndex, levelOfTechnique, techniquesUpTo } from "./catalog.js";

const ROOM_COUNT_TYPES = new Set(["noOneInRoom", "noOneInRowOrCol", "exactlyOneInRoom", "noOneNear", "exactlyOneNear", "peopleNear"]);
const GLOBAL_COUNT_TYPES = new Set(["roomsWithStateCount", "emptyRoomsSameSize", "noOneWithProperty"]);

// Combinations of cells of the OTHER open characters tried when a clue ties several characters together.
const SUPPORT_MAX_COMBINATIONS = 2500;
// The finishedBoard reasoning counts the ways of placing the last few characters: at most this many characters left, and
// at most this many ways to look at.
const FINISHED_MAX_OPEN = 5;
const FINISHED_MAX_COMBINATIONS = 30000;

class LimitReached extends Error {}
// The nested hypotheses are given a budget of their own: past it they are given up (the case is then settled by the
// exhaustive search, which is also "expert"), rather than eating the whole budget of the estimate.
class SoftLimit extends Error {}
const NESTED_HYPOTHESIS_WORK = 1500000;

// ---- context: what does not change while solving ---------------------------------------------------------------------
function buildContext(puzzle, { maxWork, deadline, shouldStop }) {
  const predicates = buildPredicates(puzzle);
  const infos = predicates.map(({ clue, predicate }) => {
    const dep = clue.id === null ? { all: true } : dependenciesOf(clue, puzzle);
    let group;
    if (clue.id === null) group = "victim";
    else if (ROOM_COUNT_TYPES.has(clue.type)) group = "roomCount";
    else if (GLOBAL_COUNT_TYPES.has(clue.type)) group = "globalCount";
    else if (dep.all) group = "finished";
    else group = "dep";
    return { clue, predicate, dep, group, isOr: clue.type === "orClue" };
  });
  const cells = [];
  const { rows, cols } = puzzle.grid.size;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isOccupiable(puzzle.grid, r, c)) cells.push({ row: r, col: c });
  const ctx = {
    puzzle,
    ...lineKeyFns(puzzle.grid), // rowKey, colKey: the line a cell belongs to (a plain number, or (map, number) in a train or a skyscraper)
    // the lines the whole-line reasonings may use: a row is a line of the map only when the map is one grid (a wagon has its own R1…)
    lineAxes: sharedAxes(puzzle.grid),
    infos,
    cells,
    rows,
    cols,
    victim: victimId(puzzle),
    work: 0,
    soft: null,
    nestedOff: false,
    maxWork,
    deadline,
    shouldStop,
    tick(n = 1) {
      ctx.work += n;
      if (ctx.work > ctx.maxWork) throw new LimitReached("work");
      if (ctx.soft !== null && ctx.work > ctx.soft) throw new SoftLimit();
      if ((ctx.work & 255) < n) {
        if (ctx.deadline !== null && now() > ctx.deadline) throw new LimitReached("time");
        if (ctx.shouldStop && ctx.shouldStop()) throw new LimitReached("stop");
      }
    },
  };
  return ctx;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// ---- state: what changes while solving ------------------------------------------------------------------------------
function initialState(ctx) {
  const domains = new Map();
  for (const character of ctx.puzzle.characters) domains.set(character.id, ctx.cells.slice());
  // `occupied`: cells where somebody certainly stands though nobody knows who ("row:col" key -> { row, col, clueIds })
  return { confirmed: new Map(), domains, occupied: new Map(), dead: false, version: 0, tried: new Map(), cv: new Map(), seen: new Map() };
}

function cloneState(state) {
  const domains = new Map();
  for (const [id, cells] of state.domains) domains.set(id, cells.slice());
  return {
    confirmed: new Map(state.confirmed),
    domains,
    occupied: new Map(state.occupied),
    dead: state.dead,
    version: state.version,
    tried: new Map(state.tried),
    cv: new Map(state.cv),
    seen: new Map(state.seen),
  };
}

// What each reasoning reads, so that it is not repeated when nothing it looks at has changed:
//   once       the clues alone (a filter never changes)
//   placed     which characters are placed (and where)
//   domains    the cells each open character can still take
const READS = {
  clueFilter: "once",
  rowColTaken: "placed",
  onlyCandidate: "domains",
  relationalKnown: "placed",
  sceneUnary: "placed",
  roomCapacity: "domains",
  victimRule: "placed",
  roomCount: "placed",
  regionCount: "domains",
  witness: "domains",
  occupiedCell: "domains",
  lastInLine: "domains",
  lineConfined: "domains",
  subsets: "domains",
  pairSupport: "domains",
  lineGroups: "domains",
  hiddenGroups: "domains",
  mutualSupport: "domains",
  alternatives: "domains",
  globalCount: "placed",
  finishedBoard: "domains",
  hypothesis: "domains",
  nestedHypothesis: "domains",
};
function stampOf(state, id) {
  const reads = READS[id];
  if (reads === "once") return 0;
  if (reads === "placed") return state.confirmed.size;
  return state.version;
}
// Runs one reasoning unless it already ran on exactly what it reads and found nothing.
function runTechnique(ctx, state, rec, id) {
  const stamp = stampOf(state, id);
  if (state.tried.get(id) === stamp) return 0;
  const n = RUNNERS[id](ctx, state, rec);
  if (n === 0) state.tried.set(id, stampOf(state, id));
  return n;
}

const unplacedCharacters = (ctx, state) => ctx.puzzle.characters.filter((c) => !state.confirmed.has(c.id));

// Does everything placed so far respect every clue? (a clue only says "false" when it can never hold)
function consistent(ctx, state) {
  const complete = state.confirmed.size === ctx.puzzle.characters.length;
  for (const info of ctx.infos) {
    ctx.tick();
    if (info.predicate(state.confirmed, complete) === false) return false;
  }
  return true;
}

function place(ctx, state, characterId, cell) {
  state.confirmed.set(characterId, cell);
  state.domains.delete(characterId);
  state.version++;
  if (!consistent(ctx, state)) state.dead = true;
}

// Takes cells out of a character's domain; returns how many were really there.
function removeCells(state, characterId, cells) {
  if (cells.length === 0) return 0;
  const gone = new Set(cells.map((c) => c.row * 64 + c.col));
  const before = state.domains.get(characterId);
  const after = before.filter((c) => !gone.has(c.row * 64 + c.col));
  state.domains.set(characterId, after);
  if (after.length !== before.length) {
    state.version++;
    state.cv.set(characterId, (state.cv.get(characterId) ?? 0) + 1);
  }
  if (after.length === 0) state.dead = true;
  return before.length - after.length;
}

function record(ctx, rec, technique, data) {
  if (!rec) return;
  rec.steps.push({ technique, level: levelOfTechnique(technique), ...data });
}

// For one open character and one clue: the OTHER open characters the clue also depends on.
const openReferences = (state, info, characterId) => [...info.dep.ids].filter((id) => id !== characterId && !state.confirmed.has(id));

// ---- reasonings that read each cell against clues, with the others as placed --------------------------------------------
function eliminateByEvaluation(ctx, state, rec, technique, select) {
  const unplaced = unplacedCharacters(ctx, state);
  const isLast = unplaced.length === 1;
  let total = 0;
  for (const character of unplaced) {
    if (state.dead) break;
    const infos = select(character, unplaced);
    if (infos.length === 0) continue;
    const tentative = new Map(state.confirmed);
    const removed = [];
    const clueIds = new Set();
    for (const cell of state.domains.get(character.id)) {
      tentative.set(character.id, cell);
      for (const info of infos) {
        ctx.tick();
        if (info.predicate(tentative, isLast) === false) {
          removed.push(cell);
          clueIds.add(info.clue.id);
          break;
        }
      }
    }
    if (removed.length === 0) continue;
    total += removeCells(state, character.id, removed);
    record(ctx, rec, technique, { characterId: character.id, eliminated: removed, clueIds: [...clueIds] });
  }
  return total;
}

// ... or, for clues that tie the character to other characters who are still open, against the cells THEY can still take.
function eliminateBySupport(ctx, state, rec, technique, select) {
  const unplaced = unplacedCharacters(ctx, state);
  let total = 0;
  for (const character of unplaced) {
    if (state.dead) break;
    const picks = select(character);
    if (picks.length === 0) continue;
    const removed = [];
    const clueIds = new Set();
    const others = new Set();
    // a clue is looked at again only when somebody it depends on has lost cells since the last time
    const live = picks.filter(({ info, refs }) => {
      const signature = refs.map((id) => `${id}:${state.cv.get(id) ?? 0}`).join(",");
      const key = `${technique}|${character.id}|${info.clue.id}|${signature}`;
      if (state.seen.has(key)) return false;
      state.seen.set(key, true);
      return true;
    });
    if (live.length === 0) continue;
    for (const cell of state.domains.get(character.id)) {
      for (const { info, refs } of live) {
        if (!hasSupport(ctx, state, character, cell, info, refs, unplaced.length)) {
          removed.push(cell);
          clueIds.add(info.clue.id);
          for (const id of refs) others.add(id);
          break;
        }
      }
    }
    if (removed.length === 0) continue;
    total += removeCells(state, character.id, removed);
    record(ctx, rec, technique, { characterId: character.id, eliminated: removed, clueIds: [...clueIds], byCharacterIds: [...others] });
  }
  return total;
}

// Is there a way to place the open characters `refs` (in cells they can still take) so that `info`'s clue is not broken
// with `character` at `cell`? Too many combinations to try: assume there is (never rules out a cell it should not).
function hasSupport(ctx, state, character, cell, info, refs, openCount) {
  const lists = refs.map((id) => state.domains.get(id));
  let combos = 1;
  for (const list of lists) combos *= list.length;
  if (combos > SUPPORT_MAX_COMBINATIONS) return true;
  const tentative = new Map(state.confirmed);
  tentative.set(character.id, cell);
  const isComplete = openCount === 1 + refs.length;
  const taken = makeLineTracker(ctx);
  taken.add(cell.row, cell.col);
  const walk = (i) => {
    if (i === refs.length) {
      ctx.tick();
      return info.predicate(tentative, isComplete) !== false;
    }
    for (const c of lists[i]) {
      if (taken.has(c.row, c.col)) continue;
      tentative.set(refs[i], c);
      taken.add(c.row, c.col);
      const ok = walk(i + 1);
      taken.delete(c.row, c.col);
      tentative.delete(refs[i]);
      if (ok) return true;
    }
    return false;
  };
  return walk(0);
}

// ---- the reasonings -----------------------------------------------------------------------------------------------------
const depInfos = (ctx) => (ctx.depList ??= ctx.infos.filter((i) => i.group === "dep"));

const popcount = (x) => {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
};

// every way to pick k of n things, as arrays of indexes
function* combinations(n, k, start = 0, chosen = []) {
  if (chosen.length === k) {
    yield chosen.slice();
    return;
  }
  for (let i = start; i <= n - (k - chosen.length); i++) {
    chosen.push(i);
    yield* combinations(n, k, i + 1, chosen);
    chosen.pop();
  }
}

// `members` own the given rows (or columns): every other open character loses its cells there. One step per character.
// What a clue that speaks of ONE character also says about everybody else, read straight off the clue:
//   «X was the only person in the room R»  X is in R and nobody else may be anywhere in R
//   «X was in row/column N»                X takes the whole line: nobody else may be anywhere in it
// Reads nothing but the clues: what is taken out of the others stays out.
function readOwnClues(ctx, state, rec) {
  let total = 0;
  for (const { clue } of ctx.infos) {
    if (clue.negate || !clue.characterId) continue;
    let outside;
    if (clue.type === "aloneInRoom" && clue.params?.zoneId) {
      outside = (cell) => zoneAt(ctx.puzzle, cell) === clue.params.zoneId;
    } else if (clue.type === "inRowOrCol" && Number.isInteger(clue.params?.index)) {
      const axis = clue.params.axis === "row" ? "row" : "col";
      // only a line of the shared numbering is taken whole: «column 1» of a skyscraper is one in each floor, so it says nothing
      // about the others' cells in the other floors (nor does «row 1»: every floor numbers its own, nor «row 1» in a train)
      if (!ctx.lineAxes.includes(axis) || (axis === "row" && hasFloors(ctx.puzzle.grid))) continue;
      outside = (cell) => cell[axis] === clue.params.index - 1;
    } else continue;
    for (const other of unplacedCharacters(ctx, state)) {
      if (other.id === clue.characterId) continue;
      const removed = state.domains.get(other.id).filter(outside);
      if (removed.length === 0) continue;
      total += removeCells(state, other.id, removed);
      record(ctx, rec, "clueFilter", {
        characterId: other.id,
        eliminated: removed,
        clueIds: [clue.id],
        byCharacterIds: [clue.characterId],
      });
    }
  }
  return total;
}

function takeLinesFromOthers(ctx, state, rec, technique, members, axis, indexes) {
  const memberIds = new Set(members.map((m) => m.id));
  const lines = new Set(indexes);
  let total = 0;
  for (const other of unplacedCharacters(ctx, state)) {
    if (memberIds.has(other.id)) continue;
    const removed = state.domains.get(other.id).filter((cell) => lines.has(cell[axis]));
    if (removed.length === 0) continue;
    total += removeCells(state, other.id, removed);
    record(ctx, rec, technique, {
      characterId: other.id,
      eliminated: removed,
      clueIds: [],
      byCharacterIds: [...memberIds],
      line: { axis, indexes },
    });
  }
  return total;
}

// ---- «somebody is here», existential clues and counts over a group of cells --------------------------------------------
const cellKey = (cell) => cell.row * 64 + cell.col;
const hasCell = (cells, cell) => cells.some((c) => c.row === cell.row && c.col === cell.col);

// Somebody certainly stands in `cell` (who, nobody knows yet). Returns 1 when that is news.
function addFact(state, cell, clueIds) {
  const key = cellKey(cell);
  if (state.occupied.has(key)) return 0;
  for (const pos of state.confirmed.values()) if (pos.row === cell.row && pos.col === cell.col) return 0; // somebody placed is there already
  state.occupied.set(key, { row: cell.row, col: cell.col, clueIds: [...clueIds] });
  state.version++;
  return 1;
}

// Clues that say «somebody ... exists» (the negation of «nobody ...»): the witness can be any open character that has the
// property in some cell it can still take.
const EXISTENTIAL_TYPES = new Set(["noOneInRoom", "noOneInRowOrCol", "noOneNear", "noOneWithProperty"]);
function existentialsOf(ctx) {
  return (ctx.existentials ??= ctx.puzzle.clues
    .filter((clue) => clue.negate && !clue.characterId && EXISTENTIAL_TYPES.has(clue.type))
    .map((clue) => ({ clue, base: buildPredicate({ ...clue, negate: false }, ctx.puzzle) })));
}

// Clues that say «exactly N people are in this group of cells» (a room; next to a target): the group is fixed by the map.
function countsOf(ctx) {
  if (ctx.counts) return ctx.counts;
  const { puzzle, cells } = ctx;
  const counts = [];
  const near = (targetId) => {
    const targets = resolveTargetPositions(new Map(), puzzle, targetId);
    return targets && targets.length > 0 ? cells.filter((cell) => targets.some((t) => isNextTo(puzzle, cell, t))) : null;
  };
  for (const clue of puzzle.clues) {
    if (clue.negate || clue.characterId) continue;
    const params = clue.params ?? {};
    let k = null;
    let region = null;
    if (clue.type === "exactlyOneInRoom") [k, region] = [1, cells.filter((cell) => zoneAt(puzzle, cell) === params.zoneId)];
    else if (clue.type === "exactlyOneNear") [k, region] = [1, near(params.targetId)];
    else if (clue.type === "peopleNear" && Number.isInteger(params.count) && (params.together !== "same" || params.count === 1)) {
      [k, region] = [params.count, near(params.targetId)];
    }
    if (k !== null && region && region.length > 0) counts.push({ clue, k, region });
  }
  return (ctx.counts = counts);
}

// A way to give each of the cells to a different open character that can take it (Kuhn's matching).
function canFill(state, cellsToFill, open) {
  const owner = new Map(); // character id -> index of the cell it took
  const tryCell = (i, seen) => {
    for (const c of open) {
      if (seen.has(c.id) || !hasCell(state.domains.get(c.id), cellsToFill[i])) continue;
      seen.add(c.id);
      if (!owner.has(c.id) || tryCell(owner.get(c.id), seen)) {
        owner.set(c.id, i);
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < cellsToFill.length; i++) if (!tryCell(i, new Set())) return false;
  return true;
}

const COUNT_MAX_COMBINATIONS = 4000;

const RUNNERS = {
  clueFilter(ctx, state, rec) {
    // «alone in the room R» is first of all «in R» (the rest of the clue, nobody else there, is read below)
    const inRoom = (character) =>
      ctx.infos.filter(
        (i) => i.clue.characterId === character.id && i.clue.type === "aloneInRoom" && !i.clue.negate && i.clue.params?.zoneId
      );
    return (
      eliminateByEvaluation(ctx, state, rec, "clueFilter", (character) => [
        ...depInfos(ctx).filter((i) => !i.isOr && i.dep.ids.has(character.id) && i.dep.ids.size === 1),
        ...inRoom(character),
      ]) + readOwnClues(ctx, state, rec)
    );
  },

  rowColTaken(ctx, state, rec) {
    if (state.confirmed.size === 0) return 0;
    const taken = makeLineTracker(ctx);
    for (const { row, col } of state.confirmed.values()) taken.add(row, col);
    let total = 0;
    for (const character of unplacedCharacters(ctx, state)) {
      if (state.dead) break;
      const removed = state.domains.get(character.id).filter((c) => taken.has(c.row, c.col));
      if (removed.length === 0) continue;
      total += removeCells(state, character.id, removed);
      record(ctx, rec, "rowColTaken", { characterId: character.id, eliminated: removed, clueIds: [] });
    }
    return total;
  },

  onlyCandidate(ctx, state, rec) {
    let total = 0;
    for (const character of unplacedCharacters(ctx, state)) {
      if (state.dead) break;
      const domain = state.domains.get(character.id);
      if (domain.length !== 1) continue;
      const cell = domain[0];
      place(ctx, state, character.id, cell);
      record(ctx, rec, "onlyCandidate", { characterId: character.id, placed: cell, clueIds: [] });
      total++;
      // the others lose that row and column before anything else looks at them
      RUNNERS.rowColTaken(ctx, state, rec);
    }
    return total;
  },

  relationalKnown(ctx, state, rec) {
    return eliminateByEvaluation(ctx, state, rec, "relationalKnown", (character) =>
      depInfos(ctx).filter(
        (i) => !i.isOr && i.dep.ids.has(character.id) && i.dep.ids.size > 1 && openReferences(state, i, character.id).length === 0
      )
    );
  },

  // The clues about the scene that can only be judged on a complete board ("the only person next to a rack", "the furthest east
  // among those next to a table") still say «false» about a cell that breaks them whatever the others do: a character's cells
  // are filtered by them as by any other clue.
  sceneUnary(ctx, state, rec) {
    const infos = ctx.infos.filter((i) => i.group === "finished");
    return eliminateByEvaluation(ctx, state, rec, "sceneUnary", () => infos);
  },

  // The victim must share a room with exactly one other person. A cell for the victim is out when nobody else can still
  // be in that room next to them (no person already there, and no other open character with a free cell there).
  roomCapacity(ctx, state, rec) {
    const { victim } = ctx;
    if (!victim || state.confirmed.has(victim)) return 0;
    const others = unplacedCharacters(ctx, state).filter((c) => c.id !== victim);
    const removed = [];
    for (const cell of state.domains.get(victim)) {
      const zone = zoneAt(ctx.puzzle, cell);
      if (zone === null) {
        removed.push(cell); // the victim must be inside a room
        continue;
      }
      let companions = 0;
      for (const [id, pos] of state.confirmed) if (id !== victim && zoneAt(ctx.puzzle, pos) === zone) companions++;
      if (companions >= 1) continue;
      const reachable = others.some((o) =>
        state.domains
          .get(o.id)
          .some(
            (c) =>
              ctx.rowKey(c.row, c.col) !== ctx.rowKey(cell.row, cell.col) &&
              ctx.colKey(c.row, c.col) !== ctx.colKey(cell.row, cell.col) &&
              (!ctx.pillarKey || ctx.pillarKey(c.row, c.col) !== ctx.pillarKey(cell.row, cell.col)) &&
              zoneAt(ctx.puzzle, c) === zone
          )
      );
      if (!reachable) removed.push(cell);
    }
    if (removed.length === 0) return 0;
    const total = removeCells(state, victim, removed);
    record(ctx, rec, "roomCapacity", { characterId: victim, eliminated: removed, clueIds: [] });
    return total;
  },

  victimRule(ctx, state, rec) {
    const infos = ctx.infos.filter((i) => i.group === "victim");
    return eliminateByEvaluation(ctx, state, rec, "victimRule", () => infos);
  },

  roomCount(ctx, state, rec) {
    const infos = ctx.infos.filter((i) => i.group === "roomCount");
    return eliminateByEvaluation(ctx, state, rec, "roomCount", () => infos);
  },

  // «Exactly N people are in this group of cells»: of the cells of the group somebody can still take, which ways are there to
  // put N people (one per row and column, each in a cell of their own)? A cell in none of them stays empty; a cell in all of
  // them is certainly occupied.
  regionCount(ctx, state, rec) {
    let total = 0;
    for (const { clue, k, region } of countsOf(ctx)) {
      if (state.dead) break;
      const open = unplacedCharacters(ctx, state);
      let inside = 0;
      for (const pos of state.confirmed.values()) if (region.some((c) => c.row === pos.row && c.col === pos.col)) inside++;
      const need = k - inside;
      if (need < 0) {
        state.dead = true;
        break;
      }
      const available = region.filter((cell) => open.some((c) => hasCell(state.domains.get(c.id), cell)));
      let combos = 1;
      for (let i = 0; i < need; i++) combos = (combos * (available.length - i)) / (i + 1);
      if (need > available.length) {
        state.dead = true;
        break;
      }
      if (combos > COUNT_MAX_COMBINATIONS) continue;
      let feasible = 0;
      const inAll = new Map(available.map((cell) => [cellKey(cell), cell]));
      const inAny = new Set();
      for (const pick of combinations(available.length, need)) {
        const cells = pick.map((i) => available[i]);
        if (
          new Set(cells.map((c) => ctx.rowKey(c.row, c.col))).size < cells.length ||
          new Set(cells.map((c) => ctx.colKey(c.row, c.col))).size < cells.length ||
          (ctx.pillarKey && new Set(cells.map((c) => ctx.pillarKey(c.row, c.col))).size < cells.length)
        )
          continue;
        ctx.tick(need);
        if (!canFill(state, cells, open)) continue;
        feasible++;
        const here = new Set(cells.map(cellKey));
        for (const key of here) inAny.add(key);
        for (const key of [...inAll.keys()]) if (!here.has(key)) inAll.delete(key);
      }
      if (feasible === 0) {
        state.dead = true;
        break;
      }
      // cells that cannot be occupied in any way of getting the count right: nobody is there
      const never = available.filter((cell) => !inAny.has(cellKey(cell)));
      if (never.length > 0) {
        for (const c of open) {
          const removed = state.domains.get(c.id).filter((cell) => never.some((n) => n.row === cell.row && n.col === cell.col));
          if (removed.length === 0) continue;
          total += removeCells(state, c.id, removed);
          record(ctx, rec, "regionCount", { characterId: c.id, eliminated: removed, clueIds: [clue.id] });
        }
      }
      // cells that are occupied in every way: somebody is there
      for (const cell of inAll.values()) total += addFact(state, cell, [clue.id]);
    }
    return total;
  },

  // «Somebody (a woman on a pallet, a man who is seated, anyone in the room…) exists»: only the open characters that have the
  // property in some cell they can still take can be that person. If just one can, they are; if the cells where it can be are
  // all in one line, that line is theirs; if there is one cell only, somebody certainly stands there.
  witness(ctx, state, rec) {
    let total = 0;
    for (const { clue, base } of existentialsOf(ctx)) {
      if (state.dead) break;
      // «somebody near X» with X a person still to place: whether a cell near X exists depends on where X will be, not on the
      // witness's own cell, so the witness cannot be looked for cell by cell (the search would find nobody and call it a contradiction)
      const aimedAt = clue.params?.targetId;
      if (aimedAt && ctx.puzzle.characters.some((c) => c.id === aimedAt) && !state.confirmed.has(aimedAt)) continue;
      if (base(state.confirmed, false) === false) continue; // somebody placed already is the witness
      const open = unplacedCharacters(ctx, state);
      const cellsOf = new Map(); // character id -> cells where it would be the witness
      const tentative = new Map(state.confirmed);
      for (const c of open) {
        const cells = [];
        for (const cell of state.domains.get(c.id)) {
          tentative.set(c.id, cell);
          ctx.tick();
          if (base(tentative, false) === false) cells.push(cell);
        }
        tentative.delete(c.id);
        if (cells.length > 0) cellsOf.set(c.id, cells);
      }
      if (cellsOf.size === 0) {
        state.dead = true;
        break;
      }
      if (cellsOf.size === 1) {
        const [[id, cells]] = [...cellsOf];
        const keep = new Set(cells.map(cellKey));
        const removed = state.domains.get(id).filter((cell) => !keep.has(cellKey(cell)));
        if (removed.length > 0) {
          total += removeCells(state, id, removed);
          record(ctx, rec, "witness", { characterId: id, eliminated: removed, clueIds: [clue.id] });
        }
      }
      const union = new Map();
      for (const cells of cellsOf.values()) for (const cell of cells) union.set(cellKey(cell), cell);
      const where = [...union.values()];
      if (where.length === 1) {
        // nobody who cannot be the witness may take the cell, and somebody certainly stands there
        for (const c of open) {
          if (cellsOf.has(c.id) || !hasCell(state.domains.get(c.id), where[0])) continue;
          total += removeCells(state, c.id, [where[0]]);
          record(ctx, rec, "witness", { characterId: c.id, eliminated: [where[0]], clueIds: [clue.id] });
        }
        total += addFact(state, where[0], [clue.id]);
        continue;
      }
      for (const axis of ["row", "col"]) {
        const lineOf = (cell) => (axis === "row" ? ctx.rowKey(cell.row, cell.col) : ctx.colKey(cell.row, cell.col));
        if (!where.every((cell) => lineOf(cell) === lineOf(where[0]))) continue;
        for (const c of open) {
          const removed = state.domains.get(c.id).filter((cell) => lineOf(cell) === lineOf(where[0]) && !union.has(cellKey(cell)));
          if (removed.length === 0) continue;
          total += removeCells(state, c.id, removed);
          record(ctx, rec, "witness", {
            characterId: c.id,
            eliminated: removed,
            clueIds: [clue.id],
            line: { axis, indexes: [where[0][axis]] },
          });
        }
      }
    }
    return total;
  },

  // Somebody certainly stands in this cell (whoever they are): nobody else can be anywhere else in its row or column, and if
  // only one open character can take the cell, it is theirs.
  occupiedCell(ctx, state, rec) {
    let total = 0;
    for (const fact of [...state.occupied.values()]) {
      if (state.dead) break;
      if ([...state.confirmed.values()].some((pos) => pos.row === fact.row && pos.col === fact.col)) continue; // placed: rowColTaken has it
      const open = unplacedCharacters(ctx, state);
      const candidates = open.filter((c) => hasCell(state.domains.get(c.id), fact));
      if (candidates.length === 0) {
        state.dead = true;
        break;
      }
      for (const c of open) {
        const removed = state.domains
          .get(c.id)
          .filter(
            (cell) =>
              (ctx.rowKey(cell.row, cell.col) === ctx.rowKey(fact.row, fact.col) ||
                ctx.colKey(cell.row, cell.col) === ctx.colKey(fact.row, fact.col) ||
                (ctx.pillarKey && ctx.pillarKey(cell.row, cell.col) === ctx.pillarKey(fact.row, fact.col))) &&
              !(cell.row === fact.row && cell.col === fact.col)
          );
        if (removed.length === 0) continue;
        total += removeCells(state, c.id, removed);
        record(ctx, rec, "occupiedCell", {
          characterId: c.id,
          eliminated: removed,
          clueIds: fact.clueIds,
          cell: { row: fact.row, col: fact.col },
        });
      }
      if (candidates.length === 1 && !state.dead) {
        const [only] = candidates;
        const removed = state.domains.get(only.id).filter((cell) => !(cell.row === fact.row && cell.col === fact.col));
        if (removed.length > 0) {
          total += removeCells(state, only.id, removed);
          record(ctx, rec, "occupiedCell", {
            characterId: only.id,
            eliminated: removed,
            clueIds: fact.clueIds,
            cell: { row: fact.row, col: fact.col },
          });
        }
      }
    }
    return total;
  },

  // Only sound when every row (every column) must hold somebody, i.e. there are as many characters as rows (columns).
  lastInLine(ctx, state, rec) {
    const characters = ctx.puzzle.characters;
    let total = 0;
    for (const axis of ctx.lineAxes) {
      const size = axis === "row" ? ctx.rows : ctx.cols;
      if (characters.length !== size) continue;
      const taken = new Set();
      for (const pos of state.confirmed.values()) taken.add(pos[axis]);
      for (let line = 0; line < size && !state.dead; line++) {
        if (taken.has(line)) continue;
        const candidates = unplacedCharacters(ctx, state).filter((c) => state.domains.get(c.id).some((cell) => cell[axis] === line));
        if (candidates.length === 0) {
          state.dead = true;
          return total;
        }
        if (candidates.length !== 1) continue;
        const [only] = candidates;
        const removed = state.domains.get(only.id).filter((cell) => cell[axis] !== line);
        if (removed.length === 0) continue;
        total += removeCells(state, only.id, removed);
        record(ctx, rec, "lastInLine", { characterId: only.id, eliminated: removed, clueIds: [], line: { axis, index: line } });
      }
    }
    return total;
  },

  // A character whose cells are all in one row (or one column) is in it: nobody else may take that row (column).
  lineConfined(ctx, state, rec) {
    let total = 0;
    for (const axis of ctx.lineAxes) {
      for (const owner of unplacedCharacters(ctx, state)) {
        if (state.dead) return total;
        const cells = state.domains.get(owner.id);
        if (cells.length < 2) continue; // one cell: it is the only candidate, not this
        const line = cells[0][axis];
        if (!cells.every((cell) => cell[axis] === line)) continue;
        total += takeLinesFromOthers(ctx, state, rec, "lineConfined", [owner], axis, [line]);
      }
    }
    return total;
  },

  // K characters (2 or more) whose cells are in only K rows (or columns) have those rows: nobody else may take them.
  lineGroups(ctx, state, rec) {
    const unplaced = unplacedCharacters(ctx, state);
    const n = unplaced.length;
    let total = 0;
    for (const axis of ctx.lineAxes) {
      const masks = unplaced.map((c) => state.domains.get(c.id).reduce((m, cell) => m | (1 << cell[axis]), 0));
      const maxK = n <= 9 ? n - 1 : Math.min(4, n - 1);
      for (let k = 2; k <= maxK && !state.dead; k++) {
        for (const group of combinations(n, k)) {
          ctx.tick();
          let union = 0;
          for (const i of group) union |= masks[i];
          const lines = popcount(union);
          if (lines < k) {
            state.dead = true;
            return total;
          }
          if (lines !== k) continue;
          const members = group.map((i) => unplaced[i]);
          const indexes = [];
          for (let bit = 0; bit < 32; bit++) if (union & (1 << bit)) indexes.push(bit);
          total += takeLinesFromOthers(ctx, state, rec, "lineGroups", members, axis, indexes);
          if (total > 0) return total; // the easier reasonings get another go first
        }
      }
    }
    return total;
  },

  // The other way round of `subsets`: K cells where somebody certainly stands (the «somebody is there» facts, occupiedCell) that only K
  // characters can reach are taken by exactly those K characters: they lose every cell outside them. (For rows and columns this is
  // `lineGroups` seen from the other characters: K rows only K characters can reach leave the rest of the characters in the rest of the rows.)
  hiddenGroups(ctx, state, rec) {
    const unplaced = unplacedCharacters(ctx, state);
    if (unplaced.length < 3) return 0;
    const keepOnly = (members, belongs, extra) => {
      let total = 0;
      for (const member of members) {
        const removed = state.domains.get(member.id).filter((cell) => !belongs(cell));
        if (removed.length === 0) continue;
        total += removeCells(state, member.id, removed);
        record(ctx, rec, "hiddenGroups", {
          characterId: member.id,
          eliminated: removed,
          clueIds: [],
          byCharacterIds: members.filter((m) => m.id !== member.id).map((m) => m.id),
          ...extra,
        });
      }
      return total;
    };
    // `reach[i]`: bit j set when character j can take something of line/fact i
    const search = (reach, kMax, onGroup) => {
      for (let k = 2; k <= kMax; k++) {
        for (const group of combinations(reach.length, k)) {
          ctx.tick();
          let union = 0;
          for (const i of group) union |= reach[i];
          const count = popcount(union);
          if (count < k) {
            state.dead = true;
            return 1;
          }
          if (count !== k) continue;
          const members = unplaced.filter((_, j) => union & (1 << j));
          const done = onGroup(group, members);
          if (done > 0) return done;
        }
      }
      return 0;
    };
    const facts = [...state.occupied.values()]
      .filter((f) => ![...state.confirmed.values()].some((pos) => pos.row === f.row && pos.col === f.col))
      .slice(0, 12);
    if (facts.length >= 2) {
      const reach = facts.map((f) => unplaced.reduce((mask, c, j) => (hasCell(state.domains.get(c.id), f) ? mask | (1 << j) : mask), 0));
      return search(reach, Math.min(4, facts.length), (group, members) => {
        const cells = group.map((i) => facts[i]);
        return keepOnly(members, (cell) => hasCell(cells, cell), { cells: cells.map(({ row, col }) => ({ row, col })) });
      });
    }
    return 0;
  },

  subsets(ctx, state, rec) {
    const unplaced = unplacedCharacters(ctx, state);
    if (unplaced.length < 2) return 0;
    const before = new Map(unplaced.map((c) => [c.id, state.domains.get(c.id)]));
    const witnessOf = new Map();
    const { contradiction } = applyNakedSubsets(
      unplaced,
      state.domains,
      witnessOf,
      createOpsBudget(PROPAGATION_MAX_SUBSET_OPS),
      ctx.rowKey,
      ctx.colKey,
      ctx.pillarKey
    );
    if (contradiction) {
      state.dead = true;
      return 1;
    }
    ctx.tick(unplaced.length);
    state.version++;
    let total = 0;
    for (const character of unplaced) {
      const after = state.domains.get(character.id);
      const gone = before.get(character.id).filter((c) => !after.some((d) => d.row === c.row && d.col === c.col));
      if (gone.length === 0) continue;
      total += gone.length;
      state.cv.set(character.id, (state.cv.get(character.id) ?? 0) + 1);
      const subsetOf = witnessOf.get(`${character.id},${gone[0].row},${gone[0].col}`)?.nakedSubset;
      record(ctx, rec, "subsets", {
        characterId: character.id,
        eliminated: gone,
        clueIds: [],
        byCharacterIds: subsetOf?.characterIds ?? [],
      });
    }
    return total;
  },

  // a clue between the character and ONE other open character ...
  pairSupport(ctx, state, rec) {
    return eliminateBySupport(ctx, state, rec, "pairSupport", (character) =>
      depInfos(ctx)
        .filter((i) => !i.isOr && i.dep.ids.has(character.id))
        .map((info) => ({ info, refs: openReferences(state, info, character.id) }))
        .filter(({ refs }) => refs.length === 1)
    );
  },

  // ... or between the character and TWO others (harder to hold in the head)
  mutualSupport(ctx, state, rec) {
    return eliminateBySupport(ctx, state, rec, "mutualSupport", (character) =>
      depInfos(ctx)
        .filter((i) => !i.isOr && i.dep.ids.has(character.id))
        .map((info) => ({ info, refs: openReferences(state, info, character.id) }))
        .filter(({ refs }) => refs.length === 2)
    );
  },

  alternatives(ctx, state, rec) {
    const orInfos = depInfos(ctx).filter((i) => i.isOr);
    let total = 0;
    // the alternatives about characters already placed (or the character alone) ...
    total += eliminateByEvaluation(ctx, state, rec, "alternatives", (character) =>
      orInfos.filter((i) => i.dep.ids.has(character.id) && openReferences(state, i, character.id).length === 0)
    );
    // ... and about open characters
    total += eliminateBySupport(ctx, state, rec, "alternatives", (character) =>
      orInfos
        .filter((i) => i.dep.ids.has(character.id))
        .map((info) => ({ info, refs: openReferences(state, info, character.id) }))
        .filter(({ refs }) => refs.length >= 1 && refs.length <= 2)
    );
    return total;
  },

  globalCount(ctx, state, rec) {
    const infos = ctx.infos.filter((i) => i.group === "globalCount");
    return eliminateByEvaluation(ctx, state, rec, "globalCount", () => infos);
  },

  // The clues that only speak when the board is complete: with few characters left, a cell is out when NO way of placing the
  // others (in the cells they can still take) keeps every clue true. Counted by hand, as a person finishes the last few.
  finishedBoard(ctx, state, rec) {
    if (!ctx.infos.some((i) => i.group === "finished")) return 0;
    const unplaced = unplacedCharacters(ctx, state);
    if (unplaced.length > FINISHED_MAX_OPEN) return 0;
    let combos = 1;
    for (const c of unplaced) combos *= state.domains.get(c.id).length;
    if (combos > FINISHED_MAX_COMBINATIONS) return 0;
    // every complete arrangement of the open characters that breaks no clue
    const alive = unplaced.map(() => new Set());
    const map = new Map(state.confirmed);
    const taken = makeLineTracker(ctx);
    for (const { row, col } of map.values()) taken.add(row, col);
    const walk = (i) => {
      if (i === unplaced.length) {
        for (const info of ctx.infos) {
          ctx.tick();
          if (info.predicate(map, true) === false) return;
        }
        unplaced.forEach((c, k) => alive[k].add(map.get(c.id).row * 64 + map.get(c.id).col));
        return;
      }
      for (const cell of state.domains.get(unplaced[i].id)) {
        if (taken.has(cell.row, cell.col)) continue;
        map.set(unplaced[i].id, cell);
        taken.add(cell.row, cell.col);
        walk(i + 1);
        taken.delete(cell.row, cell.col);
        map.delete(unplaced[i].id);
      }
    };
    walk(0);
    let total = 0;
    unplaced.forEach((character, k) => {
      const removed = state.domains.get(character.id).filter((c) => !alive[k].has(c.row * 64 + c.col));
      if (removed.length === 0) return;
      total += removeCells(state, character.id, removed);
      record(ctx, rec, "finishedBoard", {
        characterId: character.id,
        eliminated: removed,
        clueIds: ctx.infos.filter((i) => i.group === "finished").map((i) => i.clue.id),
      });
    });
    return total;
  },

  hypothesis(ctx, state, rec) {
    return tryHypotheses(ctx, state, rec, "hypothesis", 1);
  },

  nestedHypothesis(ctx, state, rec) {
    return tryHypotheses(ctx, state, rec, "nestedHypothesis", 2);
  },
  // `exhaustive` is not a reasoning that rules cells out: see humanSolve.
};

// Try each cell of each open character (the most constrained first): place it, follow the consequences with the
// reasonings below `depth`, and rule the cell out if they lead to a contradiction. Stops at the first character that
// loses a cell, so that the easier reasonings get another go before anything harder is tried.
function tryHypotheses(ctx, state, rec, technique, depth) {
  if (depth === 2) {
    if (ctx.nestedOff) return 0;
    ctx.soft = ctx.work + NESTED_HYPOTHESIS_WORK;
    try {
      return hypothesesSweep(ctx, state, rec, technique, depth);
    } catch (error) {
      if (!(error instanceof SoftLimit)) throw error;
      ctx.nestedOff = true;
      return 0;
    } finally {
      ctx.soft = null;
    }
  }
  return hypothesesSweep(ctx, state, rec, technique, depth);
}

function hypothesesSweep(ctx, state, rec, technique, depth) {
  const unplaced = unplacedCharacters(ctx, state).sort((a, b) => state.domains.get(a.id).length - state.domains.get(b.id).length);
  const inner = new Set(["exhaustive", "nestedHypothesis"]);
  if (depth === 1) inner.add("hypothesis");
  const allowedIds = TECHNIQUES.filter((t) => !inner.has(t.id)).map((t) => t.id);
  // all the cells of all the characters are tried against the SAME board; what is ruled out together is sound together
  const found = [];
  for (const character of unplaced) {
    const removed = [];
    for (const cell of state.domains.get(character.id)) {
      const sim = cloneState(state);
      place(ctx, sim, character.id, cell);
      if (!sim.dead) closure(ctx, sim, null, allowedIds);
      if (sim.dead) removed.push(cell);
    }
    if (removed.length > 0) found.push({ character, removed });
  }
  let total = 0;
  for (const { character, removed } of found) {
    if (state.dead) break;
    total += removeCells(state, character.id, removed);
    record(ctx, rec, technique, { characterId: character.id, eliminated: removed, clueIds: [], depth });
  }
  return total;
}

// ---- the loop ---------------------------------------------------------------------------------------------------------
// Applies the reasonings (the ids in `allowedIds`, in catalogue order) until none makes progress. After EVERY successful
// reasoning it starts again from the easiest one.
function closure(ctx, state, rec, allowedIds) {
  const order = TECHNIQUES.filter((t) => allowedIds.includes(t.id) && RUNNERS[t.id]).map((t) => t.id);
  for (;;) {
    if (state.dead || state.confirmed.size === ctx.puzzle.characters.length) return;
    let progressed = false;
    for (const id of order) {
      if (runTechnique(ctx, state, rec, id) > 0) {
        progressed = true;
        break;
      }
      if (state.dead) return;
    }
    if (!progressed) return;
  }
}

export function humanSolve(
  puzzle,
  { maxLevel = "expert", maxWork = Infinity, deadline = null, shouldStop = null, onProgress = null, placements = null } = {}
) {
  const ctx = buildContext(puzzle, { maxWork, deadline, shouldStop });
  const rec = { steps: [] };
  const state = initialState(ctx);
  const allowed = techniquesUpTo(maxLevel).map((t) => t.id);
  const total = puzzle.characters.length;

  const result = (status) => {
    const counts = {};
    let hardest = null;
    for (const step of rec.steps) {
      counts[step.technique] = (counts[step.technique] || 0) + 1;
      if (hardest === null || techniqueIndex(step.technique) > techniqueIndex(hardest)) hardest = step.technique;
    }
    return {
      status,
      level: hardest ? levelOfTechnique(hardest) : null,
      hardest,
      steps: rec.steps,
      counts,
      placements: new Map(state.confirmed),
      work: ctx.work,
    };
  };

  if (total === 0) return result("solved");
  try {
    // somebody is already placed (a player's board): start from there
    if (placements) {
      for (const [characterId, cell] of placements) {
        if (state.confirmed.has(characterId) || !state.domains.has(characterId)) continue;
        place(ctx, state, characterId, cell);
      }
    }
    let lastReported = -1;
    // The loop is closure() written out, to report progress and to hand over to the exhaustive search at the end.
    const order = TECHNIQUES.filter((t) => allowed.includes(t.id) && RUNNERS[t.id]).map((t) => t.id);
    for (;;) {
      if (state.dead) return result("contradiction");
      if (state.confirmed.size === total) break;
      if (onProgress && state.confirmed.size !== lastReported) {
        lastReported = state.confirmed.size;
        onProgress(state.confirmed.size / total);
      }
      let progressed = false;
      for (const id of order) {
        if (runTechnique(ctx, state, rec, id) > 0) {
          progressed = true;
          break;
        }
        if (state.dead) return result("contradiction");
      }
      if (progressed) continue;
      if (!allowed.includes("exhaustive")) return result("stuck");
      return exhaustive(ctx, state, rec, result);
    }
    if (!consistent(ctx, state)) return result("contradiction");
    return result("solved");
  } catch (error) {
    if (error instanceof LimitReached) return result("limit");
    throw error;
  }
}

const techniqueIndex = (id) => TECHNIQUES.findIndex((t) => t.id === id);

function exhaustive(ctx, state, rec, result) {
  const stats = {};
  const solutions = solvePuzzle(ctx.puzzle, {
    maxSolutions: 2,
    fixedPlacements: state.confirmed,
    domains: state.domains,
    forwardCheck: true,
    forwardCheckMinRemaining: 4,
    maxWork: ctx.maxWork - ctx.work,
    deadline: ctx.deadline,
    shouldStop: ctx.shouldStop,
    stats,
  });
  ctx.work += stats.evaluations ?? 0;
  if (stats.workCapHit || stats.nodeCapHit || stats.timedOut) return result("limit");
  if (solutions.length === 0) return result("contradiction");
  if (solutions.length >= 2) return result("ambiguous");
  for (const { characterId, row, col } of solutions[0]) {
    if (state.confirmed.has(characterId)) continue;
    state.confirmed.set(characterId, { row, col });
    record(ctx, rec, "exhaustive", { characterId, placed: { row, col }, clueIds: [] });
  }
  return result("solved");
}

export { LEVELS, levelIndex };
