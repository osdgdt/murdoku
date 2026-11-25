import { roleAllowsCell } from "../../model/roles.js";
import { hasSectors, sectorIndexAt, sameFloor } from "../../model/sectors.js";
import { isDirection } from "../../util/geometry.js";
import { posOfCharacter, zoneAt, characterHasProperty } from "./helpers.js";

// Hidden roles in the predicates. A role is not part of a position: it travels in `puzzle.roleOf`, a runtime-only
// Map<characterId, roleId|null> (see model/roles.js `withRoles`), so the search keeps placing {row, col} as always and the
// solver only has to try the possible assignments of roles around it (solver/roles.js). Where the map has no entry for a
// character (or there is no map at all: the board of a player, the human solver) the role is UNKNOWN and every
// predicate here answers `undefined` — never a guess.

// Who has which role: the roleId, null (no role) or undefined (not known).
function roleOfCharacter(puzzle, characterId) {
  const map = puzzle.roleOf;
  return map && map.has(characterId) ? map.get(characterId) : undefined;
}

// Base rule of the cases with roles, always on like the victim and seal rules (see predicates/index.js): a person
// stands only where their role allows (noble areas, task squares). It judges a person as soon as both the cell and the
// role are known, and never prunes anything that could still be completed.
//
// A role with the rule "onePerSector" (the train's outlaw) also needs exactly one person in each map of the case (each
// wagon, each floor): two in one break it as soon as they are known, and a finished board with one that has none breaks it too.
export function roleRulePredicate(puzzle) {
  const perWagon = hasSectors(puzzle.grid) ? (puzzle.roles?.defs || []).filter((d) => d.rule === "onePerSector").map((d) => d.id) : [];
  return (pm, isComplete) => {
    let undecided = false;
    const inWagon = new Map(); // roleId -> how many people of that role are in each wagon
    for (const roleId of perWagon)
      inWagon.set(
        roleId,
        puzzle.grid.sectors.map(() => 0)
      );
    for (const c of puzzle.characters) {
      const pos = posOfCharacter(pm, c.id);
      const role = roleOfCharacter(puzzle, c.id);
      if (!pos || role === undefined) {
        undecided = true;
        continue;
      }
      if (!roleAllowsCell(puzzle, role, pos.row, pos.col)) return false;
      if (role && inWagon.has(role) && ++inWagon.get(role)[sectorIndexAt(puzzle.grid, pos.row, pos.col)] > 1) return false;
    }
    if (undecided) return isComplete ? true : undefined;
    for (const counts of inWagon.values()) if (counts.some((n) => n === 0)) return false;
    return true;
  };
}

// "<owner> è un <ruolo>" / with `roleId: "*"`: has any role at all (a task, an outlaw's mark). Needs no position: it is
// settled by the role alone.
function hasRole({ ownerId, puzzle, params }) {
  return () => {
    if (!params.roleId) return undefined;
    const role = roleOfCharacter(puzzle, ownerId);
    if (role === undefined) return undefined;
    return params.roleId === "*" ? role !== null : role === params.roleId;
  };
}

// "Tutti i <ruolo> erano in <stanza>": every person with the role stands in that room. A person already placed outside
// settles it (false); true only when everybody's role is known and the board is complete.
function roleAllInRoom({ puzzle, params }) {
  return (pm, isComplete) => {
    if (!params.roleId || !params.zoneId) return undefined;
    let undecided = false;
    for (const c of puzzle.characters) {
      const role = roleOfCharacter(puzzle, c.id);
      if (role === undefined) {
        undecided = true;
        continue;
      }
      if (role !== params.roleId) continue;
      const pos = posOfCharacter(pm, c.id);
      if (!pos) {
        undecided = true;
        continue;
      }
      if (zoneAt(puzzle, pos) !== params.zoneId) return false;
    }
    return undecided && !isComplete ? undefined : true;
  };
}

// "<owner> era a nord di tutti i <ruolo>": owner is on that side of every OTHER person with the role (and there is at
// least one such person). One who is not on that side settles it (false); true needs every role known and the board complete.
function roleDirection({ ownerId, puzzle, params }) {
  return (pm) => {
    if (!params.roleId || !params.direction) return undefined;
    const a = posOfCharacter(pm, ownerId);
    if (!a) return undefined;
    let found = 0;
    let undecided = false;
    for (const c of puzzle.characters) {
      if (c.id === ownerId) continue;
      const role = roleOfCharacter(puzzle, c.id);
      if (role === undefined) {
        undecided = true;
        continue;
      }
      if (role !== params.roleId) continue;
      const pos = posOfCharacter(pm, c.id);
      if (!pos) {
        undecided = true;
        continue;
      }
      if (!sameFloor(puzzle.grid, a, pos) || !isDirection(params.direction, a, pos)) return false; // only inside one floor
      found++;
    }
    if (undecided) return undefined;
    return found > 0;
  };
}

// «Una persona con il ruolo X è su un oggetto di quel tipo» (quantifier "some") / «Tutte le persone con il ruolo X sono su …»
// ("all", e ce n'è almeno una). Una persona già sull'oggetto basta a dire vero per "some"; una fuori dice falso per "all".
function roleOnObjectType({ puzzle, params }) {
  return (pm) => {
    if (!params.roleId || !params.objectTypeId) return undefined;
    const all = params.quantifier === "all";
    let found = 0;
    let undecided = false;
    for (const c of puzzle.characters) {
      const role = roleOfCharacter(puzzle, c.id);
      if (role === undefined) {
        undecided = true;
        continue;
      }
      if (role !== params.roleId) continue;
      const on = characterHasProperty(puzzle, pm, c.id, { property: "sittingOn", objectTypeId: params.objectTypeId });
      if (on === undefined) {
        undecided = true;
        continue;
      }
      if (on) {
        if (!all) return true;
        found++;
      } else if (all) {
        return false;
      }
    }
    if (undecided) return undefined;
    return all ? found > 0 : false;
  };
}

export const builders = { hasRole, roleAllInRoom, roleDirection, roleOnObjectType };
