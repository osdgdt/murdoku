// The clue glossary page: one card per clue type, with a plain explanation, the
// clue as the game words it, and a tiny board where the cells that make the clue
// true are lit up (computed by the game's own solver predicates — see
// examples.js). Search box + table of contents on top.
import "../i18n/i18n.js";
import { el, qs, clear } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { characterColor } from "../model/puzzle.js";
import { CLUE_TYPES } from "../model/clueTypes.js";
import { t } from "../i18n/i18n.js";
import { FAMILIES, ENTRIES, buildExample, evaluateCells, evaluateGeneral, targetCells, exampleSentence } from "./examples.js";

wireThemeToggle();

const root = qs("#glossary-root");

function characterToken(character) {
  const token = el("div", { class: "char-token", title: character.name });
  token.style.color = characterColor(character);
  token.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
  return token;
}

// One small board. `statusByCell`: Map "r,c" -> "ok" | "rule" | "none" (character
// clues) or null; `fixed`: who stands where; `targets`: cells to ring.
function miniBoard(built, { statusByCell, fixed, targets, labels }) {
  const holder = el("div", { class: "gl-board" });
  holder.setAttribute("inert", "");
  const byId = new Map(built.puzzle.characters.map((c) => [c.id, c]));
  const standing = new Map();
  for (const [id, pos] of fixed) standing.set(`${pos.row},${pos.col}`, byId.get(id));
  const ring = new Set(targets.map((c) => `${c.row},${c.col}`));
  renderBoard(holder, built.grid, {
    showLabels: !!labels,
    decorateCell: (cell, row, col) => {
      const k = `${row},${col}`;
      const status = statusByCell?.get(k);
      if (status === "ok") cell.classList.add("gl-ok");
      if (status === "rule") cell.classList.add("gl-rule");
      if (ring.has(k)) cell.classList.add("gl-target");
      const who = standing.get(k);
      if (who) cell.appendChild(characterToken(who));
    },
  });
  return holder;
}

// Targets worth ringing: only where an object or a person actually stands
// (ringing a whole room or row would just add noise).
function visibleTargets(built, placements) {
  const objectCells = new Set(built.objects.filter(Boolean).map((o) => `${o.row},${o.col}`));
  const peopleCells = new Set([...placements.values()].map((p) => `${p.row},${p.col}`));
  return targetCells(built, placements).filter((c) => objectCells.has(`${c.row},${c.col}`) || peopleCells.has(`${c.row},${c.col}`));
}

// Who is who: a small sticker and the name of everyone in the example.
function castRow(built) {
  return el("ul", { class: "gl-cast", "aria-hidden": "true" }, built.puzzle.characters.map((character) => {
    const tag = el("span", { class: "gl-cast-token" });
    tag.style.color = characterColor(character);
    tag.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
    return el("li", {}, [tag, el("span", {}, character.name)]);
  }));
}

function legendItem(swatchClass, text, swatchContent = "") {
  return el("li", {}, [el("span", { class: `gl-swatch ${swatchClass}`, "aria-hidden": "true" }, swatchContent), el("span", {}, text)]);
}

function ownerLegend(built, cells, hasTargets) {
  const owner = built.puzzle.characters.find((c) => c.id === built.ownerId);
  const items = [];
  if (built.clue) items.push(legendItem("ok", t("Qui {name} può stare: l'indizio è vero.", { name: owner.name }), "✓"));
  else items.push(legendItem("ok", t("Qui {name} può ancora stare.", { name: owner.name }), "✓"));
  if (cells.some((c) => c.status === "rule")) items.push(legendItem("rule", t("Esclusa: riga o colonna di una persona già collocata."), "×"));
  if (hasTargets) items.push(legendItem("target", t("Il bersaglio dell'indizio.")));
  return el("ul", { class: "gl-legend" }, items);
}

// Drawing ~50 little boards at once is wasteful: each figure is an empty
// placeholder until it is about to scroll into view (see lazyFigure).
function lazyFigure(entry, built) {
  const figure = el("figure", { class: "gl-figure pending" });
  const fill = () => {
    figure.classList.remove("pending");
    renderFigure(figure, entry, built);
  };
  if (typeof IntersectionObserver === "undefined") {
    fill();
    return figure;
  }
  figure.style.minHeight = `${entry.world.map.length * 40 + 24}px`;
  figure.style.minWidth = `${entry.world.map[0].length * 40 + 24}px`;
  new IntersectionObserver((hits, observer) => {
    if (!hits.some((h) => h.isIntersecting)) return;
    observer.disconnect();
    fill();
  }, { rootMargin: "700px 0px" }).observe(figure);
  return figure;
}

function renderFigure(figure, entry, built) {
  if (built.puzzle.characters.length > 0) figure.appendChild(castRow(built));
  if (entry.owner || !entry.type) {
    const cells = evaluateCells(built);
    const statusByCell = new Map(cells.map((c) => [`${c.row},${c.col}`, c.status]));
    const targets = visibleTargets(built, built.trueFixed);
    figure.appendChild(miniBoard(built, { statusByCell, fixed: built.trueFixed, targets, labels: entry.world.labels }));
    figure.appendChild(ownerLegend(built, cells, targets.length > 0));
  } else {
    // A general clue: the same scene twice, once where it holds and once where it doesn't.
    const verdict = evaluateGeneral(built);
    const pair = el("div", { class: "gl-pair" });
    for (const [fixed, holds] of [[built.trueFixed, verdict.trueHolds], [built.falseFixed, verdict.falseHolds]]) {
      pair.appendChild(
        el("div", { class: "gl-case " + (holds ? "is-true" : "is-false") }, [
          el("div", { class: "gl-verdict" }, holds ? t("✓ Vero") : t("✗ Falso")),
          miniBoard(built, { statusByCell: null, fixed, targets: visibleTargets(built, fixed), labels: entry.world.labels }),
        ])
      );
    }
    figure.appendChild(pair);
    figure.appendChild(el("figcaption", { class: "gl-caption" }, t("La stessa scena in due disposizioni: nella prima l'indizio è vero, nella seconda no.")));
  }
  figure.style.minHeight = "";
  figure.style.minWidth = "";
}

function titleOf(entry) {
  return entry.title ? entry.title() : CLUE_TYPES[entry.type].label;
}

function renderCard(entry) {
  const built = buildExample(entry);
  const title = titleOf(entry);
  const sentence = entry.sentence ? entry.sentence() : exampleSentence(built);
  const general = !entry.owner && entry.type;
  const badges = [];
  if (general) badges.push(el("span", { class: "gl-badge general", title: t("Non riguarda un personaggio solo: è un fatto sulla scena.") }, t("Indizio generale")));
  if (entry.family === "legacy") badges.push(el("span", { class: "gl-badge legacy" }, t("Obsoleto")));

  const text = el("div", { class: "gl-text" }, [
    el("p", { class: "gl-explain" }, entry.explain()),
    sentence ? el("blockquote", { class: "gl-sentence" }, [entry.type ? el("span", { class: "gl-sentence-label" }, t("Come compare nel gioco")) : null, el("p", {}, sentence)]) : null,
    entry.tip ? el("p", { class: "gl-tip" }, [el("strong", {}, t("Attenzione: ")), entry.tip()]) : null,
  ]);

  const card = el("article", { class: "gl-card" + (entry.board === false ? " text-only" : ""), id: `clue-${entry.id}` }, [
    el("header", { class: "gl-card-head" }, [el("h3", {}, title), ...badges]),
    el("div", { class: "gl-body" }, [text, entry.board === false ? null : lazyFigure(entry, built)]),
  ]);
  card.dataset.search = [title, entry.explain(), sentence || "", entry.tip ? entry.tip() : ""].join(" ").toLowerCase();
  return card;
}

function howToRead() {
  const items = [
    legendItem("ok", t("Verde: le caselle in cui Anna può stare perché l'indizio sia vero."), "✓"),
    legendItem("rule", t("×: caselle già escluse dalla regola «una persona per riga e per colonna», a causa di chi è già collocato."), "×"),
    legendItem("target", t("Tratteggio dorato: l'oggetto o la persona a cui si riferisce l'indizio.")),
  ];
  return el("section", { class: "gl-howto" }, [
    el("h2", {}, t("Come leggere gli esempi")),
    el("p", {}, t("Ogni esempio è un piccolo caso vero, con mappa, stanze, oggetti e personaggi. Per gli indizi su un personaggio, le caselle verdi sono tutte quelle in cui Anna potrebbe trovarsi: sono calcolate dal gioco stesso, con le stesse regole che usa per controllare le soluzioni. Gli indizi generali, invece, sono mostrati in due scene: una in cui sono veri e una in cui no.")),
    el("ul", { class: "gl-legend" }, items),
  ]);
}

function build() {
  clear(root);
  root.appendChild(
    el("section", { class: "gl-hero" }, [
      el("span", { class: "eyebrow" }, t("Guida")),
      el("h1", {}, t("Glossario degli indizi")),
      el("p", { class: "lede" }, t("Ogni tipo di indizio, spiegato in parole semplici e con un piccolo esempio da guardare. Cerca un termine, o scorri per famiglia.")),
    ])
  );

  const search = el("input", { type: "search", class: "gl-search", placeholder: t("Cerca un indizio (es. «accanto», «stanza», «riga»…)"), "aria-label": t("Cerca un indizio") });
  const count = el("span", { class: "gl-count", "aria-live": "polite" });
  root.appendChild(el("div", { class: "gl-tools" }, [search, count]));
  root.appendChild(howToRead());

  const toc = el("nav", { class: "gl-toc", "aria-label": t("Famiglie di indizi") });
  const content = el("div", { class: "gl-content" });
  root.appendChild(el("div", { class: "gl-layout" }, [toc, content]));

  const sections = [];
  for (const family of FAMILIES) {
    const entries = ENTRIES.filter((e) => e.family === family.id);
    if (entries.length === 0) continue;
    const cards = entries.map(renderCard);
    const section = el("section", { class: "gl-section", id: `family-${family.id}` }, [
      el("h2", {}, family.title()),
      el("p", { class: "gl-blurb" }, family.blurb()),
      ...cards,
    ]);
    content.appendChild(section);
    sections.push({ section, cards, family });
    toc.appendChild(el("a", { href: `#family-${family.id}` }, [family.title(), el("span", { class: "gl-toc-n" }, String(entries.length))]));
  }
  const empty = el("p", { class: "gl-empty hidden" }, t("Nessun indizio corrisponde alla ricerca."));
  content.appendChild(empty);

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const { section, cards } of sections) {
      let any = false;
      for (const card of cards) {
        const hit = !q || card.dataset.search.includes(q);
        card.classList.toggle("hidden", !hit);
        if (hit) { any = true; shown++; }
      }
      section.classList.toggle("hidden", !any);
    }
    empty.classList.toggle("hidden", shown > 0);
    count.textContent = q ? t("{n} risultati", { n: shown }) : t("{n} voci", { n: ENTRIES.length });
  }
  search.addEventListener("input", applyFilter);
  applyFilter();

  // Opening the page on a #clue-… link scrolls to that card once it exists.
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

build();
