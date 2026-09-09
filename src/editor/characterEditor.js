import { el, clear } from "../util/dom.js";
import { addCharacter, removeCharacter, setVictim, characterColor, CHARACTER_COLORS } from "../model/puzzle.js";
import { CHARACTER_ICONS, characterIcon, SELECTABLE_CHARACTER_ICON_IDS } from "../model/icons.js";

// Enter/Space equivalent of a click, for the custom (non-<button>) color
// swatches below — plain <div>s, so tabindex/role need wiring alongside this.
function onActivateKey(onActivate) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
}

export function renderCharacterEditor(container, puzzle, onChange, onPersistOnly) {
  clear(container);
  container.appendChild(el("h3", {}, "Personaggi"));

  const nameInput = el("input", { type: "text", placeholder: "Nome personaggio" });
  // Auto-assigned round-robin, mirroring CHARACTER_COLORS's own rotation in
  // addCharacter() — the select simply defaults to whichever icon is next in
  // rotation; picking a different one from the menu still fully overrides it.
  const nextIconId = SELECTABLE_CHARACTER_ICON_IDS[puzzle.characters.length % SELECTABLE_CHARACTER_ICON_IDS.length];
  const iconSelect = el(
    "select",
    {},
    SELECTABLE_CHARACTER_ICON_IDS.map((id) =>
      el("option", { value: id, selected: id === nextIconId || undefined }, CHARACTER_ICONS[id].label)
    )
  );
  const addBtn = el("button", {
    onClick: () => {
      const name = nameInput.value.trim();
      if (!name) return;
      addCharacter(puzzle, name, iconSelect.value, puzzle.characters.length === 0);
      nameInput.value = "";
      onChange();
    },
  }, "+ Aggiungi");
  container.appendChild(el("div", { class: "field-row" }, [nameInput, iconSelect, addBtn]));

  const list = el("div", { class: "character-list" });
  for (const character of puzzle.characters) {
    const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;

    // The victim's token/card color is always the fixed "danger" red
    // elsewhere (board, clue cards) — no point offering a picker that would
    // visibly do nothing.
    const colorList = character.isVictim ? null : el("div", { class: "zone-swatch-list" });
    if (colorList) {
      for (const color of CHARACTER_COLORS) {
        const selectColor = () => { character.color = color; onChange(); };
        colorList.appendChild(el("div", {
          class: "swatch" + (characterColor(character) === color ? " selected" : ""),
          style: `background:${color}`,
          title: "Colore del personaggio",
          tabindex: "0",
          role: "button",
          "aria-label": `Colore ${color} per ${character.name}`,
          onClick: selectColor,
          onKeydown: onActivateKey(selectColor),
        }));
      }
    }

    const victimToggle = el("label", { class: "muted" }, [
      el("input", {
        type: "checkbox",
        checked: character.isVictim || undefined,
        onChange: () => {
          setVictim(puzzle, character.isVictim ? null : character.id);
          onChange();
        },
      }),
      " vittima",
    ]);

    // Only used by clues that ask about a person's gender ("qualcun altro
    // nella stanza era un uomo/una donna") — left unspecified, a character
    // simply never matches either filter.
    const genderSelect = el(
      "select",
      {
        onChange: (e) => { character.gender = e.target.value || null; onChange(); },
      },
      [
        el("option", { value: "", selected: !character.gender || undefined }, "Genere non specificato"),
        el("option", { value: "male", selected: character.gender === "male" || undefined }, "Uomo"),
        el("option", { value: "female", selected: character.gender === "female" || undefined }, "Donna"),
      ]
    );

    const removeBtn = el("button", {
      onClick: () => {
        removeCharacter(puzzle, character.id);
        onChange();
      },
    }, "Rimuovi");

    const bioInput = el("textarea", {
      class: "bio-input",
      rows: "2",
      placeholder: "Bio / nota narrativa (facoltativa)",
      onInput: (e) => { character.bio = e.target.value; onPersistOnly(); },
    }, character.bio || "");

    const card = el("div", {
      class: "character-card" + (character.isVictim ? " victim" : ""),
      style: character.isVictim ? "" : `border-left: 3px solid ${characterColor(character)}`,
    }, [
      el("div", { class: "row" }, [iconWrap, el("strong", {}, character.name)]),
      colorList,
      el("div", { class: "row" }, [victimToggle, genderSelect, removeBtn]),
      bioInput,
    ]);
    list.appendChild(card);
  }
  container.appendChild(list);
}
