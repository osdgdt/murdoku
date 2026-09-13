import { CLUE_TYPES } from "../model/clueTypes.js";
import { isObjectTypeOccupiable } from "../model/icons.js";
import { isUsable, isOccupiable } from "../model/grid.js";
import { resolveTargetPositions, victimId, buildPredicates } from "./predicates.js";

// Resolves the "proprietà" (property) family shared by several clue types
// (someoneInRoomWithProperty, aloneWithPersonProperty, someoneAtDirectionDistance,
// extremeInDirection, noOneWithProperty — see clueTypes.js's propertyParams/
// optionalPropertyParams) to concrete cells, mirroring the exact same
// params.property branching describeProperty() already uses for text — same
// source of truth, never duplicated in a way that could drift.
function resolvePropertyTargets(params, puzzle, placementMap) {
  switch (params.property) {
    case "adjacentTo":
      return resolveTargetPositions(placementMap, puzzle, params.targetId) || [];
    case "sittingOn":
      return puzzle.grid.objects.filter((o) => o.typeId === params.objectTypeId).map((o) => ({ row: o.row, col: o.col }));
    // "seduto/a (su una sedia, uno sgabello, o simili)" — vale per qualunque
    // oggetto occupabile, non un tipo specifico (vedi PERSON_PROPERTY_LABELS.seated
    // in clueTypes.js) — quindi l'unione di tutti gli oggetti occupabili sulla
    // mappa, non un singolo typeId da filtrare.
    case "seated":
      return puzzle.grid.objects.filter((o) => isObjectTypeOccupiable(o.typeId)).map((o) => ({ row: o.row, col: o.col }));
    case "custom":
      return params.customClue?.type ? resolveClueHoverCells(params.customClue, puzzle, placementMap) : [];
    default:
      // "male"/"female"/non impostato — nessun bersaglio fisso da evidenziare.
      return [];
  }
}

const PROPERTY_FAMILY_PARAM_NAMES = new Set(["property", "targetId", "objectTypeId", "customClue"]);

// Risolve un indizio nelle celle della mappa a cui fa riferimento, per
// l'evidenziazione al passaggio del mouse (src/player/gameScreen.js). Cammina
// sulla struttura dichiarativa `CLUE_TYPES[type].params: [{name, kind}]` già
// usata da clueBuilder.js per il rendering dei controlli, invece di
// riscrivere un caso per ognuno dei ~44 tipi di indizio. Tipi puramente
// geometrici/relativi senza bersaglio esterno (inRowOrCol, inCorner,
// someoneAtDirectionDistance senza property, emptyRoomsCount...) risolvono
// naturalmente a un array vuoto: nessun parametro dichiarato è del genere
// giusto, quindi nessuna cella viene aggiunta — comportamento corretto, non
// un caso da gestire a parte.
export function resolveClueHoverCells(clue, puzzle, placementMap) {
  try {
    return resolveClueHoverCellsUnsafe(clue, puzzle, placementMap);
  } catch {
    // Stesso principio tollerante di describeClue() in clueTypes.js: un
    // indizio incompleto o dalla forma inattesa non deve mai far esplodere
    // l'evidenziazione, solo non mostrare nulla.
    return [];
  }
}

function resolveClueHoverCellsUnsafe(clue, puzzle, placementMap) {
  const type = CLUE_TYPES[clue.type];
  if (!type) return [];
  const cells = [];
  const isPropertyBased = (type.params || []).some((p) => p.name === "property");

  for (const paramDef of type.params || []) {
    if (isPropertyBased && PROPERTY_FAMILY_PARAM_NAMES.has(paramDef.name)) continue; // gestiti sotto da resolvePropertyTargets
    const value = clue.params?.[paramDef.name];
    if (value == null) continue;
    if (paramDef.kind === "character" || paramDef.kind === "characterOrObject" || paramDef.kind === "zone") {
      const resolved = resolveTargetPositions(placementMap, puzzle, value);
      if (resolved) cells.push(...resolved);
    } else if (paramDef.kind === "characterOrObjectMulti") {
      for (const id of value) {
        const resolved = resolveTargetPositions(placementMap, puzzle, id);
        if (resolved) cells.push(...resolved);
      }
    } else if (paramDef.name === "objectTypeId") {
      // kind è "enum" (renderizzato come <select>), ma il valore referenzia
      // comunque oggetti reali sulla mappa — es. onObjectType, fuori dalla
      // famiglia "proprietà" (quella versione è gestita da resolvePropertyTargets).
      cells.push(...puzzle.grid.objects.filter((o) => o.typeId === value).map((o) => ({ row: o.row, col: o.col })));
    }
    // altri kind (enum non-objectTypeId, number) non referenziano celle.
  }

  if (isPropertyBased) cells.push(...resolvePropertyTargets(clue.params || {}, puzzle, placementMap));

  // Bersaglio implicito (nessun parametro dichiarato): la vittima.
  if (clue.type === "aloneWithVictim") {
    const vId = victimId(puzzle);
    if (vId) {
      const resolved = resolveTargetPositions(placementMap, puzzle, vId);
      if (resolved) cells.push(...resolved);
    }
  }

  // noOneInRowOrCol: axis+index individuano geometricamente un'intera riga o
  // colonna (index è 1-based, come le etichette R1/C1... — stessa convenzione
  // -1 già usata dal predicato di inRowOrCol), ma nessun kind dichiarato
  // corrisponde a un ramo del cammino generico sopra. Rispecchia l'esclusione
  // delle sole celle bloccate già usata da positionsInZone (predicates.js) —
  // non la più severa isOccupiable — per coerenza con l'evidenziazione di
  // noOneInRoom basata su zona, il suo fratello strutturale.
  if (clue.type === "noOneInRowOrCol" && clue.params?.axis && clue.params?.index != null) {
    const idx = clue.params.index - 1;
    const { rows, cols } = puzzle.grid.size;
    if (clue.params.axis === "row") {
      for (let c = 0; c < cols; c++) if (isUsable(puzzle.grid, idx, c)) cells.push({ row: idx, col: c });
    } else {
      for (let r = 0; r < rows; r++) if (isUsable(puzzle.grid, r, idx)) cells.push({ row: r, col: idx });
    }
  }

  // inRowOrCol: stessa geometria di noOneInRowOrCol sopra (stessa forma di
  // parametri/convenzione 1-based), solo posseduto da un personaggio invece
  // che generico — il bersaglio dell'indizio È la riga/colonna stessa. Stesso
  // gap di "nessun kind dichiarato corrisponde a un ramo del cammino
  // generico" già visto per noOneInRowOrCol: senza questo blocco, hoverare
  // questo indizio non evidenziava mai nulla.
  if (clue.type === "inRowOrCol" && clue.params?.axis && clue.params?.index != null) {
    const idx = clue.params.index - 1;
    const { rows, cols } = puzzle.grid.size;
    if (clue.params.axis === "row") {
      for (let c = 0; c < cols; c++) if (isUsable(puzzle.grid, idx, c)) cells.push({ row: idx, col: c });
    } else {
      for (let r = 0; r < rows; r++) if (isUsable(puzzle.grid, r, idx)) cells.push({ row: r, col: idx });
    }
  }

  // rowOrColParity: il bersaglio è OGNI riga/colonna della parità scelta, non
  // solo una — rispecchia esattamente il predicato reale (predicates.js:
  // value = indice 1-based, isOdd = value%2===1, soddisfatto quando
  // isOdd===wantOdd) così l'evidenziazione mostra precisamente le
  // righe/colonne che il predicato considera valide. Stesso gap di kind non
  // risolvibile del blocco sopra.
  if (clue.type === "rowOrColParity" && clue.params?.axis && clue.params?.parity) {
    const { rows, cols } = puzzle.grid.size;
    const wantOdd = clue.params.parity === "odd";
    if (clue.params.axis === "row") {
      for (let r = 0; r < rows; r++) {
        if (((r + 1) % 2 === 1) !== wantOdd) continue;
        for (let c = 0; c < cols; c++) if (isUsable(puzzle.grid, r, c)) cells.push({ row: r, col: c });
      }
    } else {
      for (let c = 0; c < cols; c++) {
        if (((c + 1) % 2 === 1) !== wantOdd) continue;
        for (let r = 0; r < rows; r++) if (isUsable(puzzle.grid, r, c)) cells.push({ row: r, col: c });
      }
    }
  }

  // "seated" è anche un tipo di indizio a sé (params: [], vedi clueTypes.js),
  // distinto dal valore property "seated" già gestito sopra — stessa unione
  // di ogni oggetto occupabile sulla mappa.
  if (clue.type === "seated") {
    cells.push(...puzzle.grid.objects.filter((o) => isObjectTypeOccupiable(o.typeId)).map((o) => ({ row: o.row, col: o.col })));
  }

  // orClue: due sotto-indizi annidati in params.a/params.b, mai dichiarati
  // nell'array `params` del tipo (clueBuilder.js li renderizza a parte) —
  // unione di entrambi i bersagli.
  if (clue.type === "orClue") {
    if (clue.params?.a?.type) cells.push(...resolveClueHoverCellsUnsafe(clue.params.a, puzzle, placementMap));
    if (clue.params?.b?.type) cells.push(...resolveClueHoverCellsUnsafe(clue.params.b, puzzle, placementMap));
  }

  const seen = new Set();
  return cells.filter(({ row, col }) => {
    const k = `${row},${col}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Dominio di celle compatibili con TUTTI gli indizi PROPRI di characterId
// contemporaneamente (src/player/gameScreen.js's showCharacterHover) —
// deliberatamente NON un'unione dei "bersagli" di ciascun indizio
// (resolveClueHoverCells resta quello, invariato, per l'hover-su-singolo-
// indizio) e deliberatamente NON un round di propagate() (che valuta OGNI
// indizio del puzzle, inclusi quelli generici e degli altri personaggi — una
// domanda più stretta e diversa da "cosa permettono le sue SOLE
// informazioni").
//
// Riusa lo stesso contratto sonoro su cui si basa già propagate(): per una
// cella candidata, costruisce una mappa di piazzamento tentativa (ogni ALTRO
// personaggio alla sua posizione ATTUALE sulla board + questo personaggio in
// quella cella) e valuta un predicato con un `isComplete` onesto. Un
// predicato restituisce `false` solo quando nessun completamento di
// quell'assegnazione parziale può soddisfarlo — proprietà del predicato
// stesso, indipendente da QUALI ALTRI predicati vengono valutati insieme.
// Restringere il set valutato ai soli indizi propri del personaggio (le
// coppie con clue.characterId === characterId — esclude per costruzione ogni
// indizio generico e la regola-base sintetica della vittima, che ha sempre
// characterId: null anche quando characterId QUI è proprio quello della
// vittima) può solo rendere il risultato più permissivo, mai fabbricare un
// falso "non compatibile": è esattamente la semantica voluta ("compatibile
// con TUTTI i SUOI indizi", non con l'intero puzzle).
//
// A differenza di propagate(), characterId può essere già confermato sulla
// board (il chip in toolbar resta hoverabile anche da piazzato) — `confirmed`
// esclude sempre la posizione attuale di characterId, così non si autoesclude
// mai dalla propria riga/colonna.
export function resolveCharacterHoverDomain(puzzle, characterId, currentPlacements) {
  const ownPredicates = buildPredicates(puzzle).filter(({ clue }) => clue.characterId === characterId);

  const confirmed = new Map(currentPlacements);
  confirmed.delete(characterId);

  const usedRows = new Set([...confirmed.values()].map((p) => p.row));
  const usedCols = new Set([...confirmed.values()].map((p) => p.col));
  const isComplete = confirmed.size === puzzle.characters.length - 1;

  const { rows, cols } = puzzle.grid.size;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    if (usedRows.has(r)) continue;
    for (let c = 0; c < cols; c++) {
      if (usedCols.has(c)) continue;
      if (!isOccupiable(puzzle.grid, r, c)) continue;
      const tentative = new Map(confirmed);
      tentative.set(characterId, { row: r, col: c });
      let excluded = false;
      for (const { predicate } of ownPredicates) {
        if (predicate(tentative, isComplete) === false) { excluded = true; break; }
      }
      if (!excluded) cells.push({ row: r, col: c });
    }
  }
  return cells;
}
