// The names and explanations of the reasonings of the human solver (src/solver/techniques/names.js).
export default {
  "Filtro d'indizio": "Clue filter",
  "Un indizio che parla solo di questo personaggio esclude le celle in cui non può stare.":
    "A clue about this character alone rules out the cells where they cannot be.",
  "Riga e colonna occupate": "Row and column taken",
  "Chi è già piazzato occupa la sua riga e la sua colonna: nessun altro può stare lì.":
    "Somebody already placed takes their row and column: nobody else can stand there.",
  "Unico candidato": "Only candidate",
  "Al personaggio resta una sola cella possibile: deve stare lì.": "The character has a single cell left: they must be there.",
  "Indizio con riferimento noto": "Clue with a known reference",
  "L'indizio nomina qualcuno già piazzato, quindi si sa esattamente dove cercare.":
    "The clue names somebody already placed, so it is known exactly where to look.",
  "Posti nella stanza": "Room for two",
  "La vittima deve dividere la stanza con un'altra persona: se nessun altro può arrivare in una stanza, la vittima non può stare lì.":
    "The victim must share a room with somebody else: if nobody else can reach a room, the victim cannot be there.",
  "Regola della vittima": "The victim rule",
  "La vittima divide la stanza con una sola persona: nessun terzo può entrare in quella stanza.":
    "The victim shares a room with exactly one person: no third person can enter that room.",
  "Conteggio nelle stanze": "Counting in rooms",
  "Gli indizi che contano le persone in una stanza, in una riga, in una colonna o intorno a un punto escludono le celle che li romperebbero.":
    "Clues that count people in a room, a row, a column or around a spot rule out the cells that would break them.",
  "Ultima cella della riga o della colonna": "Last cell of the row or column",
  "Ogni riga e ogni colonna ha una persona: se una riga (o una colonna) può essere raggiunta da un solo personaggio, quel personaggio sta lì.":
    "Every row and every column holds somebody: if only one character can still reach a row (or a column), that character is there.",
  "Gruppo di personaggi": "Group of characters",
  "Se alcuni personaggi hanno insieme esattamente tante celle possibili quanti sono, quelle celle sono loro: gli altri non possono usarle.":
    "If some characters together have exactly as many possible cells as there are of them, those cells are theirs: the others cannot use them.",
  "Indizio tra due personaggi aperti": "Clue between open characters",
  "Un indizio lega personaggi non ancora piazzati: una cella è esclusa se gli altri non hanno nessuna cella che renda vero l'indizio.":
    "A clue ties characters who are not placed yet: a cell is ruled out if the others have no cell that makes the clue true.",
  "Le due alternative": "The two alternatives",
  "In un indizio «oppure», una cella è esclusa se non va bene in nessuna delle due alternative.":
    "In an «or» clue, a cell is ruled out if it fits neither of the two alternatives.",
  "Indizi sull'intera scena": "Clues about the whole scene",
  "Gli indizi sul numero di stanze vuote, sulle loro dimensioni o su chi ha una certa caratteristica escludono le celle che li romperebbero.":
    "Clues about how many rooms are empty, their sizes or who has a certain trait rule out the cells that would break them.",
  "Disposizioni complete": "Complete arrangements",
  "Con pochi personaggi ancora da piazzare si provano tutti i modi di sistemarli: una cella è esclusa se in nessuno di essi gli indizi «a tavolo finito» restano veri.":
    "With few characters left, every way of placing them is tried: a cell is ruled out if in none of them the «finished board» clues stay true.",
  "Ipotesi e contraddizione": "Hypothesis and contradiction",
  "Si prova una cella: se i ragionamenti precedenti portano a una contraddizione, quella cella è esclusa.":
    "A cell is tried: if the earlier reasonings lead to a contradiction, that cell is ruled out.",
  "Ipotesi dentro un'ipotesi": "Hypothesis inside a hypothesis",
  "Come l'ipotesi semplice, ma ne servono due una dentro l'altra.": "Like the simple hypothesis, but two are needed, one inside the other.",
  "Provare le possibilità": "Trying the possibilities",
  "Nessun ragionamento basta: la soluzione si trova provando le possibilità una per una.":
    "No reasoning is enough: the solution is found by trying the possibilities one by one.",
  "✓ Soluzione unica · Difficoltà stimata: {level} · il ragionamento più difficile: {technique}":
    "✓ Unique solution · Estimated difficulty: {level} · hardest reasoning: {technique}",
  "Come si risolve, ragionamento per ragionamento": "How it is solved, reasoning by reasoning",
  "{count}× · il primo al passo {first}": "{count}× · the first at step {first}",
  "Livello {level}: il ragionamento più difficile è «{technique}».": "Level {level}: the hardest reasoning is «{technique}».",
  "⚠ Non sono riuscito a ottenere un caso di livello {requested}: questo è di livello {level}. Rigenera per riprovare.":
    "⚠ I could not make a {requested} case: this one is {level}. Generate again to retry.",
  "⚠ Non sono riuscito a ottenere un caso di livello {requested}: questo è più difficile. Rigenera per riprovare.":
    "⚠ I could not make a {requested} case: this one is harder. Generate again to retry.",
  "Ragionamento:": "Reasoning:",
  "«Anna è in cucina» e la cucina ha solo due caselle libere: Anna può stare solo in quelle due.":
    "«Alice is in the kitchen» and the kitchen has only two free cells: Alice can only be in those two.",
  "Bruno è già nella riga 2 e nella colonna 3: nessun altro può stare in nessuna casella di quella riga o di quella colonna.":
    "Ben is already in row 2 and column 3: nobody else can stand in any cell of that row or that column.",
  "Dopo gli altri ragionamenti a Carla resta una sola casella in cui gli indizi sono veri: è lì.":
    "After the other reasonings Clara has a single cell where the clues are true: she is there.",
  "«Bruno è in diagonale rispetto ad Anna» e Anna è già piazzata: Bruno può stare solo nelle caselle in diagonale rispetto a lei, se sono libere.":
    "«Ben is diagonal to Alice» and Alice is already placed: Ben can only be in the cells diagonal to her, if they are free.",
  "La cantina ha una sola casella libera e nessun altro può arrivarci: la vittima non può stare in cantina, perché lì sarebbe sola.":
    "The cellar has a single free cell and nobody else can get there: the victim cannot be in the cellar, because she would be alone.",
  "Nella sala ci sono già la vittima e Anna: nessun altro può entrare nella sala, perché la vittima ha una sola compagna.":
    "The victim and Alice are already in the hall: nobody else can enter the hall, because the victim has only one companion.",
  "«Nessuno è in biblioteca»: tutte le caselle della biblioteca sono escluse per tutti. «Una sola persona è accanto al camino»: una seconda lì non può stare.":
    "«Nobody is in the library»: every cell of the library is ruled out for everybody. «Only one person is next to the fireplace»: a second one cannot be there.",
  "Ci sono sei personaggi su una griglia 6×6, quindi ogni riga ha una persona. Nella riga 4 solo Carla può ancora arrivare: Carla è nella riga 4.":
    "There are six characters on a 6×6 grid, so every row holds somebody. Only Clara can still reach row 4: Clara is in row 4.",
  "Anna e Bruno possono stare solo in due stesse caselle: quelle due caselle sono loro, e Carla non può usarle.":
    "Alice and Ben can only be in the same two cells: those two cells are theirs, and Clara cannot use them.",
  "«Bruno è nella stessa stanza di Anna», e nessuno dei due è ancora piazzato: Bruno può stare solo nelle stanze in cui Anna può davvero stare.":
    "«Ben is in the same room as Alice», and neither is placed yet: Ben can only be in rooms where Alice can really be.",
  "«Anna è in cucina oppure nel salone»: una casella che non è né in cucina né nel salone è esclusa per Anna.":
    "«Alice is in the kitchen or in the hall»: a cell that is neither in the kitchen nor in the hall is ruled out for Alice.",
  "«Esattamente due stanze sono vuote»: una casella che riempirebbe una terza stanza vuota, rendendo le stanze vuote troppo poche, è esclusa.":
    "«Exactly two rooms are empty»: a cell that would fill a third empty room, leaving too few empty rooms, is ruled out.",
  "Restano da piazzare Carla e Dario. Provando le poche disposizioni possibili, «Carla è da sola con Dario» è vero solo con Carla in una certa casella: altrove sarebbe falso.":
    "Clara and David are left. Trying the few possible arrangements, «Clara is alone with David» is true only with Clara in a certain cell: elsewhere it would be false.",
  "Si prova a mettere Anna in una casella: da lì Bruno non ha più nessuna casella. È una contraddizione, quindi Anna non può stare lì.":
    "Alice is tried in a cell: from there Ben has no cell left. It is a contradiction, so Alice cannot be there.",
  "Si prova un'ipotesi e, dentro quell'ipotesi, un'altra: solo allora si arriva a una contraddizione, e la seconda ipotesi si rivela impossibile.":
    "A hypothesis is tried and, inside it, another: only then does a contradiction appear, and the second hypothesis turns out to be impossible.",
  "Quando nessun ragionamento basta, si provano le possibilità una per una fino a trovare l'unica che rispetta tutti gli indizi.":
    "When no reasoning is enough, the possibilities are tried one by one until the only one that respects every clue is found.",
  "I ragionamenti di base: ogni indizio si legge da solo, senza guardare dove sono gli altri.":
    "The basic reasonings: every clue is read on its own, without looking at where the others are.",
  "Servono più indizi insieme, oppure si guarda dove sono già gli altri e come sono fatte le stanze.":
    "Several clues are needed together, or one looks at where the others already are and how the rooms are shaped.",
  "Indizi che legano più personaggi ancora aperti, indizi «oppure» e indizi sull'intera scena.":
    "Clues that tie several open characters, «or» clues and clues about the whole scene.",
  "Nessuna deduzione diretta basta: si prova un'ipotesi e si guarda se porta a una contraddizione.":
    "No direct deduction is enough: a hypothesis is tried and one looks for a contradiction.",
  "Ragionamenti: {level}": "Reasonings: {level}",
  Esempio: "Example",
  "Qui {name} deve stare.": "{name} must be here.",
  "Qui {name} può ancora stare.": "{name} can still be here.",
  "Esclusa da questo ragionamento.": "Ruled out by this reasoning.",
  "Ciò a cui punta un indizio.": "What a clue points at.",
  "Le altre caselle erano già escluse, da un indizio o da chi è già collocato.":
    "The other cells were already ruled out, by a clue or by somebody already placed.",
  "Indizi usati:": "Clues used:",
  "Un esempio vero": "A real example",
  "Il ragionamento guarda anche: {names}.": "The reasoning also looks at: {names}.",
  "Torna all'inizio": "Back to the start",
  "Passo precedente": "Previous step",
  "Passo successivo": "Next step",
  "Vai alla fine": "Go to the end",
  Passo: "Step",
  "Passo {n} di {m}": "Step {n} of {m}",
  "Ragionamento successivo": "Next reasoning",
  "Piazzamento successivo": "Next placement",
  "▶ Riproduci": "▶ Play",
  "⏸ Pausa": "⏸ Pause",
  "Mostra le note di tutti": "Show everybody's notes",
  "Vai a questo passo nella griglia": "Go to this step on the board",
  "Prima di cominciare: ogni personaggio è una nota su ogni casella.": "Before starting: every character is a note on every cell.",
  "Si vedono solo le note del personaggio del passo: «Mostra le note di tutti» le mostra tutte.":
    "Only the notes of the character of the step are shown: «Show everybody's notes» shows them all.",
  "{name} sta nella casella evidenziata: si trova provando le possibilità.":
    "{name} is in the outlined cell: found by trying the possibilities.",
  "{name} deve stare nella casella evidenziata: è l'unica rimasta.": "{name} must be in the outlined cell: it is the only one left.",
  "{name}: {count} caselle in meno tra le sue note.": "{name}: {count} fewer cells among their notes.",
};
