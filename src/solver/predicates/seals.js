import { sealedCells } from "../../model/grid.js";
import { posOfCharacter, zoneAt } from "./helpers.js";

// Base rule of the maps with seals, always on like the victim rule (see predicates/index.js): whoever stands on
// a cell with the seal of Anubis must be alone in their room; whoever stands on a seal of Ra must NOT be alone.
// "Alone" counts the people in the same room (a cell outside every room is a room of its own: nobody else shares it).
// Like every predicate it answers true | false | undefined (not decidable yet) and never prunes a state that can
// still be completed: people only accumulate in a room as the others are placed, so "somebody else is here" is
// final for Anubis the moment it happens, while "nobody else is here" (Ra) can only be judged on a complete board.
export function sealRulePredicate(puzzle) {
  const seals = sealedCells(puzzle.grid);
  if (seals.length === 0) return () => true;
  return (pm, isComplete) => {
    let undecided = false;
    for (const seal of seals) {
      const occupant = puzzle.characters.find((c) => {
        const pos = posOfCharacter(pm, c.id);
        return pos && pos.row === seal.row && pos.col === seal.col;
      });
      if (!occupant) {
        if (isComplete) continue; // nobody on it: the seal asks nothing
        undecided = true;
        continue;
      }
      const zone = zoneAt(puzzle, seal);
      let others = 0;
      if (zone !== null) {
        for (const c of puzzle.characters) {
          if (c.id === occupant.id) continue;
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === zone) others++;
        }
      }
      if (seal.seal === "anubis") {
        if (others > 0) return false;
        if (!isComplete) undecided = true;
      } else {
        if (!isComplete) {
          undecided = true;
          continue;
        }
        if (others === 0) return false;
      }
    }
    return undecided ? undefined : true;
  };
}
