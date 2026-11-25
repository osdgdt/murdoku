import { makeId } from "../util/id.js";
import { isOccupiable } from "./grid.js";
import { hasSectors } from "./sectors.js";
import { isSafeId } from "../util/safe.js";
import { t } from "../i18n/i18n.js";

// Hidden roles (Medioevo: nobili, villici, cavalieri; Far West: fuorilegge; Preistoria: mansioni).
//
// One mechanism for all of them. A case may declare `puzzle.roles`:
//   { everyone: boolean,                // true: every person has one of the roles (no "nobody-special")
//     defs:     [{ id, name, rule }],   // the roles, `rule` says where a person with that role may stand
//     counts:   { [roleId]: n } }       // how many people have each role (a role left out: any number)
// and, on the map, rooms may be "noble areas" (`zone.kind === "noble"`) and cells may be "role cells"
// (`cell.roleCell === roleId`: only a person with that role can stand there, the Preistoria task squares).
// The author's own answer (who has which role) is `solution.roles: { [characterId]: roleId | null }`.
// The player never types roles in: they are deduced, like the places. Everything is optional, so an older
// case (no `roles`) is played exactly as before.

// Where the people of a role may stand, as far as noble areas go: "none" = anywhere, "inNoble" = only in
// a noble area, "notInNoble" = never in one, "onePerSector" = anywhere but exactly one person in each map of the case
// (the Wild West train: one outlaw per wagon).
export const ROLE_RULES = ["none", "inNoble", "notInNoble", "onePerSector"];
export const MAX_ROLES = 8;
export const MAX_ROLE_NAME = 30;

export const ROLE_RULE_LABELS = {
  none: t("Può stare dove vuole"),
  inNoble: t("Solo nelle aree nobili"),
  notInNoble: t("Mai nelle aree nobili"),
  onePerSector: t("Uno solo per vagone o piano"),
};

// Ready-made sets of roles of the book's chapters.
export const ROLE_PRESETS = {
  medieval: {
    label: t("Nobili, villici e cavalieri"),
    everyone: true,
    roles: [
      [t("Nobile"), "inNoble"],
      [t("Villico"), "notInNoble"],
      [t("Cavaliere"), "none"],
    ],
  },
  outlaws: { label: t("Fuorilegge"), everyone: false, roles: [[t("Fuorilegge"), "none"]] },
  tasks: {
    label: t("Mansioni"),
    everyone: false,
    roles: [
      [t("Cacciatore"), "none"],
      [t("Pescatore"), "none"],
      [t("Artigiano"), "none"],
      [t("Raccoglitore"), "none"],
      [t("Domatore"), "none"],
    ],
  },
};

export const isRoleRule = (rule) => ROLE_RULES.includes(rule);

export function hasRoles(puzzle) {
  return Array.isArray(puzzle?.roles?.defs) && puzzle.roles.defs.length > 0;
}

export function roleDef(puzzle, roleId) {
  return puzzle?.roles?.defs?.find((d) => d.id === roleId) || null;
}

export function roleName(puzzle, roleId) {
  return roleDef(puzzle, roleId)?.name || "?";
}

// `puzzle.roles`, created empty when the case has none yet (the editor's panel).
export function ensureRoles(puzzle) {
  if (!puzzle.roles || typeof puzzle.roles !== "object") puzzle.roles = { everyone: false, defs: [], counts: {} };
  puzzle.roles.defs = Array.isArray(puzzle.roles.defs) ? puzzle.roles.defs : [];
  puzzle.roles.counts = puzzle.roles.counts && typeof puzzle.roles.counts === "object" ? puzzle.roles.counts : {};
  return puzzle.roles;
}

function cleanName(name) {
  return String(name ?? "")
    .trim()
    .slice(0, MAX_ROLE_NAME)
    .trim();
}

// Adds a role. Returns it, or null when the name is blank or taken, or there are too many roles.
export function addRole(puzzle, name, rule = "none") {
  const clean = cleanName(name);
  const roles = ensureRoles(puzzle);
  if (!clean || roles.defs.length >= MAX_ROLES) return null;
  if (roles.defs.some((d) => d.name.toLowerCase() === clean.toLowerCase())) return null;
  const def = { id: makeId("role"), name: clean, rule: isRoleRule(rule) ? rule : "none" };
  roles.defs.push(def);
  return def;
}

export function renameRole(puzzle, roleId, name) {
  const def = roleDef(puzzle, roleId);
  const clean = cleanName(name);
  if (!def || !clean) return false;
  if (puzzle.roles.defs.some((d) => d.id !== roleId && d.name.toLowerCase() === clean.toLowerCase())) return false;
  def.name = clean;
  return true;
}

export function setRoleRule(puzzle, roleId, rule) {
  const def = roleDef(puzzle, roleId);
  if (!def || !isRoleRule(rule)) return false;
  def.rule = rule;
  return true;
}

// How many people have the role (null / not a whole number >= 0: no declared number).
export function setRoleCount(puzzle, roleId, count) {
  const roles = ensureRoles(puzzle);
  if (!roleDef(puzzle, roleId)) return false;
  if (Number.isInteger(count) && count >= 0) roles.counts[roleId] = count;
  else delete roles.counts[roleId];
  return true;
}

export function setEveryoneHasRole(puzzle, everyone) {
  ensureRoles(puzzle).everyone = !!everyone;
}

// Does a clue (or a clue nested in it) name this role?
function mentionsRole(spec, roleId) {
  if (!spec || typeof spec !== "object") return false;
  const params = spec.params || {};
  if (params.roleId === roleId) return true;
  return [params.a, params.b, params.customClue].some((nested) => mentionsRole(nested, roleId));
}

// Takes a role out of the case: the cells that were reserved for it are freed, the people that had it in the
// author's solution lose it, and the clues about it go (they could not mean anything any more).
export function removeRole(puzzle, roleId) {
  const roles = puzzle.roles;
  if (!roles || !roleDef(puzzle, roleId)) return false;
  roles.defs = roles.defs.filter((d) => d.id !== roleId);
  delete roles.counts[roleId];
  for (const row of puzzle.grid.cells) for (const cell of row) if (cell.roleCell === roleId) delete cell.roleCell;
  if (puzzle.solution?.roles)
    for (const [id, role] of Object.entries(puzzle.solution.roles)) if (role === roleId) puzzle.solution.roles[id] = null;
  puzzle.clues = puzzle.clues.filter((clue) => !mentionsRole(clue, roleId));
  return true;
}

// Takes every role away from the case (what "no hidden roles" means).
export function clearRoles(puzzle) {
  for (const def of [...(puzzle.roles?.defs || [])]) removeRole(puzzle, def.id);
  delete puzzle.roles;
  delete puzzle.solution?.roles;
  for (const zone of puzzle.grid.zones) delete zone.kind;
}

// Creates the roles of a preset (skipping names already in use) and returns them.
export function applyRolePreset(puzzle, presetId) {
  const preset = ROLE_PRESETS[presetId];
  if (!preset) return [];
  const added = [];
  for (const [name, rule] of preset.roles) {
    const def = addRole(puzzle, name, rule);
    if (def) added.push(def);
  }
  if (preset.everyone && added.length > 0) setEveryoneHasRole(puzzle, true);
  return added;
}

// ---- the map: noble areas and role cells ----

export const isNobleZone = (zone) => zone?.kind === "noble";

export function setZoneNoble(grid, zoneId, noble) {
  const zone = grid.zones.find((z) => z.id === zoneId);
  if (!zone) return false;
  if (noble) zone.kind = "noble";
  else delete zone.kind;
  return true;
}

export function hasNobleZones(grid) {
  return grid.zones.some(isNobleZone);
}

export function roleCellOf(grid, row, col) {
  return grid.cells[row]?.[col]?.roleCell ?? null;
}

export function hasRoleCells(grid) {
  return grid.cells.some((row) => row.some((cell) => typeof cell.roleCell === "string"));
}

// Reserves a cell for the people of a role (roleId null: frees it). It needs a place where a person can stand.
export function setRoleCell(grid, row, col, roleId) {
  const cell = grid.cells[row]?.[col];
  if (!cell) return false;
  if (!roleId) {
    delete cell.roleCell;
    return true;
  }
  if (!isOccupiable(grid, row, col)) return false;
  cell.roleCell = roleId;
  return true;
}

// May a person with this role (null: no role) stand on (row, col)? `puzzle` must have the map.
export function roleAllowsCell(puzzle, roleId, row, col) {
  const cell = puzzle.grid.cells[row]?.[col];
  if (!cell) return false;
  if (typeof cell.roleCell === "string" && cell.roleCell !== roleId) return false;
  const def = roleId ? roleDef(puzzle, roleId) : null;
  if (!def || def.rule === "none" || def.rule === "onePerSector") return true;
  const zone = cell.zoneId ? puzzle.grid.zones.find((z) => z.id === cell.zoneId) : null;
  return def.rule === "inNoble" ? isNobleZone(zone) : !isNobleZone(zone);
}

// ---- who has which role ----

// The author's declared roles as the Map<characterId, roleId|null> the predicates read; characters the author has not
// given a role yet are left out (their role is unknown). `null` when the case has no roles.
export function declaredRoleMap(puzzle) {
  if (!hasRoles(puzzle)) return null;
  const map = new Map();
  for (const [id, role] of Object.entries(puzzle.solution?.roles || {})) {
    if (!puzzle.characters.some((c) => c.id === id)) continue;
    map.set(id, role && roleDef(puzzle, role) ? role : null);
  }
  return map;
}

// The puzzle seen with the roles of the author's solution, for evaluating clues against it (the editor's suggestions, the
// checker of the declared solution, the generator). Unchanged when the case has no roles or they are already known.
export function withDeclaredRoles(puzzle) {
  if (puzzle.roleOf || !hasRoles(puzzle)) return puzzle;
  return withRoles(puzzle, declaredRoleMap(puzzle));
}

export function setSolutionRole(puzzle, characterId, roleId) {
  puzzle.solution.roles = puzzle.solution.roles || {};
  if (roleId === undefined) delete puzzle.solution.roles[characterId];
  else puzzle.solution.roles[characterId] = roleId && roleDef(puzzle, roleId) ? roleId : null;
}

// The same case with a role assigned to everybody, for the code that evaluates clues: `roleOf` is a runtime-only
// Map<characterId, roleId|null> that never reaches a saved or shared case.
export function withRoles(puzzle, roleOf) {
  return { ...puzzle, roleOf };
}

// What the case says about its roles, as sentences for the player and the print: the roles with how many people have
// each, whether everybody has one, and the noble areas. Empty when the case has no roles.
export function rolesSummary(puzzle) {
  if (!hasRoles(puzzle)) return [];
  const { defs, counts = {}, everyone } = puzzle.roles;
  const parts = defs.map((d) => (Number.isInteger(counts[d.id]) ? `${d.name} (${counts[d.id]})` : d.name));
  const lines = [t("Ruoli nascosti: {roles}.", { roles: parts.join(", ") })];
  if (everyone) lines.push(t("Ognuno ha un ruolo."));
  const noble = puzzle.grid.zones.filter(isNobleZone).map((z) => z.name);
  if (noble.length > 0) lines.push(t("Aree nobili (♛): {zones}.", { zones: noble.join(", ") }));
  return lines;
}

// Problems of the roles themselves (not of the clues): messages for the editor and for validatePuzzleShape.
export function roleProblems(puzzle) {
  const problems = [];
  const roles = puzzle.roles;
  if (roles === undefined) return problems;
  if (!roles || typeof roles !== "object" || !Array.isArray(roles.defs)) return [t("I ruoli non sono validi.")];
  const ids = new Set();
  for (const def of roles.defs) {
    if (!def || typeof def !== "object" || !isSafeId(def.id) || typeof def.name !== "string" || ids.has(def.id) || !isRoleRule(def.rule)) {
      problems.push(t("Un ruolo non è valido."));
      continue;
    }
    ids.add(def.id);
  }
  if (roles.defs.some((d) => d?.rule === "onePerSector") && !hasSectors(puzzle.grid)) {
    problems.push(t("«Uno solo per vagone o piano» ha senso solo in una mappa divisa in più mappe."));
  }
  if (roles.defs.length > MAX_ROLES) problems.push(t("Troppi ruoli (al massimo {max}).", { max: MAX_ROLES }));
  let total = 0;
  for (const [id, n] of Object.entries(roles.counts && typeof roles.counts === "object" ? roles.counts : {})) {
    if (!ids.has(id) || !Number.isInteger(n) || n < 0 || n > 16) problems.push(t("Il numero di persone di un ruolo non è valido."));
    else total += n;
  }
  const people = Array.isArray(puzzle.characters) ? puzzle.characters.length : 0;
  if (total > people) problems.push(t("I ruoli dichiarati sono più delle persone ({total} su {people}).", { total, people }));
  const declaredAll = ids.size > 0 && [...ids].every((id) => Number.isInteger(roles.counts?.[id]));
  if (roles.everyone && declaredAll && total !== people)
    problems.push(t("Ogni persona ha un ruolo, ma i numeri dichiarati sono {total} su {people} persone.", { total, people }));
  for (const [row, cells] of (puzzle.grid?.cells || []).entries()) {
    for (const [col, cell] of cells.entries()) {
      if (cell.roleCell !== undefined && !ids.has(cell.roleCell))
        problems.push(t("La casella R{row}, C{col} è riservata a un ruolo che non esiste.", { row: row + 1, col: col + 1 }));
    }
  }
  const solutionRoles = puzzle.solution?.roles;
  if (solutionRoles !== undefined) {
    if (!solutionRoles || typeof solutionRoles !== "object") problems.push(t("I ruoli della soluzione non sono validi."));
    else
      for (const [id, role] of Object.entries(solutionRoles)) {
        if (role !== null && !ids.has(role)) problems.push(t("La soluzione dà a {id} un ruolo che non esiste.", { id }));
      }
  }
  return problems;
}

// Does the author's own solution give everybody a role that agrees with the declared numbers? Messages for what
// does not (the case checker shows them next to the clues' own violations).
export function declaredRoleProblems(puzzle) {
  const problems = [];
  if (!hasRoles(puzzle)) return problems;
  const map = declaredRoleMap(puzzle);
  const missing = puzzle.characters.filter((c) => !map.has(c.id));
  if (missing.length > 0) {
    problems.push(t("Nella soluzione manca il ruolo di: {names}.", { names: missing.map((c) => c.name).join(", ") }));
    return problems;
  }
  const roles = puzzle.roles;
  const tally = new Map();
  for (const role of map.values()) tally.set(role, (tally.get(role) || 0) + 1);
  if (roles.everyone && tally.get(null)) problems.push(t("Ogni persona dovrebbe avere un ruolo, ma qualcuna non ce l'ha."));
  for (const def of roles.defs) {
    const wanted = roles.counts?.[def.id];
    if (Number.isInteger(wanted) && (tally.get(def.id) || 0) !== wanted)
      problems.push(
        t("Dovrebbero esserci {wanted} persone con il ruolo «{name}», nella soluzione sono {n}.", {
          wanted,
          name: def.name,
          n: tally.get(def.id) || 0,
        })
      );
  }
  return problems;
}
