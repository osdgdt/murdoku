import { withDeclaredRoles } from "./roles.js";
import { withDeclaredNames } from "./placeNames.js";

// The case seen with the author's own solution behind every hidden thing (roles, names of places), for the code that
// evaluates clues against the declared solution: the editor's suggestions, the checks, the generator.
export const withDeclared = (puzzle) => withDeclaredNames(withDeclaredRoles(puzzle));
