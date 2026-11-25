import { t } from "../../i18n/i18n.js";
import { targetLabel, SHORT_DIRECTION_LABELS, STANDABLE_TYPE_IDS, OBJECT_TYPE_LABELS, objectTypePhrase } from "./shared.js";
import { isObjectTypeMount } from "../icons.js";
import { roleName } from "../roles.js";
import { DIRECTIONS, DIRECTION_LABELS } from "../../util/geometry.js";

// Clues about hidden roles (see model/roles.js). The choices of `roleId` are the roles of the case, so the editor, the
// suggestions and the checks read them from the puzzle (the wizard knows the parameter by its name); the `values` here
// only say which special choices exist ("*" = any role at all).
const roleParam = (label, { any = false } = {}) => ({
  name: "roleId",
  kind: "enum",
  values: any ? ["*"] : [],
  labels: { "*": t("Un ruolo qualsiasi") },
  dynamic: "roles",
  label,
});

// «Cavaliere», «Nobile»: the author's own word for the role, between quotes so that it reads as a name.
const quoted = (puzzle, roleId) => `«${roleName(puzzle, roleId)}»`;

export const ROLES_CLUES = {
  // Built-in rule of the cases with roles, like victimRoomRule: not offered anywhere, it only has a text for messages.
  roleRule: {
    internal: true,
    scope: "generic",
    label: t("Ruoli: ognuno sta dove il suo ruolo lo permette"),
    params: [],
    describe: () => t("Ognuno sta dove il suo ruolo lo permette: aree nobili e caselle riservate."),
  },
  hasRole: {
    label: t("Ha un certo ruolo"),
    params: [roleParam(t("Ruolo"), { any: true })],
    describe: (params, puzzle) =>
      params.roleId === "*" ? t("Ha un ruolo.") : t("È un {role}.", { role: roleName(puzzle, params.roleId) }),
    negatedDescribe: (params, puzzle) =>
      params.roleId === "*" ? t("Non ha nessun ruolo.") : t("Non è un {role}.", { role: roleName(puzzle, params.roleId) }),
  },
  roleDirection: {
    label: t("È a nord/sud/est/ovest di tutte le persone con un ruolo"),
    params: [
      { name: "direction", kind: "enum", values: DIRECTIONS, labels: SHORT_DIRECTION_LABELS, label: t("Direzione") },
      roleParam(t("Ruolo")),
    ],
    describe: (params, puzzle) =>
      t("È {dir} tutte le persone con il ruolo {role}.", {
        dir: DIRECTION_LABELS[params.direction] || params.direction,
        role: quoted(puzzle, params.roleId),
      }),
  },
  // «Il fuorilegge era su un tappeto» / «Tutti i fuorilegge erano su un tappeto»: not about a person but about the role.
  roleOnObjectType: {
    scope: "generic",
    label: t("Una persona con un ruolo è su un oggetto di un certo tipo"),
    params: [
      roleParam(t("Ruolo")),
      { name: "objectTypeId", kind: "enum", values: STANDABLE_TYPE_IDS, labels: OBJECT_TYPE_LABELS, label: t("Tipo di oggetto") },
      {
        name: "quantifier",
        kind: "enum",
        values: ["some", "all"],
        labels: { some: t("almeno una"), all: t("tutte") },
        label: t("Quante persone con quel ruolo"),
      },
    ],
    describe: (params, puzzle) => {
      const vars = { role: quoted(puzzle, params.roleId), v: objectTypePhrase(params.objectTypeId) };
      const mount = isObjectTypeMount(params.objectTypeId);
      if (params.quantifier === "all") {
        return mount
          ? t("Tutte le persone con il ruolo {role} sono in sella a {v}.", vars)
          : t("Tutte le persone con il ruolo {role} sono su {v}.", vars);
      }
      return mount ? t("Una persona con il ruolo {role} è in sella a {v}.", vars) : t("Una persona con il ruolo {role} è su {v}.", vars);
    },
  },
  roleAllInRoom: {
    scope: "generic",
    label: t("Tutte le persone con un ruolo sono in una stanza"),
    params: [roleParam(t("Ruolo")), { name: "zoneId", kind: "zone", label: t("Stanza") }],
    describe: (params, puzzle) =>
      t("Tutte le persone con il ruolo {role} si trovano nella stanza {zone}.", {
        role: quoted(puzzle, params.roleId),
        zone: targetLabel(puzzle, params.zoneId),
      }),
  },
};
