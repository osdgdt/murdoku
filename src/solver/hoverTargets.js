import { CLUE_TYPES } from "../model/clueTypes.js";
import { isObjectTypeOccupiable } from "../model/icons.js";
import { isUsable } from "../model/grid.js";
import { resolveTargetPositions, victimId } from "./predicates.js";

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
