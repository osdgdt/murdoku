// What the refusals of the shared case database say, in the words of the person (the codes are in
// functions/src/handlers.js and in communityStore.js). No Firebase here: the editor and the player can use it freely.
import { t } from "../i18n/i18n.js";
import { LIMITS } from "./casePolicy.js";

// What a tag is called (the tags themselves are fixed codes: casePolicy.js TAGS).
export const tagLabel = (tag) =>
  ({
    medievale: t("Medievale"),
    moderno: t("Moderno"),
    mistero: t("Mistero"),
    horror: t("Horror"),
    umorismo: t("Umorismo"),
    famiglia: t("Famiglia"),
    storico: t("Storico"),
    "fantasy-senza-magia": t("Fantasy senza magia"),
  })[tag] ?? tag;

export const LICENSE_LABELS = () => ({
  "cc-by": {
    name: t("Remix consentito (CC BY 4.0)"),
    text: t("Gli altri possono giocarlo, copiarlo e modificarlo, citando te come autore."),
  },
  "play-only": {
    name: t("Solo da giocare"),
    text: t("Gli altri possono giocarlo qui, ma non copiarlo né modificarlo: tutti i diritti restano tuoi."),
  },
});

const META_FIELD = {
  title: () => t("Il titolo deve avere da {min} a {max} caratteri.", { min: LIMITS.titleMin, max: LIMITS.titleMax }),
  blurb: () => t("Scrivi una descrizione breve (al massimo {max} caratteri).", { max: LIMITS.blurbMax }),
  lang: () => t("Scegli la lingua del caso."),
  difficulty: () => t("Scegli la difficoltà."),
  license: () => t("Scegli la licenza."),
  tags: () => t("Puoi scegliere al massimo {max} tag.", { max: LIMITS.tagsMax }),
};

// The messages for the errors of validatePublishMeta ([{ field, code }]), one per field.
export function describeMetaErrors(errors) {
  const seen = new Set();
  const out = [];
  for (const { field } of errors) {
    if (seen.has(field)) continue;
    seen.add(field);
    out.push({ field, text: (META_FIELD[field] ?? (() => t("Controlla i dati inseriti.")))() });
  }
  return out;
}

// What is wrong with the case itself (errors of validatePuzzleForPublish), as one sentence per problem.
export function describePuzzleErrors(errors) {
  return errors.map(({ code, detail }) => {
    switch (code) {
      case "no-clues":
        return t("Il caso non ha nessun indizio.");
      case "incomplete-solution":
        return t("La soluzione non è completa: dichiarala nella scheda Soluzione.");
      case "too-many-clues":
        return t("Il caso ha troppi indizi (al massimo {max}).", { max: LIMITS.clueMax });
      case "text-too-long":
        return t("Un testo del caso è troppo lungo ({field}).", { field: String(detail) });
      case "shape":
        return t("Il caso non è valido: {details}", { details: [].concat(detail).join("; ") });
      default:
        return t("Il caso non è valido.");
    }
  });
}

// One sentence for a refusal (CommunityError.reason) with its details.
export function describeReason(reason, details = {}) {
  switch (reason) {
    case "sign-in-required":
      return t("Per farlo devi accedere con Google.");
    case "no-nickname":
      return t("Scegli prima un nickname.");
    case "not-solved":
      return t("Per pubblicare un caso devi averlo risolto almeno una volta: giocalo fino alla soluzione e riprova.");
    case "invalid-meta":
      return t("Controlla i dati inseriti: titolo, descrizione, lingua, difficoltà e licenza.");
    case "invalid-puzzle":
      return t("Il caso non è valido o è incompleto.");
    case "too-big":
      return t("Il caso è troppo grande per essere pubblicato.");
    case "duplicate":
      return details.yours
        ? t("Hai già pubblicato un caso identico a questo (codice {code}).", { code: details.code ?? "" })
        : t("Esiste già un caso identico a questo.");
    case "unchanged":
      return t("Non ci sono modifiche da pubblicare: il caso è uguale alla revisione già online.");
    case "limit-per-day":
      return t("Hai raggiunto il limite di oggi ({max}): riprova domani.", { max: details.max ?? "" });
    case "limit-active":
      return t("Hai già {max} casi online: ritirane o eliminane qualcuno.", { max: details.max ?? "" });
    case "limit-revisions":
      return t("Questo caso ha raggiunto il numero massimo di revisioni ({max}).", { max: details.max ?? "" });
    case "remix-not-allowed":
      return t("L'autore di questo caso non permette di rielaborarlo.");
    case "license-immutable":
      return t("La licenza di un caso pubblicato non si può cambiare.");
    case "not-the-author":
      return t("Questo caso è stato pubblicato da un altro account.");
    case "hidden-by-moderation":
      return t("Questo caso è stato nascosto dalla moderazione.");
    case "no-such-case":
      return t("Non esiste nessun caso con questo codice.");
    case "not-available":
      return t("Non trovo questo caso: controlla il codice. Se è giusto, l'autore l'ha ritirato o è stato nascosto.");
    case "bad-body":
      return t("Il caso salvato nel database non è leggibile.");
    case "index-missing":
      return t("L'elenco si sta ancora preparando (succede per qualche minuto dopo un aggiornamento): riprova tra poco.");
    case "network":
      return t("Connessione assente o instabile: riprova tra poco.");
    case "bad-code":
      return t("Il codice non è valido.");
    default:
      return t("Qualcosa è andato storto. Riprova tra poco.");
  }
}
