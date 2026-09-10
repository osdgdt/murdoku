import { createPuzzle, addCharacter, addClue, removeCharacter, setSolutionPlacement, validatePuzzleShape, duplicatePuzzle, pruneDanglingClueReferences, pruneDanglingSolutionPlacements, genericClues, cluesForCharacter, difficultyLabel, estimateDifficultyFromNodes } from "../src/model/puzzle.js";
import { addZone, removeZone, removeObject, resizeGrid, setBlocked, isUsable, isOccupiable, paintCellZone, placeObject } from "../src/model/grid.js";
import { objectTypeTargetId } from "../src/model/icons.js";
import * as store from "../src/storage/puzzleStore.js";
import { assert, assertEqual } from "./assert.js";

function buildValidPuzzle() {
  const puzzle = createPuzzle("Test");
  puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
  const a = addCharacter(puzzle, "Anna", "person1", true);
  const b = addCharacter(puzzle, "Bruno", "person2", false);
  setSolutionPlacement(puzzle, a.id, 0, 0);
  setSolutionPlacement(puzzle, b.id, 1, 1);
  return puzzle;
}

export const tests = [
  {
    name: "un puzzle valido passa la validazione di forma",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(valid, "atteso valido: " + errors.join(", "));
    },
  },
  {
    name: "due vittime vengono rifiutate",
    fn: () => {
      const puzzle = buildValidPuzzle();
      puzzle.characters[1].isVictim = true;
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("vittima")), "errore atteso sulla vittima");
    },
  },
  {
    name: "id personaggio duplicato viene rifiutato",
    fn: () => {
      const puzzle = buildValidPuzzle();
      puzzle.characters.push({ ...puzzle.characters[0] });
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("duplicato")), "errore atteso su id duplicato");
    },
  },
  {
    name: "una griglia fuori dai limiti 3-9 viene rifiutata",
    fn: () => {
      const puzzle = buildValidPuzzle();
      puzzle.grid = resizeGrid(puzzle.grid, 12, 12);
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("dimensioni della griglia")), "errore atteso sulle dimensioni della griglia");
    },
  },
  {
    name: "più personaggi delle righe/colonne disponibili vengono rifiutati (nessuna soluzione può esistere)",
    fn: () => {
      const puzzle = buildValidPuzzle(); // griglia 3x3
      addCharacter(puzzle, "Carla", "person1");
      addCharacter(puzzle, "Dario", "person2"); // 4 personaggi, griglia 3x3
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("Troppi personaggi")), "errore atteso sul numero di personaggi");
    },
  },
  {
    name: "piazzamento fuori dai limiti della griglia viene rifiutato",
    fn: () => {
      const puzzle = buildValidPuzzle();
      puzzle.solution.placements[0].row = 99;
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("fuori griglia")), "errore atteso su fuori griglia");
    },
  },
  {
    name: "addZone aggiunge una zona alla griglia",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      assertEqual(puzzle.grid.zones.length, 1);
      assertEqual(zone.name, "Cucina");
    },
  },
  {
    name: "setBlocked marca la cella come non utilizzabile e la ripulisce",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      paintCellZone(puzzle.grid, 2, 2, zone.id);
      placeObject(puzzle.grid, "chair", 2, 2);
      setBlocked(puzzle.grid, 2, 2, true);
      assert(!isUsable(puzzle.grid, 2, 2), "la cella bloccata non deve essere utilizzabile");
      assertEqual(puzzle.grid.cells[2][2].zoneId, null, "il blocco deve rimuovere la zona");
      assertEqual(puzzle.grid.cells[2][2].objectId, null, "il blocco deve rimuovere l'oggetto");
    },
  },
  {
    name: "una cella bloccata rifiuta pittura di zone e piazzamento oggetti",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      setBlocked(puzzle.grid, 0, 2, true);
      paintCellZone(puzzle.grid, 0, 2, zone.id);
      const obj = placeObject(puzzle.grid, "chair", 0, 2);
      assertEqual(puzzle.grid.cells[0][2].zoneId, null, "non deve accettare la zona");
      assertEqual(obj, null, "non deve accettare l'oggetto");
    },
  },
  {
    name: "un piazzamento su una cella bloccata viene rifiutato dalla validazione",
    fn: () => {
      const puzzle = buildValidPuzzle();
      setBlocked(puzzle.grid, 1, 1, true);
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("bloccata")), "errore atteso su cella bloccata");
    },
  },
  {
    name: "un piazzamento su una cella con un oggetto viene rifiutato dalla validazione",
    fn: () => {
      const puzzle = buildValidPuzzle();
      placeObject(puzzle.grid, "shelf", 1, 1);
      const { valid, errors } = validatePuzzleShape(puzzle);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("oggetto")), "errore atteso su cella con oggetto");
    },
  },
  {
    name: "removeCharacter ripulisce anche gli indizi 'between' che lo referenziano come targetA/targetB",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const [anna, bruno] = puzzle.characters;
      const terzo = addCharacter(puzzle, "Carlo", "person1", false);
      addClue(puzzle, anna.id, "between", { targetAId: bruno.id, targetBId: terzo.id });
      removeCharacter(puzzle, bruno.id);
      assertEqual(puzzle.clues.length, 0, "l'indizio 'between' agganciato a Bruno deve sparire");
    },
  },
  {
    name: "createPuzzle inizializza briefing e resolutionNote come stringhe vuote",
    fn: () => {
      const puzzle = createPuzzle("Test dossier");
      assertEqual(puzzle.briefing, "");
      assertEqual(puzzle.resolutionNote, "");
    },
  },
  {
    name: "addCharacter inizializza bio come stringa vuota",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const character = addCharacter(puzzle, "Carlo", "person1", false);
      assertEqual(character.bio, "");
    },
  },
  {
    name: "addCharacter inizializza gender come non specificato (null)",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const character = addCharacter(puzzle, "Carlo", "person1", false);
      assertEqual(character.gender, null);
    },
  },
  {
    name: "duplicatePuzzle produce un nuovo id, azzera i timestamp, e clona in modo indipendente",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const copy = duplicatePuzzle(puzzle);
      assert(copy.id !== puzzle.id, "il duplicato deve avere un id diverso");
      assertEqual(copy.title, `${puzzle.title} (copia)`);
      copy.characters[0].name = "Modificato";
      assertEqual(puzzle.characters[0].name, "Anna", "modificare la copia non deve toccare l'originale");
    },
  },
  {
    name: "pruneDanglingClueReferences rimuove un indizio che referenzia una zona cancellata",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const [anna] = puzzle.characters;
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      addClue(puzzle, anna.id, "inRoom", { zoneId: zone.id });
      removeZone(puzzle.grid, zone.id);
      pruneDanglingClueReferences(puzzle);
      assertEqual(puzzle.clues.length, 0, "l'indizio agganciato alla zona cancellata deve sparire");
    },
  },
  {
    name: "pruneDanglingClueReferences rimuove un indizio che referenzia un oggetto cancellato",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const [anna] = puzzle.characters;
      const obj = placeObject(puzzle.grid, "door", 2, 2);
      addClue(puzzle, anna.id, "adjacent", { targetId: obj.id });
      removeObject(puzzle.grid, obj.id);
      pruneDanglingClueReferences(puzzle);
      assertEqual(puzzle.clues.length, 0, "l'indizio agganciato all'oggetto cancellato deve sparire");
    },
  },
  {
    name: "pruneDanglingClueReferences non tocca gli indizi con bersaglio generico objtype: anche senza istanze",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const [anna] = puzzle.characters;
      addClue(puzzle, anna.id, "adjacent", { targetId: objectTypeTargetId("door") });
      pruneDanglingClueReferences(puzzle);
      assertEqual(puzzle.clues.length, 1, "un riferimento generico non è mai 'pendente', anche a zero istanze");
    },
  },
  {
    name: "pruneDanglingSolutionPlacements rimuove un piazzamento finito fuori griglia dopo un restringimento",
    fn: () => {
      const puzzle = createPuzzle("Test");
      puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
      const a = addCharacter(puzzle, "Anna", "person1", true);
      const b = addCharacter(puzzle, "Bruno", "person2", false);
      setSolutionPlacement(puzzle, a.id, 0, 0);
      setSolutionPlacement(puzzle, b.id, 1, 3);
      puzzle.grid = resizeGrid(puzzle.grid, 4, 3);
      pruneDanglingSolutionPlacements(puzzle);
      assertEqual(puzzle.solution.placements.length, 1, "il piazzamento di Bruno deve sparire");
      assertEqual(puzzle.solution.placements[0].characterId, a.id);
    },
  },
  {
    name: "genericClues() restituisce solo gli indizi senza personaggio proprietario",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const [anna] = puzzle.characters;
      addClue(puzzle, anna.id, "adjacent", { targetId: anna.id });
      addClue(puzzle, null, "noOneInRoom", { zoneId: "irrilevante" });
      assertEqual(genericClues(puzzle).length, 1);
      assertEqual(cluesForCharacter(puzzle, anna.id).length, 1);
    },
  },
  {
    name: "removeCharacter ripulisce anche un indizio generico che lo referenzia come targetA/targetB",
    fn: () => {
      const puzzle = buildValidPuzzle();
      const [anna, bruno] = puzzle.characters;
      addClue(puzzle, null, "sameRoomTogether", { targetAId: anna.id, targetBId: bruno.id });
      removeCharacter(puzzle, bruno.id);
      assertEqual(puzzle.clues.length, 0, "l'indizio generico agganciato a Bruno deve sparire anche se non ha proprietario");
    },
  },
  {
    name: "createPuzzle inizializza difficulty e completed",
    fn: () => {
      const puzzle = createPuzzle("Test difficoltà");
      assertEqual(puzzle.difficulty, "");
      assertEqual(puzzle.completed, false);
      assertEqual(puzzle.bestTimeSeconds, null);
    },
  },
  {
    name: "estimateDifficultyFromNodes mappa il conteggio dei nodi in una fascia di difficoltà crescente",
    fn: () => {
      assertEqual(estimateDifficultyFromNodes(5), "very-easy");
      assertEqual(estimateDifficultyFromNodes(29), "very-easy");
      assertEqual(estimateDifficultyFromNodes(30), "easy");
      assertEqual(estimateDifficultyFromNodes(149), "easy");
      assertEqual(estimateDifficultyFromNodes(150), "medium");
      assertEqual(estimateDifficultyFromNodes(799), "medium");
      assertEqual(estimateDifficultyFromNodes(800), "hard");
      assertEqual(estimateDifficultyFromNodes(3999), "hard");
      assertEqual(estimateDifficultyFromNodes(4000), "expert");
      assertEqual(estimateDifficultyFromNodes(1000000), "expert");
    },
  },
  {
    name: "difficultyLabel traduce il valore in un'etichetta leggibile, con una ricaduta sicura per valori sconosciuti",
    fn: () => {
      assertEqual(difficultyLabel("easy"), "Facile");
      assertEqual(difficultyLabel("expert"), "Esperto");
      assertEqual(difficultyLabel(""), "Non specificata");
      assertEqual(difficultyLabel("qualcosa-che-non-esiste"), "Non specificata");
    },
  },
  {
    name: "puzzleStore.save() include difficulty e completed nella voce d'indice",
    fn: () => {
      const puzzle = buildValidPuzzle();
      puzzle.difficulty = "medium";
      puzzle.completed = true;
      store.save(puzzle);
      try {
        const entry = store.list().find((p) => p.id === puzzle.id);
        assert(entry, "la voce deve comparire nell'indice");
        assertEqual(entry.difficulty, "medium");
        assertEqual(entry.completed, true);
      } finally {
        store.remove(puzzle.id);
      }
    },
  },
  {
    name: "puzzleStore.save() include bestTimeSeconds nella voce d'indice, null se mai risolto",
    fn: () => {
      const puzzle = buildValidPuzzle();
      store.save(puzzle);
      try {
        let entry = store.list().find((p) => p.id === puzzle.id);
        assertEqual(entry.bestTimeSeconds, null, "un puzzle mai risolto non ha un miglior tempo");
        puzzle.bestTimeSeconds = 42;
        store.save(puzzle);
        entry = store.list().find((p) => p.id === puzzle.id);
        assertEqual(entry.bestTimeSeconds, 42);
      } finally {
        store.remove(puzzle.id);
      }
    },
  },
  {
    name: "isOccupiable è falso su una cella con un oggetto, vero altrove",
    fn: () => {
      const puzzle = buildValidPuzzle();
      placeObject(puzzle.grid, "shelf", 2, 2);
      assert(!isOccupiable(puzzle.grid, 2, 2), "una cella con un oggetto non è occupabile");
      assert(isOccupiable(puzzle.grid, 2, 0), "una cella libera resta occupabile");
      setBlocked(puzzle.grid, 2, 0, true);
      assert(!isOccupiable(puzzle.grid, 2, 0), "una cella bloccata non è occupabile");
    },
  },
  {
    name: "isOccupiable è vero su sedie e tappeti, falso sugli altri oggetti",
    fn: () => {
      const puzzle = buildValidPuzzle();
      placeObject(puzzle.grid, "chair", 1, 0);
      placeObject(puzzle.grid, "carpet", 1, 1);
      placeObject(puzzle.grid, "table", 1, 2);
      placeObject(puzzle.grid, "door", 2, 0);
      placeObject(puzzle.grid, "window", 2, 1);
      placeObject(puzzle.grid, "lamp", 2, 2);
      assert(isOccupiable(puzzle.grid, 1, 0), "una sedia si può occupare");
      assert(isOccupiable(puzzle.grid, 1, 1), "un tappeto si può occupare");
      assert(!isOccupiable(puzzle.grid, 1, 2), "un tavolo non si può occupare");
      assert(!isOccupiable(puzzle.grid, 2, 0), "una porta non si può occupare");
      assert(!isOccupiable(puzzle.grid, 2, 1), "una finestra non si può occupare");
      assert(!isOccupiable(puzzle.grid, 2, 2), "una lampada non si può occupare");
    },
  },
];
