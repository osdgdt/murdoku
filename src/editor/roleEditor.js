import { el } from "../util/dom.js";
import { hasSectors } from "../model/sectors.js";
import {
  ROLE_RULES,
  ROLE_RULE_LABELS,
  ROLE_PRESETS,
  MAX_ROLES,
  MAX_ROLE_NAME,
  addRole,
  renameRole,
  removeRole,
  setRoleRule,
  setRoleCount,
  setEveryoneHasRole,
  clearRoles,
  applyRolePreset,
  hasRoles,
  isNobleZone,
  setZoneNoble,
} from "../model/roles.js";
import { t } from "../i18n/i18n.js";

// The panel of the hidden roles (Medioevo: nobili/villici/cavalieri, Far West: fuorilegge, Preistoria: mansioni),
// in the map tab under the seals: the author defines the roles and where each may stand, says how many people have
// each, marks the noble areas, and picks the "reserved cell" tool (a square only a person with that role can use).
// `tool` is the map editor's current tool: { kind: "roleCell", roleId } when this panel's tool is active.
export function renderRolePanel(panelEl, puzzle, { tool, selectTool, onChange }) {
  panelEl.appendChild(el("h3", { "aria-level": "2" }, t("Ruoli nascosti")));
  panelEl.appendChild(
    el(
      "p",
      { class: "muted" },
      t(
        "Ogni persona può avere un ruolo che nessuno dichiara: lo si deduce dagli indizi. Un ruolo può permettere o vietare le aree nobili (♛) e può avere delle caselle riservate. Senza ruoli il caso funziona come sempre."
      )
    )
  );

  const roles = puzzle.roles;
  if (!hasRoles(puzzle)) {
    const row = el("div", { class: "field-row" });
    for (const [id, preset] of Object.entries(ROLE_PRESETS)) {
      row.appendChild(
        el(
          "button",
          {
            type: "button",
            onClick: () => {
              applyRolePreset(puzzle, id);
              onChange();
            },
          },
          preset.label
        )
      );
    }
    panelEl.appendChild(row);
  } else {
    for (const def of roles.defs) {
      const nameInput = el("input", {
        type: "text",
        value: def.name,
        maxlength: String(MAX_ROLE_NAME),
        "aria-label": t("Nome del ruolo"),
        onChange: (e) => {
          if (renameRole(puzzle, def.id, e.target.value)) onChange();
          else e.target.value = def.name;
        },
      });
      const ruleSelect = el(
        "select",
        {
          "aria-label": t("Dove può stare {role}", { role: def.name }),
          onChange: (e) => {
            setRoleRule(puzzle, def.id, e.target.value);
            onChange();
          },
        },
        ROLE_RULES.filter((rule) => rule !== "onePerSector" || hasSectors(puzzle.grid) || def.rule === rule).map((rule) =>
          el("option", { value: rule, selected: def.rule === rule || undefined }, ROLE_RULE_LABELS[rule])
        )
      );
      const countInput = el("input", {
        type: "number",
        min: "0",
        max: String(puzzle.characters.length || 16),
        class: "role-count",
        placeholder: t("quante?"),
        title: t("Quante persone hanno questo ruolo (vuoto: non dichiarato)"),
        "aria-label": t("Quante persone sono {role}", { role: def.name }),
        value: Number.isInteger(roles.counts?.[def.id]) ? String(roles.counts[def.id]) : "",
        onChange: (e) => {
          const text = e.target.value.trim();
          setRoleCount(puzzle, def.id, text === "" ? null : Number(text));
          onChange();
        },
      });
      const active = tool?.kind === "roleCell" && tool.roleId === def.id;
      const cellTool = el(
        "button",
        {
          type: "button",
          class: "role-cell-tool",
          "aria-pressed": active ? "true" : "false",
          title: t("Clicca poi sulle celle che solo chi è {role} può occupare", { role: def.name }),
          onClick: () => selectTool({ kind: "roleCell", roleId: def.id }),
        },
        active ? t("Casella riservata (attivo)") : t("Casella riservata")
      );
      const removeBtn = el(
        "button",
        {
          type: "button",
          class: "chip-remove",
          title: t("Togli il ruolo {role}", { role: def.name }),
          "aria-label": t("Togli il ruolo {role}", { role: def.name }),
          onClick: () => {
            removeRole(puzzle, def.id);
            if (active)
              selectTool(null); // (selecting a tool redraws the panel)
            else onChange();
          },
        },
        "✕"
      );
      panelEl.appendChild(el("div", { class: "role-item" }, [nameInput, ruleSelect, countInput, cellTool, removeBtn]));
    }

    const everyone = el("input", {
      type: "checkbox",
      onChange: (e) => {
        setEveryoneHasRole(puzzle, e.target.checked);
        onChange();
      },
    });
    everyone.checked = !!roles.everyone;
    panelEl.appendChild(el("label", { class: "role-everyone" }, [everyone, " ", t("Ogni persona ha uno di questi ruoli")]));

    if (puzzle.grid.zones.length > 0) {
      panelEl.appendChild(el("h4", { class: "palette-group", "aria-level": "3" }, t("Aree nobili")));
      const list = el("div", { class: "role-zones" });
      for (const zone of puzzle.grid.zones) {
        const box = el("input", {
          type: "checkbox",
          onChange: (e) => {
            setZoneNoble(puzzle.grid, zone.id, e.target.checked);
            onChange();
          },
        });
        box.checked = isNobleZone(zone);
        list.appendChild(el("label", {}, [box, " ♛ ", zone.name]));
      }
      panelEl.appendChild(list);
    }
  }

  // A new role, by name (always available, up to the limit).
  if (!hasRoles(puzzle) || roles.defs.length < MAX_ROLES) {
    const input = el("input", { type: "text", placeholder: t("Nuovo ruolo (es. Cacciatore)"), maxlength: String(MAX_ROLE_NAME) });
    const add = () => {
      if (!addRole(puzzle, input.value)) return;
      onChange();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") add();
    });
    panelEl.appendChild(el("div", { class: "field-row" }, [input, el("button", { type: "button", onClick: add }, t("Aggiungi ruolo"))]));
  }

  if (hasRoles(puzzle)) {
    panelEl.appendChild(
      el(
        "button",
        {
          type: "button",
          class: "secondary",
          onClick: () => {
            if (!confirm(t("Togliere tutti i ruoli? Spariscono anche le caselle riservate, le aree nobili e gli indizi sui ruoli.")))
              return;
            clearRoles(puzzle);
            if (tool?.kind === "roleCell") selectTool(null);
            onChange();
          },
        },
        t("Togli tutti i ruoli")
      )
    );
  }
}
