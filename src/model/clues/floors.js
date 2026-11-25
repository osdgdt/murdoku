import { t } from "../../i18n/i18n.js";
import { targetLabel } from "./shared.js";

// Clues about the FLOORS of a skyscraper (see model/sectors.js: the first floor of the list is the highest). They are only
// offered when the case has floors (`floors: true`); the choices of `floorId` are the floors of the case.
const floorParam = () => ({ name: "floorId", kind: "enum", values: [], dynamic: "floors", label: t("Piano") });

// «Terra»: the author's own word for the floor, between quotes so that it reads as a name.
export const floorName = (puzzle, floorId) => `«${puzzle.grid?.sectors?.find((s) => s.id === floorId)?.name ?? "?"}»`;

// How one floor stands to another, as it reads before the name of the other person's floor (read at the moment it is used,
// so that it follows the language).
export function floorRelationLabel(relation) {
  switch (relation) {
    case "higher":
      return t("a un piano più alto di");
    case "lower":
      return t("a un piano più basso di");
    case "justAbove":
      return t("al piano subito sopra quello di");
    case "justBelow":
      return t("al piano subito sotto quello di");
    default:
      return relation;
  }
}
const FLOOR_RELATIONS = ["higher", "lower", "justAbove", "justBelow"];
export const FLOOR_RELATION_LABELS = Object.fromEntries(FLOOR_RELATIONS.map((r) => [r, floorRelationLabel(r)]));

export const FLOOR_CLUES = {
  sameFloor: {
    floors: true,
    label: t("È allo stesso piano di"),
    params: [{ name: "targetId", kind: "character", label: t("Personaggio") }],
    describe: (params, puzzle) => t("È allo stesso piano di {v}.", { v: targetLabel(puzzle, params.targetId) }),
  },
  floorOrder: {
    floors: true,
    label: t("È a un piano più alto o più basso di"),
    params: [
      { name: "relation", kind: "enum", values: FLOOR_RELATIONS, labels: FLOOR_RELATION_LABELS, label: t("Quale piano") },
      { name: "targetId", kind: "character", label: t("Personaggio") },
    ],
    describe: (params, puzzle) => t("È {rel} {v}.", { rel: floorRelationLabel(params.relation), v: targetLabel(puzzle, params.targetId) }),
  },
  onFloor: {
    floors: true,
    label: t("È in un certo piano"),
    params: [floorParam()],
    describe: (params, puzzle) => t("È al piano {floor}.", { floor: floorName(puzzle, params.floorId) }),
  },
};
