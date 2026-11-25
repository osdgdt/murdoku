import { t } from "../i18n/i18n.js";

// Places whose name is not known (Pirates: four islands marked «???», whose names — Cocco, Deserta, Pietà, Sussurri — are
// to be deduced). The author gives every such room its real name as usual and marks it `nameHidden`; the board shows
// «???» and the clues say «nel luogo chiamato Cocco». Which room carries which name is a second unknown beside the
// positions, searched like the hidden roles (solver/names.js): for every way of giving the names to the rooms, the
// ordinary search runs with that assignment known (`puzzle.nameOf`), and solutions are counted over the PLACES.
export const HIDDEN_NAME = "???";
export const MAX_HIDDEN_NAMES = 6; // 6! = 720 assignments is the most the search is willing to try

export const isNameHidden = (zone) => zone?.nameHidden === true;
export const hiddenNameZones = (grid) => grid.zones.filter(isNameHidden);
export const hasHiddenNames = (puzzle) => hiddenNameZones(puzzle.grid).length > 0;

// The names still to be assigned: the real names of the rooms marked as hidden, in the order of the rooms.
export const placeNameLabels = (grid) => hiddenNameZones(grid).map((z) => z.name);

// "Hidden" takes the field away, so a case without unknown places stays exactly as it was.
export function setZoneNameHidden(grid, zoneId, hidden) {
  const zone = grid.zones.find((z) => z.id === zoneId);
  if (!zone) return false;
  if (hidden) zone.nameHidden = true;
  else delete zone.nameHidden;
  return true;
}

// What to write on the board for a room: its name, or «???» when it has to be deduced.
export const zoneDisplayName = (zone) => (isNameHidden(zone) ? HIDDEN_NAME : zone.name);

// ---- who is called what ----

// The author's real names as the Map<zoneId, name> the predicates read. `null` when no room is hidden.
export function declaredNameMap(puzzle) {
  const zones = hiddenNameZones(puzzle.grid);
  return zones.length === 0 ? null : new Map(zones.map((z) => [z.id, z.name]));
}

// The case with a name given to every hidden room. `nameOf` is runtime-only, like `roleOf`: it never reaches a saved case.
export function withNames(puzzle, nameOf) {
  return { ...puzzle, nameOf };
}

// The case seen with the author's real names, for the code that evaluates clues against the declared solution (the
// editor's suggestions, the checks, the generator). Unchanged when no room is hidden or the names are already known.
export function withDeclaredNames(puzzle) {
  if (puzzle.nameOf || !hasHiddenNames(puzzle)) return puzzle;
  return withNames(puzzle, declaredNameMap(puzzle));
}

// The name of a room: its own for an ordinary one; for a hidden one the name the assignment gives it, or `undefined`
// while that is not known (the board of a player, the human solver) — never a guess.
export function placeNameOf(puzzle, zone) {
  if (!zone) return undefined;
  if (!isNameHidden(zone)) return zone.name;
  const map = puzzle.nameOf;
  return map && map.has(zone.id) ? map.get(zone.id) : undefined;
}

// Problems of the names themselves (not of the clues): messages for the editor and for validatePuzzleShape.
export function placeNameProblems(puzzle) {
  const problems = [];
  const zones = puzzle.grid?.zones || [];
  const hidden = zones.filter(isNameHidden);
  if (hidden.length > MAX_HIDDEN_NAMES) {
    problems.push(t("Troppi luoghi con il nome da dedurre (al massimo {n}).", { n: MAX_HIDDEN_NAMES }));
  }
  const names = zones.map((z) =>
    String(z.name ?? "")
      .trim()
      .toLowerCase()
  );
  if (names.some((name, i) => names.indexOf(name) !== i && (isNameHidden(zones[i]) || isNameHidden(zones[names.indexOf(name)])))) {
    problems.push(t("Il nome di un luogo da dedurre deve essere diverso da quello di ogni altra stanza."));
  }
  const labels = puzzle.grid ? placeNameLabels(puzzle.grid) : [];
  for (const clue of puzzle.clues || []) {
    if (clue.type === "inPlaceNamed" && !labels.includes(clue.params?.placeName)) {
      problems.push(t("Un indizio parla di un luogo che non ha un nome da dedurre."));
      break;
    }
  }
  return problems;
}
