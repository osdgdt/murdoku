// English text of the clue glossary (src/glossary/): Italian source -> English.
export default {
  // example world
  "Cucina": "Kitchen", "Salotto": "Lounge", "Studio": "Study", "Bagno": "Bathroom",

  // families
  "Per cominciare": "Getting started",
  "Le idee che servono per leggere qualsiasi indizio.": "The ideas you need to read any clue.",
  "Vicino, tra, di fronte": "Near, between, facing",
  "Dove sta un personaggio rispetto a oggetti e ad altre persone.": "Where a character stands relative to objects and other people.",
  "Direzioni": "Directions",
  "Nord, sud, est, ovest: a quale distanza e rispetto a chi.": "North, south, east, west: how far, and relative to whom.",
  "Righe e colonne": "Rows and columns",
  "Indizi che parlano delle righe (R1, R2…) e delle colonne (C1, C2…).": "Clues about rows (R1, R2…) and columns (C1, C2…).",
  "Stanze": "Rooms",
  "In quale stanza si trova un personaggio e con chi la condivide.": "Which room a character is in and who shares it.",
  "Fatti sulla scena": "Facts about the scene",
  "Indizi generali: non riguardano un personaggio solo, ma tutta la scena.": "General clues: they are not about one character, but about the whole scene.",
  "Combinare gli indizi": "Combining clues",
  "Come unire due indizi in uno.": "How to join two clues into one.",
  "Indizi obsoleti": "Obsolete clues",
  "Funzionano ancora nei casi già scritti, ma oggi si ottengono combinando indizi più generali.": "They still work in cases already written, but today you get the same effect by combining more general clues.",

  // concepts
  "La regola di base": "The basic rule",
  "In ogni caso c'è una sola persona per riga e una sola per colonna. Appena un personaggio è collocato, le altre caselle della sua riga e della sua colonna sono escluse per tutti (le segna la ×). La vittima, inoltre, si trova sempre in una stanza con una sola altra persona: l'assassino.": "In every case there is exactly one person per row and one per column. As soon as a character is placed, the other cells of their row and column are ruled out for everyone (marked with ×). The victim, besides, is always in a room with exactly one other person: the murderer.",
  "Gli indizi servono a stringere ulteriormente: qui sotto, ogni esempio mostra in verde le caselle che restano possibili.": "Clues narrow things down further: below, each example shows in green the cells that stay possible.",
  "Anna, Bruno e Carla: tre persone, tre righe e tre colonne diverse.": "Anna, Bruno and Carla: three people, three different rows and three different columns.",
  "Il bersaglio di un indizio": "A clue's target",
  "Molti indizi parlano di un «bersaglio»: può essere un personaggio, un singolo oggetto (una pianta precisa), una stanza, oppure «qualsiasi» oggetto di un tipo (una qualunque pianta, una qualunque porta). Con «qualsiasi» basta che l'indizio sia vero per uno qualunque di quegli oggetti.": "Many clues talk about a “target”: a character, one specific object (a particular plant), a room, or “any” object of a type (any plant, any door). With “any”, the clue only has to hold for one of those objects.",
  "Una persona collocata e un oggetto contano come bersagli allo stesso modo: l'indizio guarda dove si trovano.": "A placed person and an object count as targets in the same way: the clue looks at where they are.",
  "Il riquadro «no»": "The “no” box",
  "Accanto a ogni indizio c'è una casella «no»: la spunti e l'indizio si legge al contrario. «È accanto a una pianta» diventa «Non è accanto a una pianta». Vale per qualsiasi tipo di indizio, per questo non esiste un tipo separato per ogni negazione.": "Next to every clue there is a “no” box: tick it and the clue reads the other way round. “Is next to a plant” becomes “Is not next to a plant”. It works for any clue type, which is why there is no separate type for each negation.",
  "Una stanza come bersaglio": "A room as the target",
  "Se il bersaglio è una stanza, «accanto» vuol dire accanto a una qualsiasi delle sue caselle: vale anche dall'altra parte del muro. È l'unico caso in cui «accanto a» supera il confine di una stanza.": "If the target is a room, “next to” means next to any one of its cells: it holds from the other side of the wall too. It is the only case where “next to” crosses a room boundary.",

  // near
  "Il personaggio sta in una casella confinante (sopra, sotto, a destra o a sinistra) con il bersaglio. Le diagonali non contano. Per una porta o una finestra, che stanno sul bordo di una casella, vale anche chi è in quella stessa casella.": "The character stands on a cell touching the target (above, below, left or right). Diagonals don't count. For a door or a window, which sit on the edge of a cell, someone standing in that very cell counts too.",
  "Conta solo la stanza del bersaglio: la casella a destra della pianta, oltre il muro, è nel Salotto e non vale.": "Only the target's own room counts: the cell to the right of the plant, beyond the wall, is in the Lounge and doesn't count.",
  "Il personaggio sta in una delle quattro caselle in diagonale rispetto al bersaglio. A differenza di «accanto», le stanze qui non contano.": "The character stands on one of the four cells diagonal to the target. Unlike “next to”, rooms don't matter here.",
  "Il personaggio sta proprio sopra un oggetto di quel tipo. Si può stare solo su ciò che è basso e piatto: tappeti, sedie e sgabelli. Non su uno scaffale o un tavolo.": "The character stands right on an object of that type. You can only stand on things that are low and flat: rugs, chairs and stools. Not on a shelf or a table.",
  "Il personaggio era seduto: su una sedia, uno sgabello, o su qualunque altro oggetto occupabile. A differenza di «si trova su un oggetto di un certo tipo», non serve dire quale.": "The character was seated: on a chair, a stool, or any other object you can stand on. Unlike “is on an object of a certain type”, you don't have to say which.",
  "Il personaggio sta sulla stessa riga (o colonna) dei due bersagli, in una casella strettamente compresa tra loro. Non basta essere «da qualche parte in mezzo»: serve la linea retta.": "The character is on the same row (or column) as the two targets, on a cell strictly between them. Being “somewhere in the middle” isn't enough: it has to be in a straight line.",
  "Il personaggio è più vicino al primo bersaglio che al secondo. La distanza si conta in passi orizzontali e verticali (niente diagonali). A pari distanza l'indizio è falso.": "The character is closer to the first target than to the second. Distance is counted in horizontal and vertical steps (no diagonals). At equal distance the clue is false.",
  "La linea di confine passa nel mezzo: le caselle equidistanti non valgono.": "The dividing line runs through the middle: cells at equal distance don't count.",
  "Il personaggio sta sulla stessa riga o sulla stessa colonna del bersaglio, a qualunque distanza: si «guardano» in linea retta.": "The character is on the same row or the same column as the target, at any distance: they “look at” each other in a straight line.",
  "Con un altro personaggio come bersaglio non può mai valere: due persone non possono condividere riga o colonna. Si usa con gli oggetti.": "With another character as the target it can never hold: two people can't share a row or column. It is used with objects.",
  "Il personaggio è accanto al bersaglio e nessun altro lo è: se un'altra persona fosse accanto alla lampada, l'indizio sarebbe falso.": "The character is next to the target and nobody else is: if another person were next to the lamp, the clue would be false.",

  // direction
  "Il personaggio sta a una certa direzione rispetto al bersaglio. Con una distanza («2 colonne a est») conta solo quella colonna (o riga), qualunque sia l'altra coordinata. Senza distanza, basta stare da quella parte, a qualunque distanza.": "The character lies in a given direction from the target. With a distance (“2 columns east”) only that column (or row) counts, whatever the other coordinate. Without a distance, being on that side at any distance is enough.",
  "Non dice chi: dice che c'è qualcuno, a quella direzione e distanza dal personaggio. Si può restringere a chi aveva una certa caratteristica (un uomo, una donna, chi era accanto a un oggetto…).": "It doesn't say who: it says there is someone, in that direction and at that distance from the character. It can be narrowed to people with a certain trait (a man, a woman, someone next to an object…).",
  "Il personaggio è quello più a nord (o sud, est, ovest) di tutti, oppure della sua stanza. Può valere solo tra chi aveva una certa caratteristica. Una persona a pari altezza con lui lo rende falso.": "The character is the northernmost (or southernmost, easternmost, westernmost) of everyone, or of their room. It can apply only among people with a certain trait. Someone level with them makes it false.",

  // lines
  "Il personaggio sta nella riga o nella colonna indicata. Si conta da 1, come le etichette ai bordi della griglia.": "The character is in the row or column given. Counting starts at 1, like the labels around the grid.",
  "La riga o la colonna del personaggio ha un numero pari (o dispari), contando da 1 come le etichette R1, R2… e C1, C2…": "The character's row or column has an even (or odd) number, counting from 1 like the labels R1, R2… and C1, C2…",
  "Il personaggio sta nella stessa riga (o colonna) del bersaglio. Con un oggetto come bersaglio è utile; con un altro personaggio non può mai valere, perché due persone non condividono riga o colonna.": "The character is on the same row (or column) as the target. Useful with an object as the target; with another character it can never hold, because two people never share a row or column.",
  "Come «condivide riga/colonna con», ma con più bersagli: basta condividerla con uno qualsiasi.": "Like “shares row/column with”, but with several targets: sharing it with any one of them is enough.",
  "Il personaggio sta nella riga (o colonna) subito accanto a quella del bersaglio: né la stessa, né più lontana.": "The character is in the row (or column) right next to the target's: not the same one, not further away.",
  "Il personaggio sta in uno dei quattro angoli della mappa.": "The character is in one of the four corners of the map.",

  // rooms
  "Il personaggio si trova nella stanza indicata, in una qualsiasi delle sue caselle.": "The character is in the given room, on any one of its cells.",
  "Il personaggio è nella stessa stanza di un altro. Non importa dove, né se ci sono altre persone: conta solo la stanza.": "The character is in the same room as someone else. Where exactly doesn't matter, nor whether other people are there: only the room counts.",
  "La stanza del personaggio confina (condivide un lato) con quella indicata. Il personaggio non può trovarsi nella stanza stessa, né in una stanza che la tocca solo di punta.": "The character's room borders (shares a side with) the given one. The character can't be in that room itself, nor in a room that only touches it at a corner.",
  "Il personaggio sta in un angolo della sua stanza: una casella dove il perimetro della stanza gira ad angolo retto. Diverso da «in un angolo» della mappa, che riguarda solo le quattro caselle d'angolo della griglia.": "The character is in a corner of their room: a cell where the room's outline turns a right angle. Different from “in a corner” of the map, which only concerns the four corner cells of the grid.",
  "Il personaggio è solo nella sua stanza: nessun altro la occupa. Si può indicare anche una stanza precisa.": "The character is alone in their room: nobody else is in it. A specific room can be given too.",
  "Il personaggio è nella stessa stanza di quella persona e con nessun altro: stanno in due, soli.": "The character is in the same room as that person and nobody else: just the two of them.",
  "Se Carla fosse anche lei in Cucina, l'indizio sarebbe falso.": "If Carla were in the Kitchen too, the clue would be false.",
  "Il personaggio è nella stanza con una sola altra persona, e quella persona ha una certa caratteristica (è un uomo, una donna, era seduta, accanto a un oggetto…), senza dire chi sia.": "The character is in a room with exactly one other person, and that person has a certain trait (is a man, a woman, was seated, next to an object…), without saying who.",
  "Nella stanza del personaggio c'è almeno un'altra persona con quella caratteristica. A differenza di «sola con…», può esserci anche altra gente.": "In the character's room there is at least one other person with that trait. Unlike “alone with…”, other people may be there too.",

  // scene
  "Nessuno, tra tutti i personaggi, si trova in quella stanza.": "Nobody, out of all the characters, is in that room.",
  "In quella stanza c'è una persona sola: né nessuna, né due o più.": "There is exactly one person in that room: not none, not two or more.",
  "Nessun personaggio sta nella riga o nella colonna indicata: quella linea resta vuota.": "No character is in the given row or column: that line stays empty.",
  "Nessuno sta accanto al bersaglio. Come sempre, «accanto» non include le diagonali.": "Nobody is next to the target. As always, “next to” doesn't include diagonals.",
  "Una sola persona sta accanto al bersaglio: né nessuna, né due o più.": "Exactly one person is next to the target: not none, not two or more.",
  "Due persone precise si trovano nella stessa stanza (il resto della scena non importa).": "Two specific people are in the same room (the rest of the scene doesn't matter).",
  "Un certo numero di stanze erano vuote (oppure occupate): si contano le stanze, non le persone.": "A certain number of rooms were empty (or occupied): rooms are counted, not people.",
  "Le stanze vuote sono esattamente quel numero, e hanno tutte lo stesso numero di caselle.": "The empty rooms are exactly that many, and all have the same number of cells.",
  "Qui Cucina e Bagno hanno 6 caselle ciascuna; Salotto ne ha 4 e Studio 9.": "Here Kitchen and Bathroom have 6 cells each; Lounge has 4 and Study 9.",
  "Le stanze in cui si trovano due persone hanno lo stesso numero di caselle (possono anche essere la stessa stanza).": "The rooms two people are in have the same number of cells (it can even be the same room).",
  "Cucina e Bagno hanno 6 caselle; Salotto ne ha 4.": "Kitchen and Bathroom have 6 cells; Lounge has 4.",
  "Nessuno, in tutta la mappa o in una stanza precisa, aveva quella caratteristica (era seduto, accanto a un oggetto…). Si può restringere a uomini o a donne.": "Nobody, on the whole map or in one specific room, had that trait (was seated, next to an object…). It can be limited to men or to women.",

  // logic
  "Due indizi qualsiasi uniti da un «oppure»: basta che sia vero uno dei due (o entrambi). Si sceglie il tipo e i parametri di ciascuno, come per un indizio normale.": "Any two clues joined by an “or”: it is enough for one of them (or both) to hold. You pick the type and parameters of each, as for a normal clue.",

  // legacy
  "«Non è accanto a». Oggi si scrive «è accanto a» con il riquadro «no».": "“Is not next to”. Today you write “is next to” with the “no” box ticked.",
  "Accanto a uno di due bersagli. Oggi si ottiene con «o uno o l'altro» tra due indizi «è accanto a».": "Next to one of two targets. Today you get it with “either/or” between two “is next to” clues.",
  "A nord, sud, est o ovest del bersaglio, a qualunque distanza. Oggi è «a nord/sud/est/ovest di» lasciando vuota la distanza.": "North, south, east or west of the target, at any distance. Today it is “north/south/east/west of” with the distance left empty.",
  "«Non si trova nella stanza». Oggi: «si trova nella stanza» con il riquadro «no».": "“Is not in the room”. Today: “is in the room” with the “no” box ticked.",
  "«Non si trova nella stessa stanza di». Oggi: «nella stessa stanza di» con il riquadro «no».": "“Is not in the same room as”. Today: “in the same room as” with the “no” box ticked.",
  "Sola con la vittima nella stanza: l'assassino. Oggi si usa «sola con (un personaggio)» indicando la vittima.": "Alone with the victim in the room: the murderer. Today you use “alone with (a character)” and pick the victim.",
  "L'unica persona in una stanza precisa. Oggi: «sola nella stanza» scegliendo la stanza.": "The only person in a specific room. Today: “alone in the room”, choosing the room.",
  "Un certo numero di stanze erano vuote. Oggi: «N stanze erano piene/vuote» scegliendo «vuote».": "A certain number of rooms were empty. Today: “N rooms were full/empty”, choosing “empty”.",

  // page
  "Guida": "Guide",
  "Glossario degli indizi": "Clue glossary",
  "Ogni tipo di indizio, spiegato in parole semplici e con un piccolo esempio da guardare. Cerca un termine, o scorri per famiglia.": "Every clue type, explained in plain words with a small example to look at. Search for a term, or browse by family.",
  "Cerca un indizio (es. «accanto», «stanza», «riga»…)": "Search a clue (e.g. “next to”, “room”, “row”…)",
  "Cerca un indizio": "Search a clue",
  "Famiglie di indizi": "Clue families",
  "Nessun indizio corrisponde alla ricerca.": "No clue matches your search.",
  "{n} risultati": "{n} results",
  "{n} voci": "{n} entries",
  "Come leggere gli esempi": "How to read the examples",
  "Ogni esempio è un piccolo caso vero, con mappa, stanze, oggetti e personaggi. Per gli indizi su un personaggio, le caselle verdi sono tutte quelle in cui Anna potrebbe trovarsi: sono calcolate dal gioco stesso, con le stesse regole che usa per controllare le soluzioni. Gli indizi generali, invece, sono mostrati in due scene: una in cui sono veri e una in cui no.": "Each example is a small real case, with a map, rooms, objects and characters. For clues about a character, the green cells are all the places Anna could be: they are worked out by the game itself, with the same rules it uses to check solutions. General clues, instead, are shown in two scenes: one where they hold and one where they don't.",
  "Verde: le caselle in cui Anna può stare perché l'indizio sia vero.": "Green: the cells where Anna can be for the clue to be true.",
  "×: caselle già escluse dalla regola «una persona per riga e per colonna», a causa di chi è già collocato.": "×: cells already ruled out by the “one person per row and column” rule, because of who is already placed.",
  "Tratteggio dorato: l'oggetto o la persona a cui si riferisce l'indizio.": "Golden dashes: the object or person the clue refers to.",
  "Indizio generale": "General clue",
  "Non riguarda un personaggio solo: è un fatto sulla scena.": "It isn't about one character only: it is a fact about the scene.",
  "Obsoleto": "Obsolete",
  "Come compare nel gioco": "How it appears in the game",
  "Attenzione: ": "Careful: ",
  "✓ Vero": "✓ True",
  "✗ Falso": "✗ False",
  "La stessa scena in due disposizioni: nella prima l'indizio è vero, nella seconda no.": "The same scene in two arrangements: in the first the clue holds, in the second it doesn't.",
  "Qui {name} può stare: l'indizio è vero.": "{name} can be here: the clue is true.",
  "Qui {name} può ancora stare.": "{name} can still be here.",
  "Esclusa: riga o colonna di una persona già collocata.": "Ruled out: row or column of someone already placed.",
  "Il bersaglio dell'indizio.": "The clue's target.",

  // links to the glossary elsewhere
  "📖 Glossario degli indizi": "📖 Clue glossary",
  "Glossario degli indizi — Murdoku": "Clue glossary — Murdoku",
  "Ogni tipo di indizio spiegato con un piccolo esempio.": "Every clue type explained with a small example.",
  "Glossario": "Glossary",
};
