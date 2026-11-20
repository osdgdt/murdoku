// What the person reads about each reasoning of the catalogue (catalog.js): its name and a sentence that says what it does.
// Kept apart from the catalogue because the solver runs in a worker, which must not load the dictionary; the pages (the
// editor's difficulty line, the hints, the glossary) read it here. Every text goes through t() with a literal, so that
// `npm run i18n` can see it.
import { t } from "../../i18n/i18n.js";
import { difficultyLabel } from "../../model/puzzle.js";

const TEXTS = {
  clueFilter: {
    name: () => t("Filtro d'indizio"),
    text: () => t("Un indizio che parla solo di questo personaggio esclude le celle in cui non può stare."),
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
  lastInLine: {
    name: () => t("Ultima cella della riga o della colonna"),
    text: () =>
      t(
        "Ogni riga e ogni colonna ha una persona: se una riga (o una colonna) può essere raggiunta da un solo personaggio, quel personaggio sta lì."
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
    name: () => t("Indizio tra due personaggi aperti"),
    text: () =>
      t(
        "Un indizio lega personaggi non ancora piazzati: una cella è esclusa se gli altri non hanno nessuna cella che renda vero l'indizio."
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
    t("«Bruno è in diagonale rispetto ad Anna» e Anna è già in B2: Bruno può stare solo in A1, C1, A3 o C3, se sono libere."),
  roomCapacity: () =>
    t("La cantina ha una sola casella libera e nessun altro può arrivarci: la vittima non può stare in cantina, perché lì sarebbe sola."),
  victimRule: () =>
    t("Nella sala ci sono già la vittima e Anna: nessun altro può entrare nella sala, perché la vittima ha una sola compagna."),
  roomCount: () =>
    t(
      "«Nessuno è in biblioteca»: tutte le caselle della biblioteca sono escluse per tutti. «Una sola persona è accanto al camino»: una seconda lì non può stare."
    ),
  lastInLine: () =>
    t(
      "Ci sono sei personaggi su una griglia 6×6, quindi ogni riga ha una persona. Nella riga 4 solo Carla può ancora arrivare: Carla è nella riga 4."
    ),
  subsets: () => t("Anna e Bruno possono stare solo in B2 o in C3: quelle due caselle sono loro, e Carla non può usarle."),
  mutualSupport: () =>
    t(
      "«Bruno è nella stessa stanza di Anna», e nessuno dei due è ancora piazzato: Bruno può stare solo nelle stanze in cui Anna può davvero stare."
    ),
  alternatives: () => t("«Anna è in cucina oppure nel salone»: una casella che non è né in cucina né nel salone è esclusa per Anna."),
  globalCount: () =>
    t(
      "«Esattamente due stanze sono vuote»: una casella che riempirebbe una terza stanza vuota, rendendo le stanze vuote troppo poche, è esclusa."
    ),
  finishedBoard: () =>
    t(
      "Restano da piazzare Carla e Dario. Provando le poche disposizioni possibili, «Carla è da sola con Dario» è vero solo se Carla sta in B2: altrove sarebbe falso."
    ),
  hypothesis: () => t("Si prova «Anna è in B2»: da lì Bruno non ha più nessuna casella. È una contraddizione, quindi Anna non è in B2."),
  nestedHypothesis: () =>
    t(
      "Si prova «Anna è in B2» e, dentro questa ipotesi, anche «Bruno è in C3»: solo allora si arriva a una contraddizione, e si scopre che Bruno non può stare in C3 se Anna è in B2."
    ),
  exhaustive: () =>
    t("Quando nessun ragionamento basta, si provano le possibilità una per una fino a trovare l'unica che rispetta tutti gli indizi."),
};

export const techniqueExample = (id) => EXAMPLES[id]?.() ?? "";
export const techniqueName = (id) => TEXTS[id]?.name() ?? id;
export const techniqueText = (id) => TEXTS[id]?.text() ?? "";
// "Facile", "Media", "Difficile", "Esperto"
export const levelLabel = (level) => difficultyLabel(level);
