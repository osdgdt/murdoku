import { createGrid, placeObject } from "../src/model/grid.js";
import { createBoardState, handleCellClick, undo, clearAll, serializeBoardState, deserializeBoardState } from "../src/player/board.js";
import { assert, assertEqual } from "./assert.js";

function grid3x3() {
  return createGrid(3, 3);
}

export const tests = [
  {
    name: "in modalità note, click su una cella segna un candidato senza confermare il piazzamento",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      const result = handleCellClick(state, grid, 0, 0);
      assert(result.ok, "il segno del candidato deve riuscire");
      assertEqual(state.placements.size, 0, "non deve esserci un piazzamento confermato");
      assert(state.candidates.get("0,0").has("anna"), "anna deve essere candidata in (0,0)");
    },
  },
  {
    name: "in modalità note, un secondo click sullo stesso personaggio rimuove il candidato",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 0, 0);
      handleCellClick(state, grid, 0, 0);
      assert(!state.candidates.has("0,0"), "il candidato deve essere stato rimosso");
    },
  },
  {
    name: "i candidati permettono più personaggi nella stessa cella (a differenza del piazzamento confermato)",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      state.selectedTool = { kind: "character", id: "bruno" };
      handleCellClick(state, grid, 1, 1);
      const set = state.candidates.get("1,1");
      assertEqual(set.size, 2, "entrambi i candidati devono coesistere nella stessa cella");
    },
  },
  {
    name: "confermare un piazzamento ripulisce i candidati di quella cella",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 0, 0);
      state.notesMode = false;
      handleCellClick(state, grid, 0, 0);
      assert(!state.candidates.has("0,0"), "i candidati devono sparire quando la cella viene confermata");
      assertEqual(state.placements.get("anna").row, 0);
    },
  },
  {
    name: "non si possono segnare candidati su una cella già confermata",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 0, 0); // conferma Anna in (0,0)
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "bruno" };
      const result = handleCellClick(state, grid, 0, 0);
      assert(!result.ok, "non deve essere possibile segnare un candidato su una cella occupata");
    },
  },
  {
    name: "undo annulla il segno di un candidato",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 0, 0);
      undo(state);
      assert(!state.candidates.has("0,0"), "il candidato deve essere annullato");
    },
  },
  {
    name: "la gomma su una cella con candidati li rimuove tutti, e undo li ripristina",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 0, 0);
      state.selectedTool = { kind: "character", id: "bruno" };
      handleCellClick(state, grid, 0, 0);
      state.selectedTool = { kind: "erase" };
      const result = handleCellClick(state, grid, 0, 0);
      assert(result.ok, "la gomma deve ripulire la cella");
      assert(!state.candidates.has("0,0"), "i candidati devono essere spariti");
      undo(state);
      assertEqual(state.candidates.get("0,0").size, 2, "undo deve ripristinare entrambi i candidati");
    },
  },
  {
    name: "clearAll svuota anche i candidati",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 0, 0);
      clearAll(state);
      assertEqual(state.candidates.size, 0, "i candidati devono essere azzerati");
    },
  },
  {
    name: "una cella bloccata rifiuta anche i candidati",
    fn: () => {
      const grid = grid3x3();
      grid.cells[0][0].blocked = true;
      const state = createBoardState();
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "anna" };
      const result = handleCellClick(state, grid, 0, 0);
      assert(!result.ok, "una cella bloccata non deve accettare candidati");
    },
  },
  {
    name: "una cella con un oggetto rifiuta personaggi, segni X e candidati",
    fn: () => {
      const grid = grid3x3();
      placeObject(grid, "shelf", 0, 0);
      const state = createBoardState();

      state.selectedTool = { kind: "character", id: "anna" };
      assert(!handleCellClick(state, grid, 0, 0).ok, "non deve accettare un personaggio sopra lo scaffale");

      state.selectedTool = { kind: "x" };
      assert(!handleCellClick(state, grid, 0, 0).ok, "non deve accettare un segno X sopra lo scaffale");

      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "bruno" };
      assert(!handleCellClick(state, grid, 0, 0).ok, "non deve accettare un candidato sopra lo scaffale");
    },
  },
  {
    name: "confermare un personaggio segna automaticamente X sul resto della riga e colonna",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      assert(state.xMarks.has("1,0"), "resto della riga 1 deve avere una X");
      assert(state.xMarks.has("1,2"), "resto della riga 1 deve avere una X");
      assert(state.xMarks.has("0,1"), "resto della colonna 1 deve avere una X");
      assert(state.xMarks.has("2,1"), "resto della colonna 1 deve avere una X");
      assertEqual(state.xMarks.size, 4, "solo riga e colonna del piazzamento, non l'intera griglia");
    },
  },
  {
    name: "l'auto-X non sovrascrive celle occupate, già segnate, o non occupabili",
    fn: () => {
      const grid = grid3x3();
      placeObject(grid, "shelf", 1, 0); // sulla riga di Anna, non deve ricevere una X
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "bruno" };
      handleCellClick(state, grid, 0, 2); // Bruno già piazzato, occupa (0,2)
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      assert(!state.xMarks.has("1,0"), "la cella con lo scaffale non deve ricevere una X");
      assert(state.placements.has("bruno"), "Bruno deve restare piazzato");
      assertEqual(state.placements.get("bruno").row, 0, "il piazzamento di Bruno non va toccato dall'auto-X");
    },
  },
  {
    name: "undo di un piazzamento rimuove anche le X aggiunte automaticamente insieme ad esso",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      assertEqual(state.xMarks.size, 4);
      undo(state);
      assertEqual(state.xMarks.size, 0, "le X automatiche devono sparire insieme al piazzamento annullato");
      assertEqual(state.placements.size, 0);
    },
  },
  {
    name: "cliccare di nuovo la cella del proprio personaggio lo rimuove",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      assert(state.placements.has("anna"), "anna deve essere piazzata");
      const result = handleCellClick(state, grid, 1, 1);
      assert(result.ok, "il secondo click sulla stessa cella deve riuscire");
      assert(!state.placements.has("anna"), "anna deve essere stata rimossa");
    },
  },
  {
    name: "rimuovere un personaggio (ri-cliccando la sua cella) ritira anche le sue X automatiche",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      assertEqual(state.xMarks.size, 4);
      handleCellClick(state, grid, 1, 1); // ri-click = rimuovi
      assertEqual(state.xMarks.size, 0, "le X automatiche devono sparire insieme al personaggio rimosso");
    },
  },
  {
    name: "la gomma su un personaggio piazzato ritira anche le sue X automatiche",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      state.selectedTool = { kind: "erase" };
      handleCellClick(state, grid, 1, 1);
      assert(!state.placements.has("anna"), "anna deve essere stata rimossa dalla gomma");
      assertEqual(state.xMarks.size, 0, "le X automatiche devono sparire insieme al personaggio cancellato");
    },
  },
  {
    name: "undo della rimozione di un personaggio lo ripristina insieme alle sue X",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      handleCellClick(state, grid, 1, 1); // rimuove
      undo(state);
      assertEqual(state.placements.get("anna").row, 1, "anna deve essere ripiazzata in (1,1)");
      assertEqual(state.xMarks.size, 4, "le X automatiche devono essere ripristinate");
    },
  },
  {
    name: "spostare un personaggio già piazzato ritira le X della vecchia cella e ne aggiunge di nuove",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1); // X su (1,0) (1,2) (0,1) (2,1)
      handleCellClick(state, grid, 0, 0); // anna si sposta in (0,0)
      assert(!state.xMarks.has("1,2"), "una X della vecchia riga, non più valida, deve sparire");
      assert(!state.xMarks.has("2,1"), "una X della vecchia colonna, non più valida, deve sparire");
      assert(
        state.xMarks.has("0,1") && state.xMarks.has("0,2") && state.xMarks.has("1,0") && state.xMarks.has("2,0"),
        "la nuova riga/colonna di anna deve avere le sue X"
      );
      assertEqual(state.placements.get("anna").row, 0);
      assertEqual(state.xMarks.size, 4, "solo le X della nuova riga/colonna di anna restano");
    },
  },
  {
    name: "undo dello spostamento riporta il personaggio e le X alla cella precedente",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1);
      handleCellClick(state, grid, 0, 0);
      undo(state);
      assertEqual(state.placements.get("anna").row, 1, "anna deve tornare in (1,1)");
      assert(
        state.xMarks.has("1,0") && state.xMarks.has("1,2") && state.xMarks.has("0,1") && state.xMarks.has("2,1"),
        "le X originali devono essere ripristinate"
      );
      assertEqual(state.xMarks.size, 4);
    },
  },
  {
    name: "una sedia e un tappeto sono occupabili da un personaggio, a differenza degli altri oggetti",
    fn: () => {
      const grid = grid3x3();
      placeObject(grid, "chair", 0, 0);
      placeObject(grid, "carpet", 1, 1);
      placeObject(grid, "table", 2, 2);
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      assert(handleCellClick(state, grid, 0, 0).ok, "deve poter piazzare un personaggio sulla sedia");
      state.selectedTool = { kind: "character", id: "bruno" };
      assert(handleCellClick(state, grid, 1, 1).ok, "deve poter piazzare un personaggio sul tappeto");
      state.selectedTool = { kind: "character", id: "carlo" };
      assert(!handleCellClick(state, grid, 2, 2).ok, "non deve poter piazzare un personaggio sul tavolo");
    },
  },
  {
    name: "serializeBoardState/deserializeBoardState fanno un round-trip fedele attraverso JSON (persistenza tra sessioni)",
    fn: () => {
      const grid = grid3x3();
      const state = createBoardState();
      state.selectedTool = { kind: "character", id: "anna" };
      handleCellClick(state, grid, 1, 1); // piazzamento confermato + auto-X
      state.notesMode = true;
      state.selectedTool = { kind: "character", id: "bruno" };
      handleCellClick(state, grid, 0, 0); // candidato

      // Il round-trip passa da JSON per verificare davvero cosa sopravvive a
      // un giro per localStorage, non solo la forma in memoria.
      const restored = deserializeBoardState(JSON.parse(JSON.stringify(serializeBoardState(state))));

      assertEqual(restored.placements.get("anna").row, 1, "il piazzamento confermato deve sopravvivere");
      assertEqual(restored.placements.get("anna").col, 1);
      assert(restored.xMarks.has("1,0"), "le X automatiche devono sopravvivere");
      assertEqual(restored.xMarks.size, 4);
      assert(restored.candidates.get("0,0").has("bruno"), "il candidato deve sopravvivere");
      assertEqual(restored.notesMode, true, "la modalità note deve sopravvivere");
      assertEqual(restored.undoStack.length, 0, "lo stack di undo è deliberatamente non persistito");
      assertEqual(restored.selectedTool, null, "lo strumento selezionato è deliberatamente non persistito");
    },
  },
  {
    name: "deserializeBoardState su un valore assente o malformato restituisce uno stato vuoto invece di lanciare un errore",
    fn: () => {
      assertEqual(deserializeBoardState(null).placements.size, 0);
      assertEqual(deserializeBoardState(undefined).placements.size, 0);
      assertEqual(deserializeBoardState({ placements: 42 }).placements.size, 0, "un valore non iterabile deve ricadere su uno stato vuoto, non lanciare");
    },
  },
  {
    name: "hintsUsed sopravvive al round-trip serialize/deserialize",
    fn: () => {
      const state = createBoardState();
      state.hintsUsed = 3;
      const restored = deserializeBoardState(JSON.parse(JSON.stringify(serializeBoardState(state))));
      assertEqual(restored.hintsUsed, 3);
    },
  },
  {
    name: "deserializeBoardState su hintsUsed mancante o malformato ricade su 0",
    fn: () => {
      assertEqual(deserializeBoardState({}).hintsUsed, 0, "progresso salvato prima di questa funzionalità");
      assertEqual(deserializeBoardState({ hintsUsed: -1 }).hintsUsed, 0);
      assertEqual(deserializeBoardState({ hintsUsed: "3" }).hintsUsed, 0, "una stringa non è un numero valido");
    },
  },
];
