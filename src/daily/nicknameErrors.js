// The words for the nickname's refusals (dailyMath.validateNickname and dailyStore.chooseNickname answer with these
// codes): shared by the daily challenge and by the "Publish" window of the editor.
import { t } from "../i18n/i18n.js";
import { NICKNAME_MIN, NICKNAME_MAX } from "./dailyMath.js";

export const NICKNAME_ERRORS = {
  "too-short": () => t("Il nickname deve avere almeno {n} caratteri.", { n: NICKNAME_MIN }),
  "too-long": () => t("Il nickname può avere al massimo {n} caratteri.", { n: NICKNAME_MAX }),
  characters: () => t("Sono ammessi lettere, cifre, spazi e . _ ' -"),
  taken: () => t("Questo nickname è già preso: scegline un altro."),
};
