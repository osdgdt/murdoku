import { manhattan, isAdjacent, isDiagonal, isSameRowOrCol, isDirection, isDirectionDistance } from "../src/util/geometry.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "manhattan calcola la distanza di Manhattan tra due celle",
    fn: () => {
      assertEqual(manhattan({ row: 0, col: 0 }, { row: 0, col: 0 }), 0);
      assertEqual(manhattan({ row: 0, col: 0 }, { row: 2, col: 3 }), 5);
      assertEqual(manhattan({ row: 3, col: 1 }, { row: 0, col: 0 }), 4, "deve essere simmetrica/assoluta indipendentemente dall'ordine");
    },
  },
  {
    name: "isAdjacent è vero solo a distanza esattamente 1 (mai in diagonale)",
    fn: () => {
      assert(isAdjacent({ row: 1, col: 1 }, { row: 1, col: 2 }), "stessa riga, colonna adiacente");
      assert(isAdjacent({ row: 1, col: 1 }, { row: 0, col: 1 }), "stessa colonna, riga adiacente");
      assert(!isAdjacent({ row: 1, col: 1 }, { row: 1, col: 1 }), "la stessa cella non è adiacente a sé stessa");
      assert(!isAdjacent({ row: 1, col: 1 }, { row: 2, col: 2 }), "la diagonale non è adiacenza ortogonale");
      assert(!isAdjacent({ row: 1, col: 1 }, { row: 1, col: 3 }), "distanza 2 non è adiacenza");
    },
  },
  {
    name: "isDiagonal è vero solo per il vicino diagonale immediato",
    fn: () => {
      assert(isDiagonal({ row: 1, col: 1 }, { row: 2, col: 2 }), "diagonale sud-est");
      assert(isDiagonal({ row: 1, col: 1 }, { row: 0, col: 0 }), "diagonale nord-ovest");
      assert(isDiagonal({ row: 1, col: 1 }, { row: 0, col: 2 }), "diagonale nord-est");
      assert(!isDiagonal({ row: 1, col: 1 }, { row: 1, col: 2 }), "l'adiacenza ortogonale non è diagonale");
      assert(!isDiagonal({ row: 1, col: 1 }, { row: 1, col: 1 }), "la stessa cella non è diagonale a sé stessa");
      assert(!isDiagonal({ row: 1, col: 1 }, { row: 3, col: 3 }), "diagonale a distanza 2 non è il vicino immediato");
    },
  },
  {
    name: "isSameRowOrCol è vero se condividono la riga o la colonna (anche entrambe)",
    fn: () => {
      assert(isSameRowOrCol({ row: 2, col: 5 }, { row: 2, col: 8 }), "stessa riga");
      assert(isSameRowOrCol({ row: 2, col: 5 }, { row: 7, col: 5 }), "stessa colonna");
      assert(isSameRowOrCol({ row: 3, col: 3 }, { row: 3, col: 3 }), "la stessa cella condivide entrambe");
      assert(!isSameRowOrCol({ row: 2, col: 5 }, { row: 7, col: 8 }), "né riga né colonna in comune");
    },
  },
  {
    name: "isDirection classifica correttamente nord/sud/est/ovest",
    fn: () => {
      const target = { row: 3, col: 3 };
      assert(isDirection("north", { row: 1, col: 3 }, target), "riga minore = a nord");
      assert(!isDirection("north", { row: 5, col: 3 }, target));
      assert(isDirection("south", { row: 5, col: 3 }, target), "riga maggiore = a sud");
      assert(isDirection("east", { row: 3, col: 5 }, target), "colonna maggiore = a est");
      assert(isDirection("west", { row: 3, col: 1 }, target), "colonna minore = a ovest");
      assert(!isDirection("north", target, target), "una cella non è mai a nord di sé stessa");
    },
  },
  {
    name: "isDirection lancia un errore per una direzione sconosciuta",
    fn: () => {
      let threw = false;
      try {
        isDirection("nord-est", { row: 0, col: 0 }, { row: 1, col: 1 });
      } catch (e) {
        threw = true;
      }
      assert(threw, "atteso un errore per direzione non valida");
    },
  },
  {
    name: "isDirectionDistance richiede una distanza esatta sull'asse giusto",
    fn: () => {
      const target = { row: 5, col: 5 };
      assert(isDirectionDistance("north", 2, { row: 3, col: 5 }, target), "2 righe a nord");
      assert(!isDirectionDistance("north", 3, { row: 3, col: 5 }, target), "distanza sbagliata rifiutata");
      assert(isDirectionDistance("south", 2, { row: 7, col: 5 }, target), "2 righe a sud");
      assert(isDirectionDistance("east", 4, { row: 5, col: 9 }, target), "4 colonne a est");
      assert(isDirectionDistance("west", 4, { row: 5, col: 1 }, target), "4 colonne a ovest");
      assert(!isDirectionDistance("east", 4, { row: 5, col: 9 + 1 }, target), "colonna diversa da quella attesa non deve combaciare per caso");
    },
  },
  {
    name: "isDirectionDistance lancia un errore per una direzione sconosciuta",
    fn: () => {
      let threw = false;
      try {
        isDirectionDistance("su", 1, { row: 0, col: 0 }, { row: 1, col: 1 });
      } catch (e) {
        threw = true;
      }
      assert(threw, "atteso un errore per direzione non valida");
    },
  },
];
