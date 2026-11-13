// The tutorial page (tutorial.html): the rules in a few lines, a tiny case
// solved step by step on little boards drawn by the game's own board renderer,
// the object list, three strategy tips and a cheat sheet for the app's
// gestures. The case and its deduction come from tutorialCase.js (computed with
// the game's own predicates), so the page can't disagree with the game.
import "../i18n/i18n.js";
import { el, qs, clear } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { renderBoard } from "../util/boardRender.js";
import { characterIcon, OBJECT_TYPES } from "../model/icons.js";
import { createGrid, placeObject, isOccupiable } from "../model/grid.js";
import { createPuzzle, addCharacter, characterColor } from "../model/puzzle.js";
import { describeClue } from "../model/clueTypes.js";
import { t } from "../i18n/i18n.js";
import { buildTutorialCase, deriveSteps } from "./tutorialCase.js";

wireThemeToggle();

const root = qs("#tutorial-root");
const key = (row, col) => `${row},${col}`;
const cellName = (cell) => `R${cell.row + 1}, C${cell.col + 1}`;

function token(character) {
  const node = el("div", { class: "char-token", title: character.name });
  node.style.color = characterColor(character);
  node.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
  return node;
}

function sticker(character) {
  const node = el("span", { class: "tt-sticker", "aria-hidden": "true" });
  node.style.color = characterColor(character);
  node.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
  return node;
}

// A small, non-interactive board. `marks` is a Map "r,c" -> { token, crossed, candidates: [character], room }.
function miniBoard(grid, marks) {
  const holder = el("div", { class: "tt-board" });
  holder.setAttribute("inert", "");
  renderBoard(holder, grid, {
    showLabels: true,
    decorateCell: (cell, row, col) => {
      const mark = marks.get(key(row, col));
      if (!mark) return;
      if (mark.room) cell.classList.add("tt-room");
      if (mark.crossed) cell.classList.add("x-mark");
      if (mark.target) cell.classList.add("tt-target");
      if (mark.token) cell.appendChild(token(mark.token));
      if (mark.candidates?.length) {
        cell.appendChild(
          el(
            "div",
            { class: "tt-cands" },
            mark.candidates.map((c) => {
              const dot = el("span", { class: "tt-cand", title: c.name }, c.name.charAt(0).toUpperCase());
              dot.style.setProperty("--who", characterColor(c));
              return dot;
            })
          )
        );
      }
    },
  });
  return holder;
}

function markFor(marks, row, col) {
  const k = key(row, col);
  if (!marks.has(k)) marks.set(k, {});
  return marks.get(k);
}

// What the board shows after a deduction step: tokens for everyone placed, an X
// on every other cell of their rows/columns, and the candidates still open.
function stateMarks(built, step, { roomOf = null } = {}) {
  const marks = new Map();
  const { grid } = built;
  const rows = new Set([...step.placed.values()].map((p) => p.row));
  const cols = new Set([...step.placed.values()].map((p) => p.col));
  const byId = new Map(built.puzzle.characters.map((c) => [c.id, c]));
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      if (isOccupiable(grid, r, c) && (rows.has(r) || cols.has(c))) markFor(marks, r, c).crossed = true;
    }
  }
  for (const [id, pos] of step.placed) {
    const mark = markFor(marks, pos.row, pos.col);
    mark.crossed = false;
    mark.token = byId.get(id);
  }
  if (step.kind === "clues" || step.kind === "place") {
    for (const s of built.suspects) {
      if (step.placed.has(s.id)) continue;
      const domain = step.kind === "clues" ? step.domains.get(s.id) : step.domainsLeft.get(s.id);
      for (const cell of domain) {
        const mark = markFor(marks, cell.row, cell.col);
        if (mark.crossed) continue;
        (mark.candidates ||= []).push(s);
      }
    }
  }
  if (roomOf) {
    for (let r = 0; r < grid.size.rows; r++) {
      for (let c = 0; c < grid.size.cols; c++) if (grid.cells[r][c].zoneId === roomOf) markFor(marks, r, c).room = true;
    }
  }
  return marks;
}

function figure(board, caption) {
  return el("figure", { class: "tt-figure" }, [board, caption ? el("figcaption", {}, caption) : null]);
}

function section(id, title, lede, children) {
  return el("section", { class: "tt-section", id }, [el("h2", {}, title), lede ? el("p", { class: "tt-lede" }, lede) : null, ...children]);
}

// ---------------------------------------------------------------- 1. the rules

function rowColumnFigure() {
  const puzzle = createPuzzle("tutorial");
  const anna = addCharacter(puzzle, t("Anna"), "detective");
  const grid = createGrid(4, 4);
  const marks = new Map();
  for (let i = 0; i < 4; i++) {
    if (i !== 2) markFor(marks, 1, i).crossed = true;
    if (i !== 1) markFor(marks, i, 2).crossed = true;
  }
  markFor(marks, 1, 2).token = anna;
  return figure(
    miniBoard(grid, marks),
    t("Se {name} sta qui, nessun altro può stare nelle caselle con la X: sono nella sua riga o nella sua colonna.", { name: anna.name })
  );
}

function rulesSection() {
  return section(
    "rules",
    t("Le regole in breve"),
    t("Murdoku è un po' Sudoku e un po' giallo: devi collocare tutte le persone su una griglia e scoprire chi ha ucciso la vittima."),
    [
      el("div", { class: "tt-rules" }, [
        el("ol", { class: "tt-rule-list" }, [
          el("li", {}, [
            el("strong", {}, t("Una persona per riga e per colonna. ")),
            t("Su ogni riga (R1, R2…) e su ogni colonna (C1, C2…) c'è al massimo una persona."),
          ]),
          el("li", {}, [
            el("strong", {}, t("Gli indizi dicono dove può stare ciascuno. ")),
            t("Ogni sospettato ha uno o più indizi: accanto a un oggetto, in una certa stanza, davanti a una finestra…"),
          ]),
          el("li", {}, [
            el("strong", {}, t("L'assassino è nella stanza della vittima. ")),
            t("La vittima si trova sempre in una stanza con esattamente un'altra persona: quella persona è l'assassino."),
          ]),
        ]),
        rowColumnFigure(),
      ]),
    ]
  );
}

// -------------------------------------------------------------------- 2. the case

function castList(built) {
  return el(
    "ul",
    { class: "tt-cast" },
    built.puzzle.characters.map((character) =>
      el("li", {}, [
        sticker(character),
        el("span", {}, character.isVictim ? t("{name} (la vittima)", { name: character.name }) : character.name),
      ])
    )
  );
}

function clueList(built) {
  return el(
    "ul",
    { class: "tt-clues" },
    built.suspects.map((s) => {
      const clue = built.puzzle.clues.find((c) => c.characterId === s.id);
      return el("li", {}, [sticker(s), el("span", {}, [el("strong", {}, `${s.name}: `), describeClue(clue, built.puzzle)])]);
    })
  );
}

function caseSection(built) {
  return section(
    "case",
    t("Il caso"),
    t(
      "La vittima è stata trovata senza vita. Ci sono tre sospettati e un indizio per ciascuno; non c'è nessun indizio sulla vittima. Sulla pianta ci sono due stanze, con qualche mobile e una finestra."
    ),
    [
      el("div", { class: "tt-case" }, [
        figure(miniBoard(built.grid, new Map())),
        el("div", { class: "tt-case-text" }, [castList(built), clueList(built)]),
      ]),
    ]
  );
}

// ------------------------------------------------------------------ 3. the steps

function plural(n, one, many) {
  return n === 1 ? one : many;
}

function stepCard(n, title, body, board, extra = []) {
  return el("li", { class: "tt-step", id: `step-${n}` }, [
    el("div", { class: "tt-step-text" }, [
      el("h3", {}, [el("span", { class: "tt-step-n", "aria-hidden": "true" }, String(n)), title]),
      ...body,
      ...extra,
    ]),
    figure(board),
  ]);
}

function stepsSection(built) {
  const steps = deriveSteps(built);
  // Everybody's candidates from their clue; the boards cross out the ones that fall on a placed row/column.
  for (const step of steps) step.domainsLeft = steps[0].domains;
  const cards = [];
  const zoneName = (id) => built.grid.zones.find((z) => z.id === id)?.name ?? "";

  steps.forEach((step, i) => {
    const n = i + 1;
    if (step.kind === "clues") {
      const items = built.suspects.map((s) => {
        const count = step.domains.get(s.id).length;
        return el("li", {}, [
          sticker(s),
          el("span", {}, t("{name}: {what}", { name: s.name, what: plural(count, t("una sola casella"), t("{n} caselle", { n: count })) })),
        ]);
      });
      cards.push(
        stepCard(
          n,
          t("Dove può stare ciascuno?"),
          [
            el(
              "p",
              {},
              t(
                "Ogni indizio, da solo, esclude molte caselle. I cerchietti con l'iniziale mostrano le caselle ancora possibili per ogni sospettato."
              )
            ),
            el("ul", { class: "tt-count" }, items),
          ],
          miniBoard(built.grid, stateMarks(built, step))
        )
      );
    } else if (step.kind === "place") {
      const excluded = step.domain.filter((c) => !step.options.some((o) => o.row === c.row && o.col === c.col));
      const first = cards.length === 1;
      const body = first
        ? [
            el(
              "p",
              {},
              t(
                "{name} può stare in una sola casella, {cell}: la collochiamo lì. Dato che c'è una sola persona per riga e per colonna, segniamo con una X tutte le altre caselle della sua riga e della sua colonna.",
                {
                  name: step.character.name,
                  cell: cellName(step.cell),
                }
              )
            ),
          ]
        : [
            el(
              "p",
              {},
              t(
                "Con le X segnate, {name} ha una sola casella rimasta: {cell}. Collochiamo {name} e segniamo la sua riga e la sua colonna.",
                {
                  name: step.character.name,
                  cell: cellName(step.cell),
                }
              )
            ),
            excluded.length
              ? el(
                  "p",
                  { class: "tt-note" },
                  excluded.length === 1
                    ? t("{cells} è esclusa: è nella riga o nella colonna di chi era già collocato.", {
                        cells: `(${cellName(excluded[0])})`,
                      })
                    : t("{cells} sono escluse: sono nella riga o nella colonna di chi era già collocato.", {
                        cells: excluded.map((c) => `(${cellName(c)})`).join(", "),
                      })
                )
              : null,
          ];
      const title = first
        ? t("Chi ha una sola casella?")
        : cards.length === 2
          ? t("Poi {name}", { name: step.character.name })
          : t("Infine {name}", { name: step.character.name });
      cards.push(stepCard(n, title, body, miniBoard(built.grid, stateMarks(built, step))));
    } else if (step.kind === "victim") {
      cards.push(
        stepCard(
          n,
          t("Dove sta la vittima?"),
          [
            el(
              "p",
              {},
              t("Nessun indizio parla della vittima: si trova nell'unica casella rimasta, quella senza nessuna X: {cell}.", {
                cell: cellName(step.cell),
              })
            ),
          ],
          miniBoard(built.grid, stateMarks(built, step))
        )
      );
    } else {
      const room = zoneName(step.zoneId);
      cards.push(
        stepCard(
          n,
          t("Chi è l'assassino?"),
          [
            el(
              "p",
              {},
              t(
                "La vittima è sempre in una stanza con esattamente un'altra persona. Nella stanza {room} con la vittima c'è solo {name}: è {name} ad averla uccisa.",
                {
                  room,
                  name: step.character.name,
                }
              )
            ),
            el("p", { class: "tt-solved" }, t("Caso risolto!")),
          ],
          miniBoard(built.grid, stateMarks(built, step, { roomOf: step.zoneId }))
        )
      );
    }
  });
  return section(
    "steps",
    t("Risolviamolo passo per passo"),
    t("Ecco come ragionerebbe un giocatore. Ogni passo si ricava solo dagli indizi e dalle regole."),
    [el("ol", { class: "tt-steps" }, cards)]
  );
}

// ----------------------------------------------------------------- 4. the objects

function objectItem(typeId) {
  const def = OBJECT_TYPES[typeId];
  const icon = el("span", { class: "tt-obj-icon", "aria-hidden": "true" });
  icon.innerHTML = def.icon;
  return el("li", {}, [icon, el("span", {}, def.label)]);
}

function objectsSection() {
  return section(
    "objects",
    t("Gli oggetti"),
    t("Alcuni oggetti si possono occupare, altri no. Porte e finestre stanno sul bordo di una casella e non bloccano nessuno."),
    [
      el("div", { class: "tt-objects" }, [
        el("div", { class: "tt-obj-group ok" }, [
          el("h3", {}, t("Si possono occupare")),
          el("ul", {}, ["chair", "stool", "carpet"].map(objectItem)),
        ]),
        el("div", { class: "tt-obj-group no" }, [
          el("h3", {}, t("Non si possono occupare")),
          el("ul", {}, ["table", "shelf", "plant", "lamp", "tv"].map(objectItem)),
        ]),
        el("div", { class: "tt-obj-group edge" }, [
          el("h3", {}, t("Sul bordo di una casella")),
          el("ul", {}, ["door", "window"].map(objectItem)),
        ]),
      ]),
      el(
        "p",
        { class: "tt-note" },
        t(
          "Una finestra può stare sul bordo della griglia o tra due caselle: nel secondo caso è accanto a entrambe. Su un tappeto si sta in piedi; su sedie e sgabelli si è seduti."
        )
      ),
      el(
        "p",
        { class: "tt-note" },
        t(
          "Nei casi medievali trovi altri oggetti: letti, panche, troni, pelli d'orso e giacigli si possono occupare (su panche e troni si è seduti); botti, forzieri, camini, pozzi, altari e gli altri no. Saracinesche e feritoie stanno sul bordo, come porte e finestre."
        )
      ),
    ]
  );
}

// ------------------------------------------------------------------ 5. strategies

function intersectionFigure() {
  const puzzle = createPuzzle("tutorial");
  const anna = addCharacter(puzzle, t("Anna"), "detective");
  const grid = createGrid(4, 4);
  placeObject(grid, "chair", 0, 0);
  placeObject(grid, "chair", 1, 2);
  const marks = new Map();
  (markFor(marks, 0, 0).candidates ||= []).push(anna);
  (markFor(marks, 1, 2).candidates ||= []).push(anna);
  markFor(marks, 0, 2).crossed = true;
  markFor(marks, 1, 0).crossed = true;
  return figure(
    miniBoard(grid, marks),
    t(
      "{name} può stare solo su una delle due sedie. Qualunque sedia scelga, la sua riga o la sua colonna passa per le due caselle con la X: nessun altro può starci.",
      { name: anna.name }
    )
  );
}

function tipsSection() {
  return section("tips", t("Qualche trucco"), null, [
    el("div", { class: "tt-tips" }, [
      el("div", { class: "tt-tip" }, [
        el("h3", {}, t("Riga per riga, colonna per colonna")),
        el(
          "p",
          {},
          t(
            "Se una riga o una colonna ha una sola casella disponibile, qualcuno deve starci, anche se non sai ancora chi. Attenzione: vale solo se il numero di persone è uguale al numero di righe e al numero di colonne (come in questo caso); altrimenti una riga o una colonna può restare vuota."
          )
        ),
      ]),
      el("div", { class: "tt-tip" }, [
        el("h3", {}, t("Stanza per stanza")),
        el(
          "p",
          {},
          t(
            "Invece di chiederti dove sta ogni persona, chiediti chi può e chi non può stare in ciascuna stanza: è utile con indizi come «nessuna stanza è vuota»."
          )
        ),
      ]),
      el("div", { class: "tt-tip wide" }, [
        el("div", {}, [
          el("h3", {}, t("Le caselle d'intersezione")),
          el(
            "p",
            {},
            t(
              "Se qualcuno può occupare solo due caselle, pensale come due angoli di un rettangolo: nessun altro può occupare gli altri due angoli. Vale anche quando tutte le caselle possibili stanno su una stessa riga o colonna."
            )
          ),
        ]),
        intersectionFigure(),
      ]),
    ]),
  ]);
}

// ---------------------------------------------------------------- 6. using the app

function key2(text) {
  return el("kbd", {}, text);
}

function appSection() {
  return section("app", t("Come si gioca nell'app"), null, [
    el("ul", { class: "tt-how" }, [
      el("li", {}, [el("strong", {}, t("Scegli un personaggio ")), t("dalla barra in alto (o premi 1-9), poi tocca la griglia.")]),
      el("li", {}, [el("strong", {}, t("Tocco rapido: ")), t("segna una nota (un candidato) nella casella, senza confermare.")]),
      el("li", {}, [
        el("strong", {}, t("Tieni premuto circa un secondo: ")),
        t("piazza il personaggio. Le X sulla sua riga e colonna si mettono da sole, e le sue note spariscono."),
      ]),
      el("li", {}, [
        el("strong", {}, t("Tieni premuto e trascina: ")),
        t("applica lo strumento a più caselle in un colpo solo, ad esempio per segnare molte X."),
      ]),
      el("li", {}, [
        el("strong", {}, t("Strumenti: ")),
        key2("X"),
        t(" segna una casella, "),
        key2("E"),
        t(" è la gomma, "),
        key2("U"),
        t(" annulla."),
      ]),
      el("li", {}, [
        el("strong", {}, t("Sei bloccato? ")),
        key2("H"),
        t(
          " (o il pulsante 💡 Suggerimento) spiega una deduzione certa in tre passi: prima il personaggio, poi gli indizi, infine la casella."
        ),
      ]),
      el("li", {}, [
        el("strong", {}, t("Verifica soluzione ")),
        t("dice solo se il caso è risolto, senza rivelare quante caselle sono giuste."),
      ]),
    ]),
    el("div", { class: "tt-cta" }, [
      el("a", { class: "tt-button", href: "index.html" }, t("Vai ai casi")),
      el("a", { class: "tt-button secondary", href: "glossary.html" }, t("📖 Glossario degli indizi")),
    ]),
  ]);
}

// ------------------------------------------------------------------------- page

function render() {
  clear(root);
  const built = buildTutorialCase();
  root.appendChild(
    el("section", { class: "tt-hero" }, [
      el("span", { class: "eyebrow" }, t("Guida")),
      el("h1", {}, t("Come si gioca")),
      el(
        "p",
        { class: "lede" },
        t("Impara Murdoku in cinque minuti: le regole, un caso piccolo risolto passo per passo e qualche trucco.")
      ),
    ])
  );
  root.appendChild(rulesSection());
  root.appendChild(caseSection(built));
  root.appendChild(stepsSection(built));
  root.appendChild(objectsSection());
  root.appendChild(tipsSection());
  root.appendChild(appSection());
}

render(); // the language toggle reloads the page, so a single render is enough
