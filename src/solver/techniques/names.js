// What the person reads about each reasoning of the catalogue (catalog.js): its name and a sentence that says what it does.
// Kept apart from the catalogue because the solver runs in a worker, which must not load the dictionary; the pages (the
// editor's difficulty line, the hints, the glossary) read it here. Every text goes through t() with a literal, so that
// `npm run i18n` can see it.
import { t } from "../../i18n/i18n.js";
import { difficultyLabel } from "../../model/puzzle.js";

const TEXTS = {
  clueFilter: {
    name: () => t("Filtro d'indizio"),
    text: () =>
      t(
        "Un indizio che parla solo di questo personaggio esclude le celle in cui non può stare; se lo mette in una riga o in una colonna, o da solo in una stanza, quelle celle sono escluse anche per tutti gli altri."
      ),
  },
  rowColTaken: {
    name: () => t("Riga e colonna occupate"),
    text: () => t("Chi è già piazzato occupa la sua riga e la sua colonna: nessun altro può stare lì."),
  },
  onlyCandidate: {
    name: () => t("Unico candidato"),
    text: () => t("Al personaggio resta una sola cella possibile: deve stare lì."),
  },
  relationalKnown: {
    name: () => t("Indizio con riferimento noto"),
    text: () => t("L'indizio nomina qualcuno già piazzato, quindi si sa esattamente dove cercare."),
  },
  sceneUnary: {
    name: () => t("Indizio sulla scena che esclude celle"),
    text: () =>
      t(
        "Un indizio come «è l'unica accanto a una rastrelliera» esclude da solo le celle in cui il personaggio non potrebbe mai soddisfarlo."
      ),
  },
  roomCapacity: {
    name: () => t("Posti nella stanza"),
    text: () =>
      t(
        "La vittima deve dividere la stanza con un'altra persona: se nessun altro può arrivare in una stanza, la vittima non può stare lì."
      ),
  },
  victimRule: {
    name: () => t("Regola della vittima"),
    text: () => t("La vittima divide la stanza con una sola persona: nessun terzo può entrare in quella stanza."),
  },
  roomCount: {
    name: () => t("Conteggio nelle stanze"),
    text: () =>
      t(
        "Gli indizi che contano le persone in una stanza, in una riga, in una colonna o intorno a un punto escludono le celle che li romperebbero."
      ),
  },
  regionCount: {
    name: () => t("Conteggio su un gruppo di caselle"),
    text: () =>
      t(
        "«Esattamente N persone sono accanto a un tavolo (o in una stanza)»: si guardano i modi di mettere quelle persone, una per riga e per colonna. Una casella che non compare in nessun modo resta vuota; una che compare in tutti è occupata."
      ),
  },
  witness: {
    name: () => t("Qualcuno c'è"),
    text: () =>
      t(
        "«Una donna era su un giaciglio»: solo chi può davvero essere quella persona conta. Se può essere una sola, è lei; se la casella possibile è una sola, qualcuno è sicuramente lì."
      ),
  },
  occupiedCell: {
    name: () => t("Casella occupata da qualcuno"),
    text: () =>
      t(
        "Se sai che qualcuno sta su una casella, anche senza sapere chi, nessun altro può stare nella sua riga o nella sua colonna; e se solo un personaggio può arrivarci, è lui."
      ),
  },
  lastInLine: {
    name: () => t("Ultima cella della riga o della colonna"),
    text: () =>
      t(
        "Ogni riga e ogni colonna ha una persona: se una riga (o una colonna) può essere raggiunta da un solo personaggio, quel personaggio sta lì."
      ),
  },
  lineConfined: {
    name: () => t("Riga o colonna obbligata"),
    text: () =>
      t(
        "Se tutte le caselle possibili di un personaggio stanno nella stessa riga (o colonna), lui è in quella riga: gli altri non possono usarla."
      ),
  },
  pairSupport: {
    name: () => t("Indizio con un altro personaggio aperto"),
    text: () =>
      t(
        "Un indizio lega il personaggio a un altro non ancora piazzato: una casella è esclusa se l'altro non ha nessuna casella che renda vero l'indizio."
      ),
  },
  lineGroups: {
    name: () => t("Righe o colonne di gruppo"),
    text: () =>
      t(
        "Se più personaggi hanno caselle possibili in tante sole righe (o colonne) quanti sono, quelle righe sono loro: gli altri non possono usarle. Vale anche al contrario: se tante righe (o colonne) sono raggiungibili solo da altrettanti personaggi, quei personaggi stanno lì."
      ),
  },
  hiddenGroups: {
    name: () => t("Caselle riservate"),
    text: () =>
      t(
        "Se tante caselle dove c'è sicuramente qualcuno quanti sono i personaggi che possono raggiungerle sono raggiungibili solo da loro, quei personaggi stanno lì: non possono stare altrove."
      ),
  },
  subsets: {
    name: () => t("Gruppo di personaggi"),
    text: () =>
      t(
        "Se alcuni personaggi hanno insieme esattamente tante celle possibili quanti sono, quelle celle sono loro: gli altri non possono usarle."
      ),
  },
  mutualSupport: {
    name: () => t("Indizio tra tre personaggi aperti"),
    text: () =>
      t(
        "Un indizio lega il personaggio a due altri non ancora piazzati: una cella è esclusa se i due non hanno nessuna coppia di celle che renda vero l'indizio."
      ),
  },
  alternatives: {
    name: () => t("Le due alternative"),
    text: () => t("In un indizio «oppure», una cella è esclusa se non va bene in nessuna delle due alternative."),
  },
  globalCount: {
    name: () => t("Indizi sull'intera scena"),
    text: () =>
      t(
        "Gli indizi sul numero di stanze vuote, sulle loro dimensioni o su chi ha una certa caratteristica escludono le celle che li romperebbero."
      ),
  },
  finishedBoard: {
    name: () => t("Disposizioni complete"),
    text: () =>
      t(
        "Con pochi personaggi ancora da piazzare si provano tutti i modi di sistemarli: una cella è esclusa se in nessuno di essi gli indizi «a tavolo finito» restano veri."
      ),
  },
  hypothesis: {
    name: () => t("Ipotesi e contraddizione"),
    text: () => t("Si prova una cella: se i ragionamenti precedenti portano a una contraddizione, quella cella è esclusa."),
  },
  nestedHypothesis: {
    name: () => t("Ipotesi dentro un'ipotesi"),
    text: () => t("Come l'ipotesi semplice, ma ne servono due una dentro l'altra."),
  },
  exhaustive: {
    name: () => t("Provare le possibilità"),
    text: () => t("Nessun ragionamento basta: la soluzione si trova provando le possibilità una per una."),
  },
};

// A small worked example of each reasoning (the glossary shows it).
const EXAMPLES = {
  clueFilter: () => t("«Anna è in cucina» e la cucina ha solo due caselle libere: Anna può stare solo in quelle due."),
  rowColTaken: () =>
    t("Bruno è già nella riga 2 e nella colonna 3: nessun altro può stare in nessuna casella di quella riga o di quella colonna."),
  onlyCandidate: () => t("Dopo gli altri ragionamenti a Carla resta una sola casella in cui gli indizi sono veri: è lì."),
  relationalKnown: () =>
    t(
      "«Bruno è in diagonale rispetto ad Anna» e Anna è già piazzata: Bruno può stare solo nelle caselle in diagonale rispetto a lei, se sono libere."
    ),
  sceneUnary: () =>
    t(
      "«Carla è l'unica persona accanto alla rastrelliera»: le caselle da cui non potrebbe mai esserlo (lontane da una rastrelliera) sono escluse per lei."
    ),
  roomCapacity: () =>
    t("La cantina ha una sola casella libera e nessun altro può arrivarci: la vittima non può stare in cantina, perché lì sarebbe sola."),
  victimRule: () =>
    t("Nella sala ci sono già la vittima e Anna: nessun altro può entrare nella sala, perché la vittima ha una sola compagna."),
  roomCount: () =>
    t(
      "«Nessuno è in biblioteca»: tutte le caselle della biblioteca sono escluse per tutti. «Una sola persona è accanto al camino»: una seconda lì non può stare."
    ),
  regionCount: () =>
    t(
      "«Esattamente due persone sono accanto al tavolo» e le caselle accanto al tavolo sono tre, di cui due nella stessa colonna: la terza è occupata sicuramente, e una delle altre due."
    ),
  witness: () =>
    t(
      "«Una donna era nella veranda»: solo Anna è una donna, quindi Anna è in una casella della veranda. Se la veranda ha una casella sola, qualcuno è sicuramente lì."
    ),
  occupiedCell: () =>
    t("Qualcuno è sicuramente nella casella della riga 1, colonna 1: nessun altro può stare nel resto di quella riga e di quella colonna."),
  lastInLine: () =>
    t(
      "Ci sono sei personaggi su una griglia 6×6, quindi ogni riga ha una persona. Nella riga 4 solo Carla può ancora arrivare: Carla è nella riga 4."
    ),
  lineConfined: () => t("Le caselle possibili di Anna sono tutte nella riga 2: Anna è in quella riga, e nessun altro può usare la riga 2."),
  pairSupport: () =>
    t(
      "«Anna è 3 colonne a est di Bruno», e nessuno dei due è piazzato: Anna può stare solo dove Bruno ha una casella tre colonne a ovest."
    ),
  lineGroups: () => t("Anna e Bruno hanno caselle possibili solo nelle righe 2 e 3: quelle due righe sono loro, e Carla non può usarle."),
  hiddenGroups: () =>
    t(
      "In due caselle c'è sicuramente qualcuno, e solo Anna e Bruno possono ancora arrivarci: Anna e Bruno stanno in quelle due caselle, e le loro altre caselle sono escluse."
    ),
  subsets: () => t("Anna e Bruno possono stare solo in due stesse caselle: quelle due caselle sono loro, e Carla non può usarle."),
  mutualSupport: () =>
    t(
      "«Anna è sulla stessa riga o colonna di Bruno o di Carla», e nessuno dei tre è piazzato: si guardano insieme le celle di Bruno e di Carla per vedere dove Anna può davvero stare."
    ),
  alternatives: () => t("«Anna è in cucina oppure nel salone»: una casella che non è né in cucina né nel salone è esclusa per Anna."),
  globalCount: () =>
    t(
      "«Esattamente due stanze sono vuote»: una casella che riempirebbe una terza stanza vuota, rendendo le stanze vuote troppo poche, è esclusa."
    ),
  finishedBoard: () =>
    t(
      "Restano da piazzare Carla e Dario. Provando le poche disposizioni possibili, «Carla è da sola con Dario» è vero solo con Carla in una certa casella: altrove sarebbe falso."
    ),
  hypothesis: () =>
    t(
      "Si prova a mettere Anna in una casella: da lì Bruno non ha più nessuna casella. È una contraddizione, quindi Anna non può stare lì."
    ),
  nestedHypothesis: () =>
    t(
      "Si prova un'ipotesi e, dentro quell'ipotesi, un'altra: solo allora si arriva a una contraddizione, e la seconda ipotesi si rivela impossibile."
    ),
  exhaustive: () =>
    t("Quando nessun ragionamento basta, si provano le possibilità una per una fino a trovare l'unica che rispetta tutti gli indizi."),
};

export const techniqueExample = (id) => EXAMPLES[id]?.() ?? "";
export const techniqueName = (id) => TEXTS[id]?.name() ?? id;
export const techniqueText = (id) => TEXTS[id]?.text() ?? "";
// "Facile", "Media", "Difficile", "Esperto"
export const levelLabel = (level) => difficultyLabel(level);
