import { createPuzzle, addCharacter, addClue, setSolutionPlacement } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid } from "../src/model/grid.js";
import { propagate } from "../src/solver/propagation.js";
import { assert, assertEqual } from "./assert.js";

function basePuzzle(rows = 3, cols = 3) {
  const puzzle = createPuzzle("Test propagation");
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  return puzzle;
}

export const tests = [
  {
    name: "propagate: restringe il dominio di un personaggio fino a un piazzamento forzato con la propria clue",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      const result = propagate(puzzle, new Map());
      assertEqual(result.contradiction, null);
      assertEqual(result.forced.length, 1);
      assertEqual(result.forced[0].characterId, a.id);
      assertEqual(result.forced[0].row, 1);
      assertEqual(result.forced[0].col, 1);
      assert(result.forced[0].witnessClueIds.includes(clue.id));
      assertEqual(result.confirmed.get(a.id).row, 1);
      assertEqual(result.confirmed.get(a.id).col, 1);
    },
  },
  {
    name: "propagate: esclude una cella per un personaggio senza forzarlo, se resta ambiguo",
    fn: () => {
      const puzzle = basePuzzle();
      addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      const clue = addClue(puzzle, b.id, "notInRoom", { zoneId: zone.id });
      const result = propagate(puzzle, new Map());
      assertEqual(result.contradiction, null);
      assertEqual(result.forced.length, 0, "né A né B hanno un dominio ridotto a una sola cella");
      const bElim = result.eliminated.find((e) => e.characterId === b.id && e.row === 1 && e.col === 1);
      assert(bElim, "(1,1) deve risultare esclusa per B");
      assert(bElim.witnessClueIds.includes(clue.id));
    },
  },
  {
    name: "propagate: rileva una contraddizione quando il dominio di un personaggio si svuota",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id }); // A può stare solo in (1,1)...
      // ...ma B occupa già riga 1 e colonna 1, rendendo (1,1) irraggiungibile per A.
      const result = propagate(puzzle, new Map([[b.id, { row: 1, col: 1 }]]));
      assert(result.contradiction, "deve rilevare una contraddizione");
      assertEqual(result.contradiction.characterId, a.id);
    },
  },
  {
    name: "propagate: un personaggio può diventare forzato in un round successivo, una volta che altri hanno ristretto righe/colonne",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneC = addZone(puzzle.grid, "StanzaC", "#eee");
      paintCellZone(puzzle.grid, 2, 2, zoneC.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id }); // A -> (0,0), round 0
      addClue(puzzle, c.id, "inRoom", { zoneId: zoneC.id }); // C -> (2,2), round 0
      // B, da sola, ha solo il vincolo "riga 2" (indice 1, 0-based): 3 celle
      // possibili. Solo dopo che A e C hanno escluso le colonne 0 e 2
      // (round 0), resta un'unica colonna libera per B nella riga 1 ->
      // forzata al round 1.
      addClue(puzzle, b.id, "inRowOrCol", { axis: "row", index: 2 });
      const result = propagate(puzzle, new Map());
      assertEqual(result.contradiction, null);
      const byChar = Object.fromEntries(result.forced.map((f) => [f.characterId, f]));
      assertEqual(byChar[a.id].row, 0);
      assertEqual(byChar[a.id].col, 0);
      assertEqual(byChar[c.id].row, 2);
      assertEqual(byChar[c.id].col, 2);
      assert(byChar[b.id], "B deve risultare forzata solo dopo che A e C hanno ristretto le colonne disponibili");
      assertEqual(byChar[b.id].row, 1);
      assertEqual(byChar[b.id].col, 1);
    },
  },
  {
    name: "propagate: eliminazione da 'coppia nuda' (tecnica A) — due personaggi confinati alle stesse 2 celle escludono un terzo, senza indizio proprio",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const x = addCharacter(puzzle, "X", "person1");
      const y = addCharacter(puzzle, "Y", "person2");
      const z = addCharacter(puzzle, "Z", "person1"); // nessun indizio proprio
      // Una zona non contigua su due celle su righe/colonne diverse: entrambi
      // X e Y possono stare SOLO lì (2 celle, 2 personaggi) -> per il
      // principio delle coppie nude, quelle 2 celle andranno per forza a
      // X e Y, quindi nessun ALTRO personaggio può occuparle — anche se Z
      // non ha alcun indizio che lo escluda direttamente da lì (la sola
      // propagazione a singolo personaggio non potrebbe mai dedurlo).
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, x.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, y.id, "inRoom", { zoneId: zone.id });
      const result = propagate(puzzle, new Map());
      assertEqual(result.contradiction, null);
      const zElimAt = (row, col) => result.eliminated.find((e) => e.characterId === z.id && e.row === row && e.col === col);
      const elim00 = zElimAt(0, 0);
      const elim11 = zElimAt(1, 1);
      assert(elim00, "Z deve risultare esclusa da (0,0)");
      assert(elim11, "Z deve risultare esclusa da (1,1)");
      assert(elim00.nakedSubset, "l'esclusione deve essere attribuita a un sottoinsieme, non a un indizio singolo");
      assertEqual(elim00.witnessClueIds.length, 0);
      const involvedIds = [...elim00.nakedSubset.characterIds].sort();
      assertEqual(involvedIds.join(","), [x.id, y.id].sort().join(","));
    },
  },
  {
    name: "propagate: l'insidia di scorrettezza è gestita correttamente — due personaggi confinati alle stesse 2 celle sulla STESSA riga sono una contraddizione, non una coppia nuda valida",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const x = addCharacter(puzzle, "X", "person1");
      const y = addCharacter(puzzle, "Y", "person2");
      addCharacter(puzzle, "Z", "person1");
      // Stessa idea del test sopra, ma le due celle della zona condivisa
      // sono sulla STESSA riga: X e Y non potranno mai starci entrambi (due
      // personaggi non possono mai condividere una riga), quindi non è
      // un'eliminazione valida da proporre — è una contraddizione vera e
      // propria per l'intero ramo.
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      addClue(puzzle, x.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, y.id, "inRoom", { zoneId: zone.id });
      const result = propagate(puzzle, new Map());
      assert(result.contradiction, "deve rilevare una contraddizione, non proporre eliminazioni");
      const involvedIds = [...result.contradiction.characterIds].sort();
      assertEqual(involvedIds.join(","), [x.id, y.id].sort().join(","));
      assertEqual(result.eliminated.length, 0, "una contraddizione non deve produrre eliminazioni spurie");
    },
  },
  {
    name: "propagate: un'eliminazione da sottoinsieme può forzare un terzo personaggio nello STESSO round (cascata)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const x = addCharacter(puzzle, "X", "person1");
      const y = addCharacter(puzzle, "Y", "person2");
      const w = addCharacter(puzzle, "W", "person1");
      const zoneShared = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneShared.id);
      paintCellZone(puzzle.grid, 1, 1, zoneShared.id);
      addClue(puzzle, x.id, "inRoom", { zoneId: zoneShared.id });
      addClue(puzzle, y.id, "inRoom", { zoneId: zoneShared.id });
      // W ha un indizio proprio che la confina a SOLO 2 celle: una delle due
      // è (0,0), che la coppia nuda {X,Y} sta per "consumare" per intero.
      // Una volta esclusa, a W resta un'unica cella possibile — forzata
      // nello stesso round in cui la coppia nuda viene scoperta, non in uno
      // successivo. Usa due sedie (non una seconda zona: una cella ha una
      // sola zona, ma zone e oggetti sono indipendenti, quindi (0,0) può
      // avere sia la zona condivisa sia una sedia) per confinare W a
      // esattamente queste 2 celle senza toccare la zona di X/Y.
      placeObject(puzzle.grid, "chair", 0, 0);
      placeObject(puzzle.grid, "chair", 2, 2);
      addClue(puzzle, w.id, "onObjectType", { objectTypeId: "chair" });

      const result = propagate(puzzle, new Map());
      assertEqual(result.contradiction, null);
      assertEqual(result.forced.length, 1, "solo W deve risultare forzata in questo round: X e Y restano a 2 celle ciascuno");
      assertEqual(result.forced[0].characterId, w.id);
      assertEqual(result.forced[0].row, 2);
      assertEqual(result.forced[0].col, 2);
      assert(result.forced[0].nakedSubsets.length > 0, "la deduzione di W deve citare la coppia nuda che l'ha resa possibile");
      const involvedIds = [...result.forced[0].nakedSubsets[0].characterIds].sort();
      assertEqual(involvedIds.join(","), [x.id, y.id].sort().join(","));
    },
  },
  {
    name: "propagate: rileva una contraddizione quando due personaggi convergono INDIPENDENTEMENTE sulla stessa unica cella (non la confonde con un piazzamento forzato valido)",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const zone = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zone.id });
      // C occupa già riga 0 (colonna diversa), escludendo (0,0): guardando A
      // e B UNO ALLA VOLTA, ciascuno per conto proprio finisce con l'unica
      // cella (1,1) come sola possibilità — sembrerebbe un piazzamento
      // forzato valido per ENTRAMBI, ma non possono ovviamente starci
      // entrambi. Senza il controllo a sottoinsieme (K=2), la sola
      // propagazione a singolo personaggio confermerebbe erroneamente sia A
      // che B nella stessa cella.
      const result = propagate(puzzle, new Map([[c.id, { row: 0, col: 2 }]]));
      assert(result.contradiction, "deve rilevare una contraddizione, non confermare due personaggi sulla stessa cella");
      const involvedIds = [...result.contradiction.characterIds].sort();
      assertEqual(involvedIds.join(","), [a.id, b.id].sort().join(","));
      assertEqual(result.forced.length, 0, "nessun piazzamento forzato spurio");
    },
  },
  {
    name: "propagate non guarda mai puzzle.solution: resta corretto anche se la risposta salvata è sbagliata o assente",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      setSolutionPlacement(puzzle, a.id, 2, 2); // risposta salvata deliberatamente sbagliata
      const result = propagate(puzzle, new Map());
      assertEqual(result.forced[0].row, 1);
      assertEqual(result.forced[0].col, 1, "la deduzione deve venire dagli indizi, non dalla soluzione salvata (sbagliata)");
    },
  },
  {
    name: "propagate: espone il dominio calcolato per ogni personaggio ancora non piazzato",
    fn: () => {
      const puzzle = basePuzzle();
      addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, b.id, "notInRoom", { zoneId: zone.id });
      const result = propagate(puzzle, new Map());
      const [a] = puzzle.characters;
      assertEqual(result.domains.get(a.id).length, 9, "A non ha alcun indizio: il dominio deve coprire l'intera griglia 3x3");
      const bDomain = result.domains.get(b.id);
      assertEqual(bDomain.length, 8, "B deve avere (1,1) esclusa dal proprio dominio");
      assert(!bDomain.some((c) => c.row === 1 && c.col === 1), "(1,1) non deve comparire nel dominio di B");
    },
  },
  {
    name: "propagate: il dominio esposto riflette un cap genuino (round interrotto prima del punto fisso), non solo il caso completo",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneC = addZone(puzzle.grid, "StanzaC", "#eee");
      paintCellZone(puzzle.grid, 2, 2, zoneC.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id }); // A -> (0,0), round 0
      addClue(puzzle, c.id, "inRoom", { zoneId: zoneC.id }); // C -> (2,2), round 0
      addClue(puzzle, b.id, "inRowOrCol", { axis: "row", index: 2 }); // B forzata solo al round 1
      const result = propagate(puzzle, new Map(), { maxRounds: 1 });
      assertEqual(result.contradiction, null);
      assert(!result.domains.has(a.id), "A è già forzata al round 0: nessuna voce di dominio per lei");
      assert(!result.domains.has(c.id), "C è già forzata al round 0: nessuna voce di dominio per lei");
      const bDomain = result.domains.get(b.id);
      assertEqual(bDomain.length, 3, "il dominio di B esposto deve essere quello del round 0 (prima che il round 1, mai eseguito, la forzi)");
      const cells = bDomain.map((cell) => `${cell.row},${cell.col}`).sort().join("|");
      assertEqual(cells, "1,0|1,1|1,2");
    },
  },
  {
    name: "propagate: nessun dominio esposto quando ogni personaggio finisce forzato (punto fisso completo)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneC = addZone(puzzle.grid, "StanzaC", "#eee");
      paintCellZone(puzzle.grid, 2, 2, zoneC.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id });
      addClue(puzzle, c.id, "inRoom", { zoneId: zoneC.id });
      addClue(puzzle, b.id, "inRowOrCol", { axis: "row", index: 2 });
      const result = propagate(puzzle, new Map());
      assertEqual(result.contradiction, null);
      assertEqual(result.forced.length, 3, "tutti e tre devono risultare forzati (round 0 + round 1 per B)");
      assertEqual(result.domains.size, 0, "nessun personaggio resta non piazzato: la mappa dei domini deve essere vuota");
    },
  },
];
