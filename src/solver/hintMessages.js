import { zoneOfCell } from "../model/grid.js";
import { describeClue } from "../model/clueTypes.js";
import { t } from "../i18n/i18n.js";

export const CLUES_CONTRADICTORY_MSG = t("Gli indizi di questo caso non ammettono nessuna soluzione: controlla il puzzle nell'editor.");
export const INCONCLUSIVE_MSG = t("Non riesco a determinare un suggerimento affidabile in questo momento.");
export const MULTI_CULPRIT_MSG = t("Uno dei piazzamenti attuali è in conflitto con gli indizi, ma non riesco a isolarlo con certezza.");
export const TOO_COMPLEX_MSG = t(
  "Ci sono troppe possibilità da esaminare per dare un suggerimento sicuro: aggiungi qualche piazzamento o indizio in più."
);
export const ALREADY_COMPLETE_MSG = t("Hai già piazzato tutti i personaggi compatibili con gli indizi attuali.");
export const NO_DEDUCTION_MSG = t(
  "Con le informazioni attuali non c'è ancora nessuna deduzione certa: prova a piazzare qualcosa o rileggi gli indizi."
);
export const NO_FURTHER_DEDUCTION_MSG = t(
  "Ho verificato a fondo: da qui in poi esistono più soluzioni diverse, tutte valide secondo gli indizi attuali, quindi non c'è nient'altro da dedurre con certezza. Prova a piazzare qualcosa per ipotesi, o rileggi gli indizi."
);

export function buildForcedMessage(puzzle, character, row, col) {
  const zoneId = zoneOfCell(puzzle.grid, row, col);
  const zone = zoneId && puzzle.grid.zones.find((z) => z.id === zoneId);
  const where = zone ? t(' (nella zona "{name}")', { name: zone.name }) : "";
  // The victim rarely has clues of her own (she doesn't act) — by the time
  // her placement is forced, it's almost always because every other
  // row/column is already spoken for, not because of a specific clue about
  // her. Framed accordingly, distinct from the generic "compatible with the
  // clues" wording used for everyone else.
  if (character.isVictim) {
    return t("{name} deve trovarsi nell'unica casella rimasta libera{where}.", { name: character.name, where });
  }
  return t("{name} deve trovarsi nella cella evidenziata{where}: è l'unica posizione compatibile con gli indizi attuali.", {
    name: character.name,
    where,
  });
}

export function buildEliminatedMessage(character) {
  return t("{name} non può trovarsi nella cella evidenziata, secondo gli indizi attuali.", { name: character.name });
}

export function buildCulpritMessage(puzzle, culpritIds) {
  const names = culpritIds.map((id) => puzzle.characters.find((c) => c.id === id)?.name || "?");
  return names.length === 1
    ? t("{v} sembra nella posizione sbagliata: rimuovendo quel piazzamento, gli indizi tornano soddisfacibili.", { v: names[0] })
    : t("Uno di questi piazzamenti sembra sbagliato: {v}. Prova a rimuoverne uno e verifica di nuovo.", { v: names.join(", ") });
}

export function clueOwnerLabel(puzzle, clue) {
  const owner = clue.characterId ? puzzle.characters.find((c) => c.id === clue.characterId) : null;
  return owner ? `${owner.name}: ${describeClue(clue, puzzle)}` : describeClue(clue, puzzle);
}

export function buildDirectViolationMessage(puzzle, violatedClues) {
  const labels = violatedClues.map((clue) => clueOwnerLabel(puzzle, clue));
  return labels.length === 1
    ? t("Un indizio è già violato dai piazzamenti attuali: {v}", { v: labels[0] })
    : t("Alcuni indizi sono già violati dai piazzamenti attuali: {v}", { v: labels.join(" — ") });
}
