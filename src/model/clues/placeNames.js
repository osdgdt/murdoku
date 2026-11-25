import { t } from "../../i18n/i18n.js";

// Clues about places whose name is to be deduced (see model/placeNames.js). The choices of `placeName` are the names of the
// rooms marked as hidden, so the editor, the suggestions and the checks read them from the puzzle (the wizard knows the
// parameter by its `dynamic` marker); `values` stays empty.
export const PLACE_NAME_CLUES = {
  inPlaceNamed: {
    label: t("È nel luogo chiamato…"),
    params: [{ name: "placeName", kind: "enum", values: [], dynamic: "placeNames", label: t("Nome del luogo") }],
    describe: (params) => t("È nel luogo chiamato «{name}».", { name: params.placeName }),
    negatedDescribe: (params) => t("Non è nel luogo chiamato «{name}».", { name: params.placeName }),
  },
};
