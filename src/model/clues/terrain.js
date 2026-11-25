import { t } from "../../i18n/i18n.js";

// Clues about sea and land (see model/terrain.js): the rooms say what they are, the clue only says "at sea" (a ship or the
// Water) or "on a ship". "On land" is the same clue negated.
export const TERRAIN_CLUES = {
  inSea: {
    label: t("È in mare (o a terra)"),
    params: [],
    describe: () => t("È in mare."),
    negatedDescribe: () => t("È a terra."),
  },
  onShip: {
    label: t("È su una nave"),
    params: [],
    describe: () => t("È su una nave."),
    negatedDescribe: () => t("Non è su una nave."),
  },
};
