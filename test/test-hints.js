import { createPuzzle, addCharacter, addClue, setSolutionPlacement } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid } from "../src/model/grid.js";
import { objectTypeTargetId } from "../src/model/icons.js";
import { computeHint, computeHintChain } from "../src/solver/hints.js";
import { assert, assertEqual } from "./assert.js";

function basePuzzle(rows = 3, cols = 3) {
  const puzzle = createPuzzle("Test hints");
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  return puzzle;
}

// Puzzle used by tests 1-3: 3x3 grid, A and B, a zone painted on exactly
// cell (1,1), A constrained to that zone. With nothing placed there are 4
// solutions (A fixed at (1,1), B free on any of the other 4 corner-ish
// cells with a distinct row/col) — enough variation to prove detection
// isn't a degenerate single-solution puzzle.
function forcedPlacementPuzzle() {
  const puzzle = basePuzzle();
  const a = addCharacter(puzzle, "A", "person1");
  const b = addCharacter(puzzle, "B", "person2");
  const zone = addZone(puzzle.grid, "Studio", "#fff");
  paintCellZone(puzzle.grid, 1, 1, zone.id);
  addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
  return { puzzle, a, b };
}

// 3x3 grid, A and B, a zone painted on exactly cell (1,1); B is barred from
// that one cell via "notInRoom". With nothing placed, A is unconstrained
// (reaches all 9 cells) and B reaches all cells except (1,1) — never forced,
// but (1,1) genuinely never appears for B in any solution. Unlike a puzzle
// where a *character* is already confirmed, `currentPlacements` here starts
// empty, so there's no trivial row/col exclusion to confuse with this.
function eliminatedCellPuzzle() {
  const puzzle = basePuzzle();
  const a = addCharacter(puzzle, "A", "person1");
  const b = addCharacter(puzzle, "B", "person2");
  const zone = addZone(puzzle.grid, "Studio", "#fff");
  paintCellZone(puzzle.grid, 1, 1, zone.id);
  addClue(puzzle, b.id, "notInRoom", { zoneId: zone.id });
  return { puzzle, a, b };
}

export const tests = [
  {
    name: "computeHint: forcedPlacement quando un personaggio ha una sola cella compatibile",
    fn: () => {
      const { puzzle, a } = forcedPlacementPuzzle();
      const result = computeHint(puzzle, new Map());
      assertEqual(result.type, "forcedPlacement");
      assertEqual(result.characterId, a.id);
      assertEqual(result.row, 1);
      assertEqual(result.col, 1);
    },
  },
  {
    name: "computeHint: eliminatedCell per una cella con una nota candidato che nessuna soluzione conferma",
    fn: () => {
      const { puzzle, b } = eliminatedCellPuzzle();
      // Solo una cella con una nota candidato per B viene segnalata come
      // esclusa — vedi il test sotto per il caso senza nota corrispondente.
      const candidates = new Map([["1,1", new Set([b.id])]]);
      const result = computeHint(puzzle, new Map(), candidates);
      assertEqual(result.type, "eliminatedCell");
      assertEqual(result.characterId, b.id);
      assertEqual(result.row, 1);
      assertEqual(result.col, 1);
    },
  },
  {
    name: "computeHint: non segnala una cella come esclusa se il giocatore non l'ha mai segnata come candidato per quel personaggio",
    fn: () => {
      const { puzzle } = eliminatedCellPuzzle();
      // Nessuna nota candidato da nessuna parte: "B non può stare in (1,1)"
      // sarebbe vero, ma non è utile dirlo se il giocatore non ha mai
      // sospettato B lì — non deve comparire come suggerimento. Con
      // l'esclusione filtrata via, la ricerca esaustiva ha comunque provato
      // che restano più soluzioni valide, quindi il tipo corretto è
      // "noFurtherDeduction", non il generico "noHint".
      const result = computeHint(puzzle, new Map(), new Map());
      assertEqual(result.type, "noFurtherDeduction", "senza note candidato non deve suggerire esclusioni, ma la ricerca esaustiva ha comunque qualcosa da dire");
    },
  },
  {
    name: "computeHintChain: un'esclusione che non fa avanzare nessun piazzamento compare una sola volta, non ripetuta fino al limite della catena",
    fn: () => {
      const { puzzle, b } = eliminatedCellPuzzle();
      // Un'esclusione da sola non conferma mai nessun personaggio, quindi
      // non fa avanzare `confirmed`: senza una guardia esplicita, l'ondata
      // successiva ritroverebbe lo stesso identico fatto all'infinito (fino
      // al tetto HINT_CHAIN_MAX_STEPS) invece di fermarsi dopo averlo detto
      // una volta.
      const candidates = new Map([["1,1", new Set([b.id])]]);
      const chain = computeHintChain(puzzle, new Map(), candidates);
      assertEqual(chain.length, 1, "l'esclusione deve comparire una sola volta, non ripetuta");
      assertEqual(chain[0].type, "eliminatedCell");
    },
  },
  {
    name: "computeHint: contradiction identifica il colpevole quando un piazzamento viola un indizio",
    fn: () => {
      const { puzzle, a } = forcedPlacementPuzzle();
      const result = computeHint(puzzle, new Map([[a.id, { row: 0, col: 0 }]]));
      assertEqual(result.type, "contradiction");
      // A's own inRoom clue is already directly false on the current
      // placements ((0,0) isn't in zone Studio) — the cheap direct-violation
      // check catches this before the more expensive placement-removal
      // search even runs, so cause is "clue" (naming the violated clue),
      // not the generic "placements".
      assertEqual(result.cause, "clue");
      assert(result.clueIds.length > 0, "deve nominare almeno un indizio violato");
      const aInRoomClueId = puzzle.clues.find((c) => c.characterId === a.id && c.type === "inRoom").id;
      assert(result.clueIds.includes(aInRoomClueId), "l'indizio violato deve essere l'inRoom di A");
      assertEqual(result.culprits.length, 1);
      assertEqual(result.culprits[0], a.id);
    },
  },
  {
    name: "computeHint: tooComplex su un puzzle poco vincolato (troppe soluzioni)",
    fn: () => {
      // 6x6, nessun indizio: P(6,3)*P(6,3) = 120*120 = 14400 soluzioni, ben
      // oltre HINT_MAX_SOLUTIONS (2000) — una griglia 4x4 con soli 3
      // personaggi (576 soluzioni) non basta più dopo l'aumento del budget.
      const puzzle = basePuzzle(6, 6);
      addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1");
      const result = computeHint(puzzle, new Map());
      assertEqual(result.type, "tooComplex");
    },
  },
  {
    name: "computeHint: noHint/complete quando tutti i personaggi sono già piazzati",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const result = computeHint(puzzle, new Map([[a.id, { row: 0, col: 0 }], [b.id, { row: 1, col: 1 }]]));
      assertEqual(result.type, "noHint");
      assertEqual(result.reason, "complete");
    },
  },
  {
    name: "computeHint: noFurtherDeduction quando la ricerca esaustiva prova che restano più soluzioni valide, senza nulla di forzato",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1");
      // Nessun indizio, solo A piazzato: B e C restano liberi sulla sotto-griglia 3x3
      // rimanente (36 soluzioni: 9 celle per B x 4 celle compatibili per C, ben sotto
      // il cap), quindi nessuna cella risulta forzata o esclusa per nessuno dei due —
      // ma la ricerca esaustiva QUI si è comunque completata (36 < HINT_MAX_SOLUTIONS,
      // nessun nodeCap): ha dimostrato che esistono più soluzioni valide, non
      // semplicemente rinunciato a cercare (vedi tooComplex per quel caso).
      const result = computeHint(puzzle, new Map([[a.id, { row: 0, col: 0 }]]));
      assertEqual(result.type, "noFurtherDeduction");
    },
  },
  {
    name: "computeHint non guarda mai puzzle.solution: resta corretto anche se la risposta salvata è sbagliata o assente",
    fn: () => {
      const { puzzle, a } = forcedPlacementPuzzle();
      setSolutionPlacement(puzzle, a.id, 2, 2); // risposta salvata deliberatamente scorretta / in violazione dell'indizio
      const result = computeHint(puzzle, new Map());
      assertEqual(result.type, "forcedPlacement");
      assertEqual(result.row, 1);
      assertEqual(result.col, 1, "il suggerimento deve derivare dagli indizi, non dalla soluzione salvata (che qui è sbagliata)");
    },
  },
  {
    name: "computeHintChain percorre più deduzioni forzate consecutive, riusando computeHint passo dopo passo",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1", true);
      const d = addCharacter(puzzle, "D", "person2");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneB = addZone(puzzle.grid, "StanzaB", "#eee");
      paintCellZone(puzzle.grid, 1, 1, zoneB.id);
      // A 2-cell room for D, big enough to also hold the victim C once she's
      // forced there by elimination — a lone, unzoned elimination cell could
      // never satisfy the base rule (victim + exactly one companion) on its
      // own, so this test needs a 4th character to play that companion.
      const zoneD = addZone(puzzle.grid, "StanzaD", "#ddd");
      paintCellZone(puzzle.grid, 2, 2, zoneD.id);
      paintCellZone(puzzle.grid, 3, 3, zoneD.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zoneB.id });
      addClue(puzzle, d.id, "inRoom", { zoneId: zoneD.id });
      // Breaks the symmetry between StanzaD's two cells: only D at (2,2)
      // with C at the remaining (3,3) keeps D strictly north of C — both are
      // forced together, in the same wave, by the exhaustive solve (neither
      // alone collapses via propagation, since C has no clue of her own and
      // the direction clue can't evaluate until a candidate for both exists).
      addClue(puzzle, d.id, "direction", { direction: "north", targetId: c.id });

      const chain = computeHintChain(puzzle, new Map());
      assertEqual(chain.length, 4, "A, B, D e infine C devono risultare tutti forzati in sequenza");
      assertEqual(chain[0].characterId, a.id);
      assertEqual([chain[0].row, chain[0].col].join(","), "0,0");
      assertEqual(chain[1].characterId, b.id);
      assertEqual([chain[1].row, chain[1].col].join(","), "1,1");
      // C (la vittima) e D sono forzati insieme dalla stessa ondata — la
      // vittima viene mostrata per ultima anche se scoperta simultaneamente.
      assertEqual(chain[2].characterId, d.id);
      assertEqual([chain[2].row, chain[2].col].join(","), "2,2");
      assertEqual(chain[3].characterId, c.id, "la vittima, pur forzata nella stessa ondata di D, viene mostrata per ultima");
      assertEqual([chain[3].row, chain[3].col].join(","), "3,3");
      for (const step of chain) assertEqual(step.type, "forcedPlacement");
    },
  },
  {
    name: "computeHintChain: il messaggio del piazzamento forzato della vittima parla di 'unica casella rimasta libera', non del generico riferimento agli indizi",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1", true);
      const d = addCharacter(puzzle, "D", "person2");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneB = addZone(puzzle.grid, "StanzaB", "#eee");
      paintCellZone(puzzle.grid, 1, 1, zoneB.id);
      const zoneD = addZone(puzzle.grid, "StanzaD", "#ddd");
      paintCellZone(puzzle.grid, 2, 2, zoneD.id);
      paintCellZone(puzzle.grid, 3, 3, zoneD.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zoneB.id });
      addClue(puzzle, d.id, "inRoom", { zoneId: zoneD.id });
      addClue(puzzle, d.id, "direction", { direction: "north", targetId: c.id });

      const chain = computeHintChain(puzzle, new Map());
      const cStep = chain.find((s) => s.characterId === c.id);
      const dStep = chain.find((s) => s.characterId === d.id);
      assert(cStep.message.includes("unica casella rimasta libera"), "il messaggio della vittima deve usare la formulazione dedicata");
      assert(!dStep.message.includes("unica casella rimasta libera"), "un personaggio non-vittima deve mantenere la formulazione generica");
    },
  },
  {
    name: "computeHintChain si ferma dove finisce la deduzione certa, con un passo esplicito che lo conferma (non indovina i passi successivi)",
    fn: () => {
      const { puzzle } = forcedPlacementPuzzle();
      const chain = computeHintChain(puzzle, new Map());
      // Solo A è forzato: B resta su più celle possibili una volta fissato A
      // (4 soluzioni valide, nessuna forzata) — la seconda ondata lo dimostra
      // esaustivamente e lo dice esplicitamente, invece di fermarsi in silenzio.
      assertEqual(chain.length, 2);
      assertEqual(chain[0].type, "forcedPlacement");
      assertEqual(chain[1].type, "noFurtherDeduction");
    },
  },
  {
    name: "computeHintChain restituisce un solo passo quando il primo risultato non è un piazzamento forzato",
    fn: () => {
      const { puzzle, a } = forcedPlacementPuzzle();
      const chain = computeHintChain(puzzle, new Map([[a.id, { row: 0, col: 0 }]])); // viola l'indizio -> contraddizione
      assertEqual(chain.length, 1);
      assertEqual(chain[0].type, "contradiction");
      assert(chain[0].culprits.includes(a.id));
    },
  },
  {
    name: "computeHintChain: la propagazione trova un piazzamento forzato anche quando la ricerca esaustiva è troppo complessa",
    fn: () => {
      const puzzle = basePuzzle(6, 6);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      addCharacter(puzzle, "C", "person1");
      addCharacter(puzzle, "D", "person2");
      addCharacter(puzzle, "E", "person1");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 2, 2, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      // Nessun altro indizio: con A risolta, B..E restano liberi su una
      // sotto-griglia 5x5 (fino a 120x120 combinazioni riga/colonna, ben
      // oltre HINT_MAX_SOLUTIONS) -> la ricerca esaustiva non può
      // completarsi, ma la propagazione (che ragiona un personaggio alla
      // volta) trova comunque A senza bisogno di enumerare soluzioni intere.
      const chain = computeHintChain(puzzle, new Map());
      assertEqual(chain[0].type, "forcedPlacement", "la propagazione deve comunque trovare A, anche se il resto è troppo complesso");
      assertEqual(chain[0].characterId, a.id);
      assertEqual(chain[0].row, 2);
      assertEqual(chain[0].col, 2);
      const last = chain[chain.length - 1];
      assertEqual(last.type, "tooComplex", "il resto deve fermarsi onestamente a 'troppo complesso' invece di inventare altro");
    },
  },
  {
    name: "computeHintChain: l'elenco degli indizi coinvolti non include un indizio vero ma non determinante (distrattore)",
    fn: () => {
      const { puzzle, a } = forcedPlacementPuzzle();
      const inRoomClue = puzzle.clues.find((c) => c.characterId === a.id && c.type === "inRoom");
      // Distrattore: "nessuno è vicino a una finestra" — non ci sono
      // finestre sulla mappa, quindi questo indizio generico è vero per
      // verità vacua (mai violabile, per nessun personaggio, in nessuna
      // cella) e non deve mai comparire come causa di alcuna deduzione.
      addClue(puzzle, null, "noOneNear", { targetId: objectTypeTargetId("window") });
      const chain = computeHintChain(puzzle, new Map());
      assertEqual(chain[0].type, "forcedPlacement");
      assertEqual(chain[0].characterId, a.id);
      const ids = chain[0].involvedClues.map((c) => c.id);
      assert(ids.includes(inRoomClue.id), "l'indizio inRoom deve comparire: è la vera causa della deduzione");
      assertEqual(chain[0].involvedClues.length, 1, "l'indizio sulla finestra (vero per verità vacua) non deve comparire, non esclude nulla");
    },
  },
  {
    name: "computeHintChain: un'ondata può emettere più piazzamenti forzati insieme, non uno alla volta",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneB = addZone(puzzle.grid, "StanzaB", "#eee");
      paintCellZone(puzzle.grid, 3, 3, zoneB.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zoneB.id });
      const chain = computeHintChain(puzzle, new Map());
      assertEqual(chain.length, 2, "entrambe le deduzioni indipendenti devono comparire nella stessa ondata (stesso click)");
      assertEqual(chain[0].type, "forcedPlacement");
      assertEqual(chain[1].type, "forcedPlacement");
      const byChar = Object.fromEntries(chain.map((s) => [s.characterId, s]));
      assertEqual(byChar[a.id].row, 0);
      assertEqual(byChar[a.id].col, 0);
      assertEqual(byChar[b.id].row, 3);
      assertEqual(byChar[b.id].col, 3);
    },
  },
  {
    name: "computeHint: contraddizione diretta su un indizio generico (senza proprietario)",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const clue = addClue(puzzle, null, "noOneInRowOrCol", { axis: "row", index: 2 }); // riga 2 (indice 1, 0-based) vietata
      const result = computeHint(puzzle, new Map([[a.id, { row: 1, col: 0 }]])); // A è proprio lì
      assertEqual(result.type, "contradiction");
      assertEqual(result.cause, "clue");
      assert(result.clueIds.includes(clue.id));
    },
  },
  {
    name: "computeHintChain: jointlyDetermined quando nessun indizio singolo (né la sola regola base) è individualmente necessario",
    fn: () => {
      const puzzle = basePuzzle(4, 4);
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const c = addCharacter(puzzle, "C", "person1", true); // vittima
      const d = addCharacter(puzzle, "D", "person2");
      const zoneA = addZone(puzzle.grid, "StanzaA", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneA.id);
      const zoneB = addZone(puzzle.grid, "StanzaB", "#eee");
      paintCellZone(puzzle.grid, 1, 1, zoneB.id);
      const zoneD = addZone(puzzle.grid, "StanzaD", "#ddd");
      paintCellZone(puzzle.grid, 2, 2, zoneD.id);
      paintCellZone(puzzle.grid, 3, 3, zoneD.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zoneA.id });
      addClue(puzzle, b.id, "inRoom", { zoneId: zoneB.id });
      addClue(puzzle, d.id, "inRoom", { zoneId: zoneD.id });
      // Due copie IDENTICHE dell'indizio direzionale su D. La vittima C, forzata
      // insieme a D nella stessa ondata, viene ora mostrata PER ULTIMA (vedi il
      // test sopra) — a quel punto D è già un fatto noto, quindi la posizione
      // di C segue direttamente dalla sola regola base (nessun indizio
      // "coinvolto" da citare, vedi il test dedicato al messaggio). È invece D,
      // valutato per primo (senza ancora sapere dove sarà C), a ereditare il
      // caso "nessun indizio singolo è individualmente necessario": tolta una
      // delle due copie identiche resta comunque l'altra, e senza ENTRAMBE (né
      // la sola regola base, che con la vittima ancora ipotetica non basta a
      // ricavare la riga/colonna di D) la sua posizione resta ambigua.
      addClue(puzzle, d.id, "direction", { direction: "north", targetId: c.id });
      addClue(puzzle, d.id, "direction", { direction: "north", targetId: c.id });

      const chain = computeHintChain(puzzle, new Map());
      const cStep = chain.find((s) => s.characterId === c.id);
      const dStep = chain.find((s) => s.characterId === d.id);
      assert(cStep, "C deve comunque risultare forzata");
      assertEqual(cStep.type, "forcedPlacement");
      assertEqual(cStep.row, 3);
      assertEqual(cStep.col, 3);
      assertEqual(cStep.jointlyDetermined, false, "una volta noto D, la posizione della vittima segue dalla sola regola base");
      assertEqual(cStep.involvedClues.length, 1);
      assert(cStep.involvedClues[0].isBaseRule, "l'unico 'indizio coinvolto' per la vittima qui è la regola base, non un indizio d'autore");

      assert(dStep, "D deve comunque risultare forzato");
      assertEqual(dStep.jointlyDetermined, true);
      assertEqual(dStep.involvedClues.length, 0);
    },
  },
  {
    name: "computeHintChain: la coppia nuda {X,Y} forza Z anche quando il resto del caso è troppo complesso per la ricerca esaustiva, con involvedGroups popolato",
    fn: () => {
      const puzzle = basePuzzle(8, 8);
      const x = addCharacter(puzzle, "X", "person1");
      const y = addCharacter(puzzle, "Y", "person2");
      const z = addCharacter(puzzle, "Z", "person1"); // nessun indizio proprio decisivo da solo
      // 5 personaggi completamente liberi: una volta piazzati X, Y e Z, restano
      // 5 righe/colonne libere per loro -> P(5,5)*P(5,5) = 14400 combinazioni
      // possibili per la sola ricerca esaustiva, ben oltre HINT_MAX_SOLUTIONS.
      // Il forward-checking velocizza la ricerca ma non riduce QUANTE soluzioni
      // esistono davvero, quindi questa parte del caso resta onestamente
      // "troppo complessa" anche con le nuove tecniche.
      ["W1", "W2", "W3", "W4", "W5"].forEach((n) => addCharacter(puzzle, n, "person1"));

      const zoneShared = addZone(puzzle.grid, "StanzaCondivisa", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zoneShared.id);
      paintCellZone(puzzle.grid, 1, 1, zoneShared.id);
      addClue(puzzle, x.id, "inRoom", { zoneId: zoneShared.id });
      addClue(puzzle, y.id, "inRoom", { zoneId: zoneShared.id });
      // Z è confinata (via sedie, non una seconda zona sulla stessa cella) a
      // esattamente (0,0) e (2,2): la coppia nuda {X,Y} le toglie (0,0),
      // lasciandole solo (2,2) — una deduzione che la sola propagazione a
      // singolo personaggio (senza la tecnica dei sottoinsiemi) non potrebbe
      // mai fare, e che prima di questa estensione non sarebbe mai emersa in
      // un caso dove la ricerca esaustiva risulta "troppo complessa".
      placeObject(puzzle.grid, "chair", 0, 0);
      placeObject(puzzle.grid, "chair", 2, 2);
      addClue(puzzle, z.id, "onObjectType", { objectTypeId: "chair" });

      const chain = computeHintChain(puzzle, new Map());
      const zStep = chain.find((s) => s.characterId === z.id);
      assert(zStep, "Z deve risultare forzata grazie alla coppia nuda {X,Y}");
      assertEqual(zStep.type, "forcedPlacement");
      assertEqual(zStep.row, 2);
      assertEqual(zStep.col, 2);
      assert(zStep.involvedGroups && zStep.involvedGroups.length > 0, "il passo deve spiegare l'interazione tra personaggi (coppia nuda), non solo indizi singoli");
      const group = zStep.involvedGroups[0];
      assertEqual([...group.characterNames].sort().join(","), [x.name, y.name].sort().join(","));
      const last = chain[chain.length - 1];
      assertEqual(last.type, "tooComplex", "il resto (i 5 personaggi liberi) deve restare onestamente 'troppo complesso' invece di inventare altro");
    },
  },
];
