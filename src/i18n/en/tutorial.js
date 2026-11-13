// English text of the tutorial page (src/tutorial/): Italian source -> English.
export default {
  // the worked case (the cast has English names too: suspects in alphabetical order, the victim with a V)
  Anna: "Alice",
  Bruno: "Ben",
  Carla: "Clara",
  Valerio: "Victor",
  Biblioteca: "Library",
  Tutorial: "Tutorial",

  // page
  "Come si gioca": "How to play",
  "Come si gioca — Murdoku": "How to play — Murdoku",
  "🎓 Come si gioca": "🎓 How to play",
  "Un caso piccolo risolto passo per passo, per imparare le regole.": "A small case solved step by step, to learn the rules.",
  "Impara Murdoku in cinque minuti: le regole, un caso piccolo risolto passo per passo e qualche trucco.":
    "Learn Murdoku in five minutes: the rules, a small case solved step by step and a few tricks.",

  // rules
  "Le regole in breve": "The rules in brief",
  "Murdoku è un po' Sudoku e un po' giallo: devi collocare tutte le persone su una griglia e scoprire chi ha ucciso la vittima.":
    "Murdoku is part Sudoku, part detective story: you place everybody on a grid and find out who killed the victim.",
  "Una persona per riga e per colonna. ": "One person per row and column. ",
  "Su ogni riga (R1, R2…) e su ogni colonna (C1, C2…) c'è al massimo una persona.":
    "Every row (R1, R2…) and every column (C1, C2…) holds at most one person.",
  "Gli indizi dicono dove può stare ciascuno. ": "Clues say where each person can be. ",
  "Ogni sospettato ha uno o più indizi: accanto a un oggetto, in una certa stanza, davanti a una finestra…":
    "Every suspect has one or more clues: next to an object, in a certain room, in front of a window…",
  "L'assassino è nella stanza della vittima. ": "The murderer is in the victim's room. ",
  "La vittima si trova sempre in una stanza con esattamente un'altra persona: quella persona è l'assassino.":
    "The victim is always in a room with exactly one other person: that person is the murderer.",
  "Se {name} sta qui, nessun altro può stare nelle caselle con la X: sono nella sua riga o nella sua colonna.":
    "If {name} is here, nobody else can be in the cells with an X: they are in their row or their column.",

  // the case
  "{name} (la vittima)": "{name} (the victim)",
  "La vittima è stata trovata senza vita. Ci sono tre sospettati e un indizio per ciascuno; non c'è nessun indizio sulla vittima. Sulla pianta ci sono due stanze, con qualche mobile e una finestra.":
    "The victim has been found dead. There are three suspects and one clue for each; there is no clue about the victim. The plan has two rooms, a few pieces of furniture and a window.",

  // steps
  "Risolviamolo passo per passo": "Let's solve it step by step",
  "Ecco come ragionerebbe un giocatore. Ogni passo si ricava solo dagli indizi e dalle regole.":
    "This is how a player would reason. Every step follows from the clues and the rules alone.",
  "{name}: {what}": "{name}: {what}",
  "una sola casella": "a single cell",
  "{n} caselle": "{n} cells",
  "Dove può stare ciascuno?": "Where can each person be?",
  "Ogni indizio, da solo, esclude molte caselle. I cerchietti con l'iniziale mostrano le caselle ancora possibili per ogni sospettato.":
    "Each clue alone rules out many cells. The little circles with an initial show the cells still possible for each suspect.",
  "Chi ha una sola casella?": "Who has only one cell?",
  "{name} può stare in una sola casella, {cell}: la collochiamo lì. Dato che c'è una sola persona per riga e per colonna, segniamo con una X tutte le altre caselle della sua riga e della sua colonna.":
    "{name} can only be in one cell, {cell}: we place them there. Since there is only one person per row and column, we put an X on all the other cells of their row and column.",
  "Poi {name}": "Then {name}",
  "Infine {name}": "Finally {name}",
  "Con le X segnate, {name} ha una sola casella rimasta: {cell}. Collochiamo {name} e segniamo la sua riga e la sua colonna.":
    "With the X marks in place, {name} has a single cell left: {cell}. We place {name} and mark their row and column.",
  "{cells} è esclusa: è nella riga o nella colonna di chi era già collocato.":
    "{cells} is ruled out: it is in the row or column of someone already placed.",
  "{cells} sono escluse: sono nella riga o nella colonna di chi era già collocato.":
    "{cells} are ruled out: they are in the row or column of someone already placed.",
  "Dove sta la vittima?": "Where is the victim?",
  "Nessun indizio parla della vittima: si trova nell'unica casella rimasta, quella senza nessuna X: {cell}.":
    "No clue is about the victim: the victim is in the only cell left, the one without an X: {cell}.",
  "Chi è l'assassino?": "Who is the murderer?",
  "La vittima è sempre in una stanza con esattamente un'altra persona. Nella stanza {room} con la vittima c'è solo {name}: è {name} ad averla uccisa.":
    "The victim is always in a room with exactly one other person. In the {room} with the victim there is only {name}: {name} is the one who did it.",
  "Caso risolto!": "Case solved!",

  // objects
  "Gli oggetti": "Objects",
  "Alcuni oggetti si possono occupare, altri no. Porte e finestre stanno sul bordo di una casella e non bloccano nessuno.":
    "Some objects can be occupied, others cannot. Doors and windows sit on the edge of a cell and block nobody.",
  "Si possono occupare": "Can be occupied",
  "Non si possono occupare": "Cannot be occupied",
  "Sul bordo di una casella": "On the edge of a cell",
  "Una finestra può stare sul bordo della griglia o tra due caselle: nel secondo caso è accanto a entrambe. Su un tappeto si sta in piedi; su sedie e sgabelli si è seduti.":
    "A window can be on the edge of the grid or between two cells: in the second case it is next to both. You stand on a rug; you sit on chairs and stools.",

  // tips
  "Qualche trucco": "A few tricks",
  "Riga per riga, colonna per colonna": "Row by row, column by column",
  "Se una riga o una colonna ha una sola casella disponibile, qualcuno deve starci, anche se non sai ancora chi.":
    "If a row or column has only one cell available, somebody must be there, even if you don't know who yet.",
  "Stanza per stanza": "Room by room",
  "Invece di chiederti dove sta ogni persona, chiediti chi può e chi non può stare in ciascuna stanza: è utile con indizi come «nessuna stanza è vuota».":
    "Instead of asking where each person is, ask who can and cannot be in each room: handy with clues like “no room is empty”.",
  "Le caselle d'intersezione": "Intersection cells",
  "Se qualcuno può occupare solo due caselle, pensale come due angoli di un rettangolo: nessun altro può occupare gli altri due angoli. Vale anche quando tutte le caselle possibili stanno su una stessa riga o colonna.":
    "If someone can only occupy two cells, think of them as two corners of a rectangle: nobody else can occupy the other two corners. This also holds when all the possible cells are in one row or column.",
  "{name} può stare solo su una delle due sedie. Qualunque sedia scelga, la sua riga o la sua colonna passa per le due caselle con la X: nessun altro può starci.":
    "{name} can only be on one of the two chairs. Whichever chair they pick, their row or column passes through the two cells with an X: nobody else can be there.",

  // using the app
  "Come si gioca nell'app": "Playing in the app",
  "Scegli un personaggio ": "Pick a character ",
  "dalla barra in alto (o premi 1-9), poi tocca la griglia.": "from the toolbar (or press 1-9), then tap the grid.",
  "Tocco rapido: ": "Quick tap: ",
  "segna una nota (un candidato) nella casella, senza confermare.": "jots a note (a candidate) in the cell, without confirming.",
  "Tieni premuto circa un secondo: ": "Press and hold for about a second: ",
  "piazza il personaggio. Le X sulla sua riga e colonna si mettono da sole, e le sue note spariscono.":
    "places the character. The X marks on their row and column appear by themselves, and their notes disappear.",
  "Tieni premuto e trascina: ": "Press, hold and drag: ",
  "applica lo strumento a più caselle in un colpo solo, ad esempio per segnare molte X.":
    "applies the tool to several cells at once, for example to mark many X.",
  "Strumenti: ": "Tools: ",
  " segna una casella, ": " marks a cell, ",
  " è la gomma, ": " is the eraser, ",
  " annulla.": " undoes.",
  "Sei bloccato? ": "Stuck? ",
  " (o il pulsante 💡 Suggerimento) spiega una deduzione certa in tre passi: prima il personaggio, poi gli indizi, infine la casella.":
    " (or the 💡 Hint button) explains a certain deduction in three steps: first the character, then the clues, finally the cell.",
  "Verifica soluzione ": "Check solution ",
  "dice solo se il caso è risolto, senza rivelare quante caselle sono giuste.":
    "only says whether the case is solved, without revealing how many cells are right.",
  "Vai ai casi": "Go to the cases",
};
