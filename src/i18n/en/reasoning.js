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
};
