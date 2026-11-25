// English text of the clue glossary (src/glossary/): Italian source -> English.
export default {
  // example world (the stock cast: Anna, Bruno and Carla are translated in en/tutorial.js)
  Dario: "David",
  Salotto: "Lounge",
  Studio: "Study",
  Bagno: "Bathroom",

  // families
  "Per cominciare": "Getting started",
  "Le idee che servono per leggere qualsiasi indizio.": "The ideas you need to read any clue.",
  "Accanto, tra, di fronte": "Next to, between, facing",
  "Dove sta un personaggio rispetto a oggetti e ad altre persone.": "Where a character stands relative to objects and other people.",
  Direzioni: "Directions",
  "Nord, sud, est, ovest: a quale distanza e rispetto a chi.": "North, south, east, west: how far, and relative to whom.",
  "Righe e colonne": "Rows and columns",
  "Indizi che parlano delle righe (R1, R2…) e delle colonne (C1, C2…).": "Clues about rows (R1, R2…) and columns (C1, C2…).",
  Stanze: "Rooms",
  "In quale stanza si trova un personaggio e con chi la condivide.": "Which room a character is in and who shares it.",
  "Fatti sulla scena": "Facts about the scene",
  "Indizi generali: non riguardano un personaggio solo, ma tutta la scena.":
    "General clues: they are not about one character, but about the whole scene.",
  "Treno e grattacielo": "Train and skyscraper",
  "Casi con più mappe in una: vagoni affiancati (treno) o piani impilati (grattacielo). Ogni piano si guarda da solo, e due persone sono vicine fra piani diversi solo per scale e ascensore.":
    "Cases with several maps in one: wagons side by side (train) or floors stacked up (skyscraper). Each floor is read on its own, and two people on different floors are next to each other only through stairs or a lift.",
  "Combinare gli indizi": "Combining clues",
  "Come unire due indizi in uno.": "How to join two clues into one.",

  // concepts
  "La regola di base": "The basic rule",
  "In ogni caso c'è una sola persona per riga e una sola per colonna. Appena un personaggio è collocato, le altre caselle della sua riga e della sua colonna sono escluse per tutti (le segna la ×). La vittima, inoltre, si trova sempre in una stanza con una sola altra persona: l'assassino.":
    "In every case there is exactly one person per row and one per column. As soon as a character is placed, the other cells of their row and column are ruled out for everyone (marked with ×). The victim, besides, is always in a room with exactly one other person: the murderer.",
  "Gli indizi servono a stringere ulteriormente: qui sotto, ogni esempio mostra in verde le caselle che restano possibili.":
    "Clues narrow things down further: below, each example shows in green the cells that stay possible.",
  "{a}, {b} e {c}: tre persone, tre righe e tre colonne diverse.":
    "{a}, {b} and {c}: three people, three different rows and three different columns.",
  "Il bersaglio di un indizio": "A clue's target",
  "Molti indizi parlano di un «bersaglio»: può essere un personaggio, un singolo oggetto (una pianta precisa), una stanza, oppure «qualsiasi» oggetto di un tipo (una qualunque pianta, una qualunque porta). Con «qualsiasi» basta che l'indizio sia vero per uno qualunque di quegli oggetti.":
    "Many clues talk about a “target”: a character, one specific object (a particular plant), a room, or “any” object of a type (any plant, any door). With “any”, the clue only has to hold for one of those objects.",
  "Una persona collocata e un oggetto contano come bersagli allo stesso modo: l'indizio guarda dove si trovano.":
    "A placed person and an object count as targets in the same way: the clue looks at where they are.",
  "Il riquadro «no»": "The “no” box",
  "Accanto a ogni indizio c'è una casella «no»: la spunti e l'indizio si legge al contrario. «È accanto a una pianta» diventa «Non è accanto a una pianta». Vale per qualsiasi tipo di indizio, per questo non esiste un tipo separato per ogni negazione.":
    "Next to every clue there is a “no” box: tick it and the clue reads the other way round. “Is next to a plant” becomes “Is not next to a plant”. It works for any clue type, which is why there is no separate type for each negation.",
  "Una stanza come bersaglio": "A room as the target",
  "Se il bersaglio è una stanza, «accanto» vuol dire accanto a un suo muro, ma da fuori: si sta in una casella che tocca la stanza senza farne parte. Chi si trova dentro la stanza non vale.":
    "If the target is a room, “next to” means next to one of its walls, but from outside: you stand on a cell that touches the room without being part of it. Someone inside the room doesn't count.",

  // near
  "Il personaggio sta in una casella confinante (sopra, sotto, a destra o a sinistra) con il bersaglio. Le diagonali non contano. Una porta o una finestra è un pezzo di muro tra due caselle: vale chi sta in una di quelle due caselle, anche se sono in stanze diverse.":
    "The character stands on a cell touching the target (above, below, left or right). Diagonals don't count. A door or a window is a piece of wall between two cells: it counts for whoever stands in either of those two cells, even if they are in different rooms.",
  "Conta solo la stanza del bersaglio: la casella a destra della pianta, oltre il muro, è nel Salotto e non vale.":
    "Only the target's own room counts: the cell to the right of the plant, beyond the wall, is in the Lounge and doesn't count.",
  "Il personaggio sta in una delle quattro caselle in diagonale rispetto al bersaglio. A differenza di «accanto», le stanze qui non contano.":
    "The character stands on one of the four cells diagonal to the target. Unlike “next to”, rooms don't matter here.",
  "Il personaggio sta proprio sopra un oggetto di quel tipo. Si può stare solo su ciò che è basso e piatto: tappeti, sedie, sgabelli, letti, panche, troni, pozze di fango e cavalli (di un cavallo si dice «in sella a»). Non su uno scaffale o un tavolo.":
    "The character stands right on an object of that type. You can only stand on things that are low and flat: rugs, chairs, stools, beds, benches, thrones, mud puddles and horses (on a horse you are “riding” it). Not on a shelf or a table.",
  "Per ogni tipo di oggetto che c'è sulla mappa (un tavolo, una pianta, un animale…) almeno una persona sta accanto a uno di quel tipo. Porte e finestre non contano.":
    "For every type of object on the map (a table, a plant, an animal…) at least one person stands next to one of that type. Doors and windows don't count.",
  "Il personaggio sta su una casella con un sigillo. Il sigillo di Anubi vuole chi ci sta da solo nella sua stanza, quello di Ra vuole chi ci sta in compagnia: l'indizio dice solo su quale dei due sta (o su uno qualsiasi).":
    "The character stands on a cell with a seal. The seal of Anubis wants whoever stands there to be alone in their room, the seal of Ra wants company: the clue only says which of the two they are on (or any of them).",
  "Il personaggio è seduto: su una sedia, uno sgabello, o su qualunque altra seduta. A differenza di «si trova su un oggetto di un certo tipo», non serve dire quale. Un tappeto non è una seduta: ci si sta sopra in piedi, non ci si siede.":
    "The character is seated: on a chair, a stool, or any other seat. Unlike “is on an object of a certain type”, you don't have to say which. A rug is not a seat: you stand on it, you don't sit on it.",
  "Il personaggio sta sulla stessa riga (o colonna) dei due bersagli, in una casella strettamente compresa tra loro. Non basta essere «da qualche parte in mezzo»: serve la linea retta. Se un bersaglio è una stanza, il personaggio sta tra quella stanza e l'altro bersaglio, mai dentro la stanza.":
    "The character is on the same row (or column) as the two targets, on a cell strictly between them. Being “somewhere in the middle” isn't enough: it has to be in a straight line. If a target is a room, the character is between that room and the other target, never inside the room.",
  "Il personaggio è più vicino al primo bersaglio che al secondo. La distanza si conta in passi orizzontali e verticali (niente diagonali). A pari distanza l'indizio è falso.":
    "The character is closer to the first target than to the second. Distance is counted in horizontal and vertical steps (no diagonals). At equal distance the clue is false.",
  "La linea di confine passa nel mezzo: le caselle equidistanti non valgono.":
    "The dividing line runs through the middle: cells at equal distance don't count.",
  "Il personaggio sta sulla stessa riga o sulla stessa colonna del bersaglio, a qualunque distanza: si «guardano» in linea retta.":
    "The character is on the same row or the same column as the target, at any distance: they “look at” each other in a straight line.",
  "Con un altro personaggio come bersaglio non può mai valere: due persone non possono condividere riga o colonna. Si usa con gli oggetti.":
    "With another character as the target it can never hold: two people can't share a row or column. It is used with objects.",
  "Il personaggio è accanto al bersaglio e nessun altro lo è: se un'altra persona fosse accanto alla lampada, l'indizio sarebbe falso.":
    "The character is next to the target and nobody else is: if another person were next to the lamp, the clue would be false.",

  // direction
  "Il personaggio sta a una certa direzione rispetto al bersaglio. Con una distanza («2 colonne a est») conta solo quella colonna (o riga), qualunque sia l'altra coordinata. Senza distanza, basta stare da quella parte, a qualunque distanza.":
    "The character lies in a given direction from the target. With a distance (“2 columns east”) only that column (or row) counts, whatever the other coordinate. Without a distance, being on that side at any distance is enough.",
  "Non dice chi: dice che c'è qualcuno, a quella direzione e distanza dal personaggio. Si può restringere a chi ha una certa caratteristica (un uomo, una donna, chi è accanto a un oggetto…).":
    "It doesn't say who: it says there is someone, in that direction and at that distance from the character. It can be narrowed to people with a certain trait (a man, a woman, someone next to an object…).",
  "Il personaggio è quello più a nord (o sud, est, ovest) di tutti, oppure della sua stanza. Può valere solo tra chi ha una certa caratteristica. Una persona a pari altezza con lui lo rende falso.":
    "The character is the northernmost (or southernmost, easternmost, westernmost) of everyone, or of their room. It can apply only among people with a certain trait. Someone level with them makes it false.",

  // lines
  "Il personaggio sta nella riga o nella colonna indicata. Si conta da 1, come le etichette ai bordi della griglia.":
    "The character is in the row or column given. Counting starts at 1, like the labels around the grid.",
  "La riga o la colonna del personaggio ha un numero pari (o dispari), contando da 1 come le etichette R1, R2… e C1, C2…":
    "The character's row or column has an even (or odd) number, counting from 1 like the labels R1, R2… and C1, C2…",
  "Il personaggio sta nella stessa riga (o colonna) del bersaglio. Con un oggetto come bersaglio è utile; con un altro personaggio non può mai valere, perché due persone non condividono riga o colonna.":
    "The character is on the same row (or column) as the target. Useful with an object as the target; with another character it can never hold, because two people never share a row or column.",
  "Come «condivide riga/colonna con», ma con più bersagli: basta condividerla con uno qualsiasi.":
    "Like “shares row/column with”, but with several targets: sharing it with any one of them is enough.",
  "Il personaggio sta nella riga (o colonna) subito accanto a quella del bersaglio: né la stessa, né più lontana.":
    "The character is in the row (or column) right next to the target's: not the same one, not further away.",
  "Il personaggio sta in una casella con un muro su almeno un lato: la parete fra due stanze, quella fra una stanza e l'esterno (o una casella vuota) o il bordo della mappa. Le caselle in mezzo a una stanza o a un'area aperta non lo sono.":
    "The character is on a cell with a wall on at least one side: the wall between two rooms, the one between a room and the outside (or an empty cell), or the border of the map. Cells in the middle of a room or of an open area are not.",
  "Il personaggio sta in uno dei quattro angoli della mappa.": "The character is in one of the four corners of the map.",

  // rooms
  "Il personaggio si trova nella stanza indicata, in una qualsiasi delle sue caselle.":
    "The character is in the given room, on any one of its cells.",
  "Il personaggio è nella stessa stanza di un altro. Non importa dove, né se ci sono altre persone: conta solo la stanza.":
    "The character is in the same room as someone else. Where exactly doesn't matter, nor whether other people are there: only the room counts.",
  "La stanza del personaggio confina (condivide un lato) con quella indicata. Il personaggio non può trovarsi nella stanza stessa, né in una stanza che la tocca solo di punta.":
    "The character's room borders (shares a side with) the given one. The character can't be in that room itself, nor in a room that only touches it at a corner.",
  "Il personaggio sta in un angolo della sua stanza: una casella dove il perimetro della stanza gira ad angolo retto. Diverso da «in un angolo» della mappa, che riguarda solo le quattro caselle d'angolo della griglia.":
    "The character is in a corner of their room: a cell where the room's outline turns a right angle. Different from “in a corner” of the map, which only concerns the four corner cells of the grid.",
  "Il personaggio ha una certa caratteristica (è seduto su una sedia, è un uomo, è accanto a un oggetto…) e nessun altro, in tutta la mappa, ce l'ha. Se anche una sola altra persona è su una sedia, l'indizio è falso.":
    "The character has a certain trait (sitting on a chair, being a man, being next to an object…) and nobody else on the whole map has it. If even one other person is on a chair, the clue is false.",
  "Con «no» diventa «non è l'unica persona…»: o il personaggio non ha quella caratteristica, o ce l'ha anche qualcun altro.":
    "With “no” it becomes “is not the only person…”: either the character lacks the trait, or somebody else has it too.",
  "Il personaggio è solo nella sua stanza: nessun altro la occupa. Si può indicare anche una stanza precisa.":
    "The character is alone in their room: nobody else is in it. A specific room can be given too.",
  "Il personaggio è nella stessa stanza di quella persona e con nessun altro: stanno in due, soli.":
    "The character is in the same room as that person and nobody else: just the two of them.",
  "Se anche {name} fosse in Cucina, l'indizio sarebbe falso.": "If {name} were also in the Kitchen, the clue would be false.",
  "Il personaggio è nella stanza con una sola altra persona, e quella persona ha una certa caratteristica (è un uomo, una donna, è seduta, accanto a un oggetto…), senza dire chi sia.":
    "The character is in a room with exactly one other person, and that person has a certain trait (is a man, a woman, is seated, next to an object…), without saying who.",
  "Nella stanza del personaggio c'è almeno un'altra persona con quella caratteristica. A differenza di «sola con…», può esserci anche altra gente.":
    "In the character's room there is at least one other person with that trait. Unlike “alone with…”, other people may be there too.",

  // scene
  "Nessuno, tra tutti i personaggi, si trova in quella stanza.": "Nobody, out of all the characters, is in that room.",
  "In quella stanza c'è una persona sola: né nessuna, né due o più.":
    "There is exactly one person in that room: not none, not two or more.",
  "Nessun personaggio sta nella riga o nella colonna indicata: quella linea resta vuota.":
    "No character is in the given row or column: that line stays empty.",
  "Nessuno sta accanto al bersaglio. Come sempre, «accanto» non include le diagonali.":
    "Nobody is next to the target. As always, “next to” doesn't include diagonals.",
  "Esattamente due persone stanno accanto al bersaglio: né una sola, né di più. Se il bersaglio è un tipo di oggetto (un tavolo) vale uno qualsiasi, oppure lo stesso per tutte se lo scegli.":
    "Exactly two people stand next to the target: not just one, not more. If the target is a type of object (a table), any of them counts, or the same one for everybody if you choose that.",
  "Una sola persona sta accanto al bersaglio: né nessuna, né due o più.":
    "Exactly one person is next to the target: not none, not two or more.",
  "Due persone precise si trovano nella stessa stanza (il resto della scena non importa).":
    "Two specific people are in the same room (the rest of the scene doesn't matter).",
  "Un certo numero di stanze sono vuote (oppure occupate): si contano le stanze, non le persone.":
    "A certain number of rooms are empty (or occupied): rooms are counted, not people.",
  "Le stanze vuote sono esattamente quel numero, e hanno tutte lo stesso numero di caselle.":
    "The empty rooms are exactly that many, and all have the same number of cells.",
  "Qui Cucina e Bagno hanno 6 caselle ciascuna; Salotto ne ha 4 e Studio 9.":
    "Here Kitchen and Bathroom have 6 cells each; Lounge has 4 and Study 9.",
  "Le stanze in cui si trovano due persone hanno lo stesso numero di caselle (possono anche essere la stessa stanza).":
    "The rooms two people are in have the same number of cells (it can even be the same room).",
  "Cucina e Bagno hanno 6 caselle; Salotto ne ha 4.": "Kitchen and Bathroom have 6 cells; Lounge has 4.",
  "Nessuno, in tutta la mappa o in una stanza precisa, ha quella caratteristica (seduto, accanto a un oggetto…). Si può restringere a uomini o a donne.":
    "Nobody, on the whole map or in one specific room, has that trait (seated, next to an object…). It can be limited to men or to women.",

  // logic
  "Due indizi qualsiasi uniti da un «oppure»: basta che sia vero uno dei due (o entrambi). Si sceglie il tipo e i parametri di ciascuno, come per un indizio normale.":
    "Any two clues joined by an “or”: it is enough for one of them (or both) to hold. You pick the type and parameters of each, as for a normal clue.",

  "Il tempo verbale": "The verb tense",
  "Tutti gli indizi di un caso sono scritti nello stesso tempo: al presente, al passato o al futuro. Lo sceglie chi crea il caso con un solo menu nell'editor, e cambia le parole ma non il significato. «Vicino» non si usa mai: si dice sempre «accanto».":
    "All the clues of a case are written in the same tense: present, past or future. Whoever creates the case picks it with a single menu in the editor; it changes the words, not the meaning. “Near” is never used: it is always “next to”.",
  "«È accanto a una pianta» · «Era accanto a una pianta» · «Sarà accanto a una pianta»":
    "“Is next to a plant” · “Was next to a plant” · “Will be next to a plant”",
  "Qui «accanto alla Cucina» significa le caselle del Salotto e dello Studio che confinano con la Cucina, non quelle della Cucina stessa.":
    "Here “next to the Kitchen” means the cells of the Lounge and the Study that border the Kitchen, not those of the Kitchen itself.",
  "Una finestra è un pezzo di muro e separa due caselle: il personaggio è in una delle due, anche se sono in stanze diverse. Se è sul bordo della mappa (o dall'altra parte c'è una casella bloccata), vale solo la casella utilizzabile.":
    "A window is a piece of wall and separates two cells: the character is in one of them, even if they are in different rooms. If it is on the edge of the map (or there is a blocked cell on the other side), only the usable cell counts.",
  "La finestra nel muro tra Cucina e Salotto vale per le due caselle ai suoi lati; quella sul bordo in alto vale solo per la sua casella.":
    "The window in the wall between Kitchen and Lounge counts for the two cells on its sides; the one on the top edge counts only for its own cell.",

  // page
  "Glossario degli indizi": "Clue glossary",
  "Ogni tipo di indizio, spiegato in parole semplici e con un piccolo esempio da guardare. Cerca un termine, o scorri per famiglia.":
    "Every clue type, explained in plain words with a small example to look at. Search for a term, or browse by family.",
  "Cerca un indizio (es. «accanto», «stanza», «riga»…)": "Search a clue (e.g. “next to”, “room”, “row”…)",
  "Cerca un indizio": "Search a clue",
  "Famiglie di indizi": "Clue families",
  "Nessun indizio corrisponde alla ricerca.": "No clue matches your search.",
  "{n} risultati": "{n} results",
  "{n} voci": "{n} entries",
  "Come leggere gli esempi": "How to read the examples",
  "Ogni esempio è un piccolo caso vero, con mappa, stanze, oggetti e personaggi. Per gli indizi su un personaggio, le caselle verdi sono tutte quelle in cui {name} potrebbe trovarsi: sono calcolate dal gioco stesso, con le stesse regole che usa per controllare le soluzioni. Gli indizi generali, invece, sono mostrati in due scene: una in cui sono veri e una in cui no.":
    "Each example is a small real case, with a map, rooms, objects and characters. For clues about a character, the green cells are all the places {name} could be: they are worked out by the game itself, with the same rules it uses to check solutions. General clues, instead, are shown in two scenes: one where they hold and one where they don't.",
  "Verde: le caselle in cui {name} può stare perché l'indizio sia vero.": "Green: the cells where {name} can be for the clue to be true.",
  "×: caselle già escluse dalla regola «una persona per riga e per colonna», a causa di chi è già collocato.":
    "×: cells already ruled out by the “one person per row and column” rule, because of who is already placed.",
  "Tratteggio dorato: l'oggetto o la persona a cui si riferisce l'indizio.": "Golden dashes: the object or person the clue refers to.",
  "Indizio generale": "General clue",
  "Non riguarda un personaggio solo: è un fatto sulla scena.": "It isn't about one character only: it is a fact about the scene.",
  "Come compare nel gioco": "How it appears in the game",
  "Attenzione: ": "Careful: ",
  "✓ Vero": "✓ True",
  "✗ Falso": "✗ False",
  "La stessa scena in due disposizioni: nella prima l'indizio è vero, nella seconda no.":
    "The same scene in two arrangements: in the first the clue holds, in the second it doesn't.",
  "Qui {name} può stare: l'indizio è vero.": "{name} can be here: the clue is true.",
  "Qui {name} può ancora stare.": "{name} can still be here.",
  "Esclusa: riga o colonna di una persona già collocata.": "Ruled out: row or column of someone already placed.",
  "Il bersaglio dell'indizio.": "The clue's target.",

  // links to the glossary elsewhere
  "Glossario degli indizi — Murdoku": "Clue glossary — Murdoku",
  // sea and land
  "Mare e navi": "Sea and ships",
  "Pirati: chi è in mare (su una nave o nell'Acqua) e chi è a terra.":
    "Pirates: who is at sea (on a ship or in the Water) and who is on land.",
  "Il personaggio è in mare: su una nave oppure nell'Acqua. Ogni nave è una stanza a sé e l'Acqua è una stanza sola, anche quando le navi la interrompono. «A terra» è il contrario: qualsiasi altro posto.":
    "The character is at sea: on a ship or in the Water. Every ship is a room of its own and the Water is a single room, even when ships cut it in pieces. “On land” is the opposite: any other place.",
  "Il personaggio non sta su una nave: può essere nell'Acqua o a terra. Detto in positivo, «è su una nave» vale per qualsiasi nave, senza dire quale.":
    "The character is not on a ship: they can be in the Water or on land. Said positively, “is on a ship” holds for any ship, without saying which.",
  Acqua: "Water",
  "Il personaggio sta nel luogo che ha quel nome. Sulla mappa quel luogo compare come «???»: il suo nome si deduce, e il caso si risolve con tutte le assegnazioni dei nomi che gli indizi permettono. Il personaggio sta sempre in un solo luogo: per nominarne un altro serve un altro indizio.":
    "The character is in the place that has that name. On the map that place shows as “???”: its name is to be deduced, and the case is solved over every way of giving the names that the clues allow. The character is always in one place: naming another one takes another clue.",
  Cocco: "Coconut",
  Deserta: "Desert",
  Pietà: "Pity",
  Sussurri: "Whispers",
  Sloop: "Sloop",
  Spiaggia: "Beach",
  Galeone: "Galleon",
  // floors
  Attico: "Penthouse",
  "Primo piano": "First floor",
  "Il caso è un grattacielo: più piani impilati. Questo indizio dice che le due persone sono sullo stesso piano (dove, in quel piano, non importa).":
    "The case is a skyscraper: several floors stacked up. This clue says that the two people are on the same floor (where, on that floor, does not matter).",
  "In un grattacielo c'è al massimo una persona per riga, per colonna e anche in verticale: stessa casella di piani diversi.":
    "In a skyscraper there is at most one person per row, per column and also vertically: the same cell on different floors.",
  "Confronta il piano di due persone: più in alto, più in basso, oppure subito sopra o subito sotto (il piano vicino). Il piano più in alto è il primo della lista.":
    "Compares the floors of two people: higher, lower, or just above or just below (the neighbouring floor). The highest floor is the first of the list.",
  "La persona è in un piano preciso, scelto per nome.": "The person is on one particular floor, chosen by name.",
  Merci: "Freight",
  Passeggeri: "Passengers",
  "Il treno: vagoni affiancati": "The train: wagons side by side",
  "In un caso a treno la mappa è divisa in vagoni, uno accanto all'altro. Le colonne sono numerate da un vagone all'altro (C1…C6) e ognuna ha una sola persona; le righe si ripetono in ogni vagone (R1…R4) e in ciascun vagone c'è al massimo una persona per riga.":
    "In a train case the map is divided into wagons, one next to the other. The columns are numbered from one wagon to the next (C1…C6) and each has just one person; the rows repeat in every wagon (R1…R4) and in each wagon there is at most one person per row.",
  "La riga R3 del primo vagone resta libera anche se un'altra persona sta nella R3 del secondo: sono due righe diverse. Un ruolo può valere «uno solo per vagone o piano».":
    "Row R3 of the first wagon stays free even if someone else is in R3 of the second: they are two different rows. A role can be “only one per wagon or floor”.",
  "Il grattacielo: piani impilati": "The skyscraper: stacked floors",
  "Ogni piano è una mappa con le sue righe e colonne (R1, R2… e C1, C2… in ciascun piano). Le persone si dispongono come in un cubo: al massimo una per riga, una per colonna di ogni piano e una per «pilastro», cioè la stessa casella (stessa riga e colonna) su tutti i piani.":
    "Each floor is a map with its own rows and columns (R1, R2… and C1, C2… on every floor). People are arranged like in a cube: at most one per row, one per column of each floor and one per “pillar”, that is the same cell (same row and column) on all floors.",
  "Le caselle sopra e sotto una persona, nella stessa posizione degli altri piani, sono escluse per tutti.":
    "The cells above and below a person, in the same position on the other floors, are ruled out for everybody.",
  "Accanto all'ascensore": "Next to the lift",
  "L'ascensore è un pozzo che attraversa tutti i piani, sempre nella stessa casella (stessa riga e stessa colonna di ciascun piano). Chi sta sull'ascensore di un piano è accanto all'ascensore di tutti gli altri piani; su ogni piano è accanto all'ascensore anche chi sta in una casella vicina.":
    "The lift is a shaft that crosses all floors, always in the same cell (same row and same column of each floor). Whoever stands on the lift of one floor is next to the lift of all the other floors; on each floor, whoever stands in a neighbouring cell is next to the lift too.",
  "In un pozzo c'è al massimo una persona, e fra piani diversi non si è mai vicini senza ascensore o scale.":
    "A shaft holds at most one person, and on different floors one is never next to anything without the lift or the stairs.",
  "Accanto alle scale": "Next to the stairs",
  "Le scale collegano una casella di un piano a una casella del piano sopra o sotto. Chi sta su un'estremità è accanto all'altra estremità; in ogni piano è accanto alle scale anche chi sta in una casella vicina.":
    "The stairs join a cell of one floor to a cell of the floor above or below. Whoever stands on one end is next to the other end; on each floor, whoever stands in a neighbouring cell is next to the stairs too.",
  "Il più a nord di tutti i piani": "The northernmost of all floors",
  "Con «su tutta la mappa» si confrontano tutti i piani: la riga di ciascun piano (la prima è la più a nord) e le colonne. Chi ha la stessa riga in un altro piano è pari: l'indizio è falso. Lo stesso confronto vale per «a nord di tutti i…» di un ruolo.":
    "With “on the whole map” all floors are compared: the row of each floor (the first is the northernmost) and the columns. Whoever has the same row on another floor is level: the clue is false. The same comparison holds for “north of all the…” of a role.",
  "Il più a nord del suo piano": "The northernmost of their floor",
  "Con «nel suo piano» si guardano solo le persone dello stesso piano: negli altri piani nessuno conta.":
    "With “on their floor” only the people on the same floor are looked at: on the other floors nobody counts.",
  "Riga e colonna in ogni piano": "Row and column on every floor",
  "In un grattacielo ogni piano ha le sue righe e colonne: «riga 2» è la seconda riga di ciascun piano, «colonna 3» la terza colonna di ciascun piano. Lo stesso vale per pari e dispari.":
    "In a skyscraper every floor has its own rows and columns: “row 2” is the second row of each floor, “column 3” the third column of each floor. The same goes for odd and even.",
  // hidden roles
  "Nobili, villici, cavalieri, fuorilegge, mansioni: ruoli che nessuno dichiara e che si deducono.":
    "Nobles, villagers, knights, outlaws, tasks: roles that nobody declares and that are deduced.",
  "Il personaggio ha un certo ruolo (nobile, villico, cavaliere, fuorilegge, una mansione…). Nessuno dice i ruoli apertamente: si deducono dagli indizi, e un ruolo decide dove si può stare (le aree nobili ♛, le caselle riservate). Si può anche dire solo «ha un ruolo».":
    "The character has a certain role (noble, villager, knight, outlaw, a task…). Nobody states the roles openly: they are deduced from the clues, and a role decides where one may stand (the noble areas ♛, the reserved cells). The clue may also say just “has a role”.",
  "Il personaggio sta da quella parte (a nord, a sud, a est o a ovest) di tutte le altre persone con un certo ruolo: ognuna, senza eccezioni, e ce ne dev'essere almeno una.":
    "The character is on that side (north, south, east or west) of all the other people with a certain role: every one, without exception, and there must be at least one.",
  "Almeno una persona con quel ruolo sta sopra un oggetto di quel tipo (o, con «tutte», lo fanno tutte).":
    "At least one person with that role stands on an object of that type (or, with “all”, every one of them does).",
  "Tutte le persone con un certo ruolo, senza eccezioni, si trovano in quella stanza.":
    "Everybody with a certain role, without exception, is in that room.",
};
