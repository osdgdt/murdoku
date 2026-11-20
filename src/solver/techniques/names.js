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

export const techniqueName = (id) => TEXTS[id]?.name() ?? id;
export const techniqueText = (id) => TEXTS[id]?.text() ?? "";
// "Facile", "Media", "Difficile", "Esperto"
export const levelLabel = (level) => difficultyLabel(level);
