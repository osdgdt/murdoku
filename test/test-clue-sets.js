import { createPuzzle, addCharacter, addClue, removeCharacter, pruneDanglingClueReferences } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid, removeZone } from "../src/model/grid.js";
import { describeClue } from "../src/model/clueTypes.js";
import { collectClueRefs } from "../src/model/clueRefs.js";
import { exportClueSet, parseClueSet, planImport, applyImport, importReasonText } from "../src/editor/clueSets.js";
import { assert, assertEqual } from "./assert.js";

// A case with a cast, a kitchen and a chair, and clues of the awkward kinds (nested, lists, generic).
function sourceCase() {
  const puzzle = createPuzzle("Origine");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const kitchen = addZone(puzzle.grid, "Cucina", "#fdd");
  paintCellZone(puzzle.grid, 0, 0, kitchen.id);
  paintCellZone(puzzle.grid, 0, 1, kitchen.id);
  const chair = placeObject(puzzle.grid, "chair", 1, 1);
  const anna = addCharacter(puzzle, "Anna");
  const bruno = addCharacter(puzzle, "Bruno");
  const carla = addCharacter(puzzle, "Carla", undefined, true);
  addClue(puzzle, anna.id, "adjacent", { targetId: bruno.id });
  addClue(puzzle, anna.id, "inRoom", { zoneId: kitchen.id });
  addClue(puzzle, bruno.id, "orClue", {
    a: { type: "adjacent", params: { targetId: chair.id } },
    b: { type: "sameRoomAs", params: { targetId: carla.id } },
  });
  addClue(puzzle, carla.id, "inRowOrColWithAny", { axis: "row", targetIds: [anna.id, "objtype:chair"] });
  addClue(puzzle, null, "noOneInRoom", { zoneId: kitchen.id });
  const nested = addClue(puzzle, anna.id, "someoneInRoomWithProperty", {
    property: "custom",
    customClue: { type: "adjacent", params: { targetId: bruno.id } },
  });
  nested.negate = true;
  addClue(puzzle, bruno.id, "inRowOrCol", { axis: "row", index: 4 });
  return puzzle;
}

// The same story in another case: same names (written differently), other ids, a bigger map.
function targetCase({ without = [], exact = false } = {}) {
  const puzzle = createPuzzle("Destinazione");
  puzzle.grid = resizeGrid(puzzle.grid, 5, 5);
  const kitchen = addZone(puzzle.grid, exact ? "Cucina" : " cucina ", "#dfd");
  paintCellZone(puzzle.grid, 0, 0, kitchen.id);
  placeObject(puzzle.grid, "chair", 1, 1);
  for (const name of exact ? ["Anna", "Bruno", "Carla", "Dina"] : ["ANNA", "bruno", "Carla", "Dina"])
    if (!without.includes(name)) addCharacter(puzzle, name, undefined, name === "Dina");
  return puzzle;
}

const roundTrip = (set) => parseClueSet(JSON.parse(JSON.stringify(set)));

export const tests = [
  {
    name: "set di indizi: esportare e importare in un altro caso con gli stessi nomi dà gli stessi indizi, parola per parola",
    fn: () => {
      const source = sourceCase();
      const parsed = roundTrip(exportClueSet(source));
      assert(parsed.ok, "il file deve essere valido");
      const target = targetCase();
      const result = applyImport(target, parsed.set, planImport(target, parsed.set));
      assertEqual(result.skipped.length, 0, JSON.stringify(result.skipped));
      assertEqual(result.added.length, source.clues.length, "ogni indizio è stato aggiunto");
    },
  },
  {
    name: "set di indizi: gli indizi importati dicono le stesse frasi di quelli esportati",
    fn: () => {
      const source = sourceCase();
      const parsed = roundTrip(exportClueSet(source));
      const target = targetCase({ exact: true });
      // the destination has the same people and kitchen, only other ids: everything must map
      const sourceTexts = source.clues.filter((c) => c.type !== "inRowOrCol").map((c) => describeClue(c, source));
      const result = applyImport(target, parsed.set, planImport(target, parsed.set));
      const targetTexts = result.added.filter((c) => c.type !== "inRowOrCol").map((c) => describeClue(c, target));
      assertEqual(targetTexts.join("|"), sourceTexts.map((t) => t).join("|"), JSON.stringify(result.skipped));
    },
  },
  {
    name: "set di indizi: un indizio che cita qualcuno che nel caso di arrivo non c'è viene scartato per intero, con il motivo",
    fn: () => {
      const parsed = roundTrip(exportClueSet(sourceCase()));
      const target = targetCase({ without: ["Carla"] });
      const before = target.clues.length;
      const result = applyImport(target, parsed.set, planImport(target, parsed.set));
      assert(
        result.skipped.some((s) => s.reason === "unmapped"),
        "ci devono essere indizi non collegati"
      );
      assertEqual(target.clues.length, before + result.added.length, "niente indizi a metà");
      for (const c of target.clues) assertEqual(collectClueRefs(c.params).filter((id) => !id).length, 0, "nessun id vuoto");
      assert(importReasonText("unmapped").length > 0);
    },
  },
  {
    name: "set di indizi: l'autore può correggere l'abbinamento (Carla → Dina)",
    fn: () => {
      const parsed = roundTrip(exportClueSet(sourceCase()));
      const target = targetCase({ without: ["Carla"] });
      const plan = planImport(target, parsed.set);
      assertEqual(plan.characters.Carla, null, "non abbinata da sola");
      plan.characters.Carla = target.characters.find((c) => c.name === "Dina").id;
      const result = applyImport(target, parsed.set, plan);
      assert(
        result.added.some((c) => c.type === "inRowOrColWithAny"),
        "ora l'indizio di Carla entra"
      );
      assert(result.added.every((c) => !(c.characterId === null && c.type !== "noOneInRoom")));
    },
  },
  {
    name: "set di indizi: una riga o colonna fuori dalla griglia e i doppioni sono scartati con il loro motivo",
    fn: () => {
      const parsed = roundTrip(exportClueSet(sourceCase()));
      const small = createPuzzle("Piccolo");
      small.grid = resizeGrid(small.grid, 3, 3);
      for (const name of ["Anna", "Bruno", "Carla"]) addCharacter(small, name, undefined, name === "Carla");
      const kitchen = addZone(small.grid, "Cucina", "#fdd");
      paintCellZone(small.grid, 0, 0, kitchen.id);
      placeObject(small.grid, "chair", 1, 1);
      const first = applyImport(small, parsed.set, planImport(small, parsed.set));
      assert(
        first.skipped.some((s) => s.type === "inRowOrCol" && s.reason === "outOfGrid"),
        "la riga 4 non esiste in una griglia 3x3"
      );
      const second = applyImport(small, parsed.set, planImport(small, parsed.set));
      assertEqual(second.added.length, 0, "la seconda volta sono tutti doppioni");
      assert(second.skipped.every((s) => s.reason === "duplicate" || s.reason === "unmapped" || s.reason === "outOfGrid"));
    },
  },
  {
    name: "set di indizi: un file che non è un set, di un'altra versione o vuoto viene rifiutato",
    fn: () => {
      assertEqual(parseClueSet(null).ok, false);
      assertEqual(parseClueSet({ format: "altro" }).error, "not-a-clue-set");
      assertEqual(parseClueSet({ format: "murdoku-clues", version: 9, clues: [{}] }).error, "unsupported-version");
      assertEqual(parseClueSet({ format: "murdoku-clues", version: 1, clues: [] }).error, "empty");
      assertEqual(parseClueSet({ format: "murdoku-clues", version: 1, clues: [{ type: 3, params: {} }] }).error, "bad-clue");
      assertEqual(exportClueSet(sourceCase(), []).clues.length, 0, "esportare nessun indizio dà un set vuoto");
    },
  },
  {
    name: "set di indizi: si possono esportare solo alcuni indizi",
    fn: () => {
      const source = sourceCase();
      const set = exportClueSet(source, [source.clues[0].id, source.clues[2].id]);
      assertEqual(set.clues.length, 2);
      assert(
        set.characters.some((c) => c.name === "Carla"),
        "chi è citato nei parametri finisce nell'elenco"
      );
    },
  },
  {
    name: "riferimenti degli indizi: togliere un personaggio o una stanza ripulisce anche gli indizi annidati e le liste di bersagli",
    fn: () => {
      const puzzle = sourceCase();
      const bruno = puzzle.characters.find((c) => c.name === "Bruno");
      const carla = puzzle.characters.find((c) => c.name === "Carla");
      removeCharacter(puzzle, carla.id);
      assert(!puzzle.clues.some((c) => c.type === "orClue"), "l'«o l'uno o l'altro» che citava Carla in un ramo sparisce");
      assert(!puzzle.clues.some((c) => c.type === "inRowOrColWithAny"), "gli indizi di Carla sparirono con lei");
      removeCharacter(puzzle, bruno.id);
      assert(!puzzle.clues.some((c) => c.type === "someoneInRoomWithProperty"), "l'indizio con la condizione annidata su Bruno sparisce");
      const another = sourceCase();
      const anna = another.characters.find((c) => c.name === "Anna");
      removeCharacter(another, anna.id);
      const list = another.clues.find((c) => c.type === "inRowOrColWithAny");
      assertEqual(list.params.targetIds.join(), "objtype:chair", "dalla lista esce solo Anna, resta «qualsiasi sedia»");
    },
  },
  {
    name: "riferimenti degli indizi: una stanza tolta fa sparire gli indizi che la citano, anche annidati",
    fn: () => {
      const puzzle = sourceCase();
      const room = puzzle.grid.zones[0];
      addClue(puzzle, puzzle.characters[0].id, "orClue", {
        a: { type: "inRoom", params: { zoneId: room.id } },
        b: { type: "inRoom", params: { zoneId: room.id } },
      });
      removeZone(puzzle.grid, room.id);
      pruneDanglingClueReferences(puzzle);
      assert(
        !puzzle.clues.some(
          (c) => c.type === "inRoom" || c.type === "noOneInRoom" || (c.type === "orClue" && JSON.stringify(c.params).includes(room.id))
        )
      );
    },
  },
];
