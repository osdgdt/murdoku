// Luoghi da identificare (Pirati: isole «???»): il dato sulla stanza, il nome che non si vede, l'indizio «è nel luogo
// chiamato X», la ricerca che prova le assegnazioni dei nomi, la validazione.
import { createPuzzle, addCharacter, addClue, validatePuzzleShape } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { describeClue, CLUE_TYPES } from "../src/model/clueTypes.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { enumerateParams } from "../src/solver/suggestions.js";
import { resolveClueHoverCells } from "../src/solver/hoverTargets.js";
import { typeIdsFor, convertParams } from "../src/editor/clueDraft.js";
import { zoneTitle } from "../src/model/terrain.js";
import { targetLabel } from "../src/model/clues/shared.js";
import { withDeclared } from "../src/model/declared.js";
import {
  setZoneNameHidden,
  isNameHidden,
  hasHiddenNames,
  placeNameLabels,
  placeNameOf,
  withNames,
  zoneDisplayName,
  placeNameProblems,
  MAX_HIDDEN_NAMES,
} from "../src/model/placeNames.js";
import { nameAssignments } from "../src/solver/names.js";
import { assert, assertEqual } from "./assert.js";

// 4×4: la stanza Nord (righe 0-1, «Cocco») e la stanza Sud (righe 2-3, «Deserta»), entrambe con il nome nascosto.
function scene({ hidden = true } = {}) {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const north = addZone(puzzle.grid, "Cocco", "#cfe");
  const south = addZone(puzzle.grid, "Deserta", "#fec");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, (r < 2 ? north : south).id);
  if (hidden) {
    setZoneNameHidden(puzzle.grid, north.id, true);
    setZoneNameHidden(puzzle.grid, south.id, true);
  }
  const people = [addCharacter(puzzle, "V", "person1", true), addCharacter(puzzle, "A", "person2"), addCharacter(puzzle, "B", "person3")];
  return { puzzle, people, north, south };
}
const at = (entries) => new Map(entries.map(([c, row, col]) => [c.id, { row, col }]));
const room = (r) => (r < 2 ? "N" : "S");

// Tutte le soluzioni (insiemi di posizioni) per forza bruta: la vittima ha esattamente un compagno di stanza e `allowed`
// dice se i tre (V, A, B) vanno bene.
function bruteForce(allowed) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push([r, c]);
  let count = 0;
  for (const v of cells)
    for (const a of cells)
      for (const b of cells) {
        const chosen = [v, a, b];
        if (new Set(chosen.map(([r]) => r)).size < 3 || new Set(chosen.map(([, c]) => c)).size < 3) continue;
        const zone = chosen.map(([r]) => room(r));
        if (zone.filter((z, i) => i > 0 && z === zone[0]).length !== 1) continue;
        if (allowed(zone[1], zone[2])) count++;
      }
  return count;
}

export const tests = [
  {
    name: "luoghi: il nome di una stanza si nasconde e si mostra; il nome vero resta; la board scrive «???»",
    fn: () => {
      const { puzzle, north, south } = scene({ hidden: false });
      assert(!hasHiddenNames(puzzle) && !isNameHidden(north));
      assert(setZoneNameHidden(puzzle.grid, north.id, true) && isNameHidden(north) && hasHiddenNames(puzzle));
      assertEqual(north.name, "Cocco", "il nome vero resta");
      assertEqual(zoneDisplayName(north), "???");
      assertEqual(zoneDisplayName(south), "Deserta");
      assertEqual(zoneTitle(north), "???", "la board non svela il nome");
      assertEqual(targetLabel(puzzle, north.id), '"???"', "nemmeno gli indizi");
      assertEqual(placeNameLabels(puzzle.grid).join(), "Cocco");
      assert(setZoneNameHidden(puzzle.grid, north.id, false) && !("nameHidden" in north), "togliere il campo");
      assert(!setZoneNameHidden(puzzle.grid, "non-esiste", true));
    },
  },
  {
    name: "luoghi: il nome di una stanza nascosta si conosce solo se l'assegnazione lo dice; quello visibile sempre",
    fn: () => {
      const { puzzle, north, south } = scene();
      assertEqual(placeNameOf(puzzle, north), undefined, "ignoto");
      const swapped = withNames(
        puzzle,
        new Map([
          [north.id, "Deserta"],
          [south.id, "Cocco"],
        ])
      );
      assertEqual(placeNameOf(swapped, north), "Deserta");
      assertEqual(placeNameOf(withDeclared(puzzle), north), "Cocco", "quello dell'autore");
      setZoneNameHidden(puzzle.grid, south.id, false);
      assertEqual(placeNameOf(puzzle, south), "Deserta", "visibile: il suo");
    },
  },
  {
    name: "luoghi: «è nel luogo chiamato» — testo, negazione, tempo, ignoto finché il nome non è assegnato",
    fn: () => {
      const { puzzle, people, north, south } = scene();
      const a = people[1];
      const clue = addClue(puzzle, a.id, "inPlaceNamed", { placeName: "Cocco" });
      assertEqual(describeClue(clue, puzzle), "È nel luogo chiamato «Cocco».");
      const check = (p, row, col) => buildPredicate(clue, p)(at([[a, row, col]]), false);
      assertEqual(check(puzzle, 0, 0), undefined, "senza assegnazione non si sa");
      assertEqual(buildPredicate(clue, puzzle)(new Map(), false), undefined, "senza posizione non si sa");
      assertEqual(check(withDeclared(puzzle), 0, 0), true);
      assertEqual(check(withDeclared(puzzle), 3, 0), false);
      const swapped = withNames(
        puzzle,
        new Map([
          [north.id, "Deserta"],
          [south.id, "Cocco"],
        ])
      );
      assertEqual(check(swapped, 0, 0), false);
      assertEqual(check(swapped, 3, 0), true);
      clue.negate = true;
      assertEqual(describeClue(clue, puzzle), "Non è nel luogo chiamato «Cocco».");
      assertEqual(check(swapped, 0, 0), true);
      clue.negate = false;
      puzzle.tense = "past";
      assertEqual(describeClue(clue, puzzle), "Era nel luogo chiamato «Cocco».");
      assert(CLUE_TYPES.inPlaceNamed);
    },
  },
  {
    name: "luoghi: l'assegnazione dei nomi prova tutte le permutazioni, ciascun nome una volta",
    fn: () => {
      const { puzzle } = scene();
      const all = [...nameAssignments(puzzle)].map((m) => [...m.values()].join("+"));
      assertEqual(all.sort().join(" | "), "Cocco+Deserta | Deserta+Cocco");
      const three = scene().puzzle;
      const extra = addZone(three.grid, "Pietà", "#eee");
      paintCellZone(three.grid, 3, 3, extra.id);
      setZoneNameHidden(three.grid, extra.id, true);
      assertEqual([...nameAssignments(three)].length, 6, "3! permutazioni");
    },
  },
  {
    name: "luoghi: il solver conta le soluzioni sulle POSIZIONI (le stesse posizioni con nomi diversi sono una soluzione)",
    fn: () => {
      const { puzzle, people, north } = scene();
      const [, a, b] = people;
      addClue(puzzle, a.id, "inPlaceNamed", { placeName: "Cocco" });
      addClue(puzzle, b.id, "inPlaceNamed", { placeName: "Deserta" });
      // A e B in stanze diverse (in uno dei due modi di assegnare i nomi): è l'unione delle due assegnazioni.
      const report = checkUniqueness(puzzle, { maxSolutions: 100000 });
      assert(report.exhausted);
      assertEqual(
        report.solutionCount,
        bruteForce((za, zb) => za !== zb),
        "A e B in stanze diverse"
      );
      // «A è nella stanza Nord» fissa quale nome è di chi: Cocco = Nord, quindi B sta a sud.
      addClue(puzzle, a.id, "inRoom", { zoneId: north.id });
      const fixed = checkUniqueness(puzzle, { maxSolutions: 100000 });
      assertEqual(
        fixed.solutionCount,
        bruteForce((za, zb) => za === "N" && zb === "S"),
        "A a nord, B a sud"
      );
    },
  },
  {
    name: "luoghi: senza stanze nascoste un caso si cerca come prima (nessuna assegnazione)",
    fn: () => {
      const { puzzle } = scene({ hidden: false });
      const report = checkUniqueness(puzzle, { maxSolutions: 100000 });
      assert(report.exhausted);
      assertEqual(
        report.solutionCount,
        bruteForce(() => true)
      );
    },
  },
  {
    name: "luoghi: l'editor offre il nuovo indizio solo se ci sono luoghi da identificare, con i loro nomi",
    fn: () => {
      const { puzzle, people } = scene({ hidden: false });
      assert(!typeIdsFor(people[1].id, puzzle).includes("inPlaceNamed"));
      const hiddenCase = scene().puzzle;
      assert(typeIdsFor(hiddenCase.characters[1].id, hiddenCase).includes("inPlaceNamed"));
      const def = CLUE_TYPES.inPlaceNamed;
      assertEqual(
        enumerateParams(def, hiddenCase, hiddenCase.characters[1].id)
          .map((p) => p.placeName)
          .join(),
        "Cocco,Deserta"
      );
      assertEqual(convertParams("inPlaceNamed", { placeName: "Deserta" }, "inPlaceNamed", hiddenCase).placeName, "Deserta");
      assertEqual(
        convertParams("inPlaceNamed", { placeName: "Nave" }, "inPlaceNamed", hiddenCase).placeName,
        "Cocco",
        "nome sconosciuto: il primo"
      );
    },
  },
  {
    name: "luoghi: i suggerimenti non nominano una stanza «???»; passando il mouse sull'indizio non si svela dov'è",
    fn: () => {
      const { puzzle, people } = scene();
      const zoneDef = CLUE_TYPES.inRoom;
      assertEqual(enumerateParams(zoneDef, puzzle, people[1].id).length, 0, "nessuna stanza con un nome");
      const clue = { type: "inPlaceNamed", characterId: people[1].id, params: { placeName: "Cocco" } };
      assertEqual(resolveClueHoverCells(clue, puzzle, new Map()).length, 0);
    },
  },
  {
    name: "luoghi: validazione — nomi diversi da ogni altra stanza, non troppi, indizi su nomi che esistono",
    fn: () => {
      const { puzzle, south } = scene();
      puzzle.solution = { placements: [] };
      assertEqual(placeNameProblems(puzzle).length, 0);
      assert(!validatePuzzleShape(puzzle).errors.some((e) => /luogo|nome/i.test(e)));
      south.name = "Cocco";
      assert(placeNameProblems(puzzle).length > 0, "stesso nome di un'altra stanza");
      south.name = "Deserta";
      addClue(puzzle, puzzle.characters[1].id, "inPlaceNamed", { placeName: "Atlantide" });
      assert(placeNameProblems(puzzle).length > 0, "un nome che non c'è");
      assert(validatePuzzleShape(puzzle).errors.length > 0);
      puzzle.clues.pop();
      south.nameHidden = "sì";
      assert(validatePuzzleShape(puzzle).errors.length > 0, "il campo è solo true");
      south.nameHidden = true;
      for (let i = 0; i <= MAX_HIDDEN_NAMES; i++) {
        const z = addZone(puzzle.grid, `Isola ${i}`, "#ddd");
        z.nameHidden = true;
      }
      assert(placeNameProblems(puzzle).length > 0, "troppe isole");
    },
  },
];
