import "../i18n/i18n.js";
import { el, clear, qs } from "../util/dom.js";
import { t } from "../i18n/i18n.js";
import { wireThemeToggle } from "../util/theme.js";
import { announce } from "../util/announcer.js";
import { difficultyLabel, DIFFICULTY_LEVELS } from "../model/puzzle.js";
import { onAuthChange, signIn, signOutUser } from "../auth/googleAuth.js";
import { describeAuthError } from "../auth/loginHelp.js";
import * as store from "../storage/puzzleStore.js";
import * as registry from "./localRegistry.js";
import { isCaseCode, normalizeCode, formatCode, caseLink, TAGS, LIMITS } from "./casePolicy.js";
import { fetchCards, searchAuthors, isAdmin, fetchLiked, fetchAuthor, fetchFollowing, isFollowing } from "./galleryStore.js";
import * as community from "./communityStore.js";
import { requireAccount } from "./accountDialog.js";
import { openReportDialog } from "./reportDialog.js";
import { readJson, tryWriteJson } from "../storage/storage.js";
import { miniMapSvg } from "./miniMap.js";
import { describeReason, tagLabel } from "./messages.js";

wireThemeToggle();

// The list of the cases other players published (community.html). Reading needs no sign-in; the signed-in author also sees all
// their own cases ("I miei casi": in the list or not, withdrawn too) and an administrator every case. What a query may ask for
// is in galleryQuery.js, the rules that check it again in firestore.rules ("Shared cases").

const app = qs("#community-app");
const authBar = qs("#auth-bar");

const state = {
  scope: "gallery", // "gallery" | "mine" | "all" | "feed"
  filters: { lang: "", difficulty: "", sizeBand: "", tag: "", search: "", sort: "new", authorUid: "", authorNick: "" },
  searchMode: "title", // "title" | "author"
  user: null,
  admin: false,
  following: [], // [{ uid, nick }] the authors the signed-in person follows
  liked: new Set(), // the codes this person likes (of the cards seen so far)
  profile: null, // the page of the author being looked at: { uid, nick, bio, caseCount, followers }
  iFollow: false,
  hasAccount: false, // signed in AND has a nickname (what likes, reports and following need)
};
const FEED_SEEN_KEY = "murdoku:community:feedSeen"; // when this browser last opened the feed
let cursor = null;
let done = true;
let requestId = 0;
let shown = 0;
let wantScope = ""; // the person asked for "I miei casi" or the feed while signed out: shown as soon as they are in

const debounce = (fn, ms) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
const str = (value, max = 400) => (typeof value === "string" ? value.slice(0, max) : "");
const whole = (value) => (Number.isInteger(value) && value >= 0 && value <= 1000 ? value : null);

// ---- the page ----------------------------------------------------------------------------------------------------------
const codeInput = el("input", {
  type: "text",
  maxlength: "12",
  autocomplete: "off",
  autocapitalize: "characters",
  spellcheck: "false",
  "aria-label": t("Codice del caso"),
  placeholder: t("Codice del caso"),
  "data-key": "code-input",
});
const codeNotice = el("p", { class: "violation", role: "alert" });
codeNotice.hidden = true;
const openCode = () => {
  const code = normalizeCode(codeInput.value);
  if (!isCaseCode(code)) {
    codeNotice.textContent = t("Il codice non è valido: sono 8 caratteri tra lettere e cifre, come ABCD-2345.");
    codeNotice.hidden = false;
    return;
  }
  location.href = `player.html?c=${code}`;
};
codeInput.addEventListener("keydown", (e) => e.key === "Enter" && openCode());

const tabs = el("div", { class: "community-tabs", role: "group", "aria-label": t("Quali casi vedere") });
const tabButton = (scope, label) =>
  el("button", { type: "button", "data-key": `tab-${scope}`, "aria-pressed": "false", onClick: () => chooseScope(scope) }, label);
const tabAll = tabButton("gallery", t("Tutti i casi"));
const tabMine = tabButton("mine", t("I miei casi"));
const tabEverything = tabButton("all", t("Tutti, anche nascosti (amministratore)"));
tabEverything.hidden = true;
const feedDot = el("span", { class: "feed-dot", "data-key": "feed-dot", title: t("Ci sono casi nuovi") }, " ●");
feedDot.hidden = true;
const tabFeed = tabButton("feed", t("Novità dai tuoi autori"));
tabFeed.append(feedDot);
const modLink = el("a", { class: "button-link", href: "moderation.html", "data-key": "mod-link" }, t("🛡 Moderazione"));
modLink.hidden = true;
tabs.append(tabAll, tabFeed, tabMine, tabEverything, modLink);

const select = (key, label, options, onChange) => {
  const node = el(
    "select",
    { "data-key": key, onChange: (e) => onChange(e.target.value) },
    options.map(([value, text]) => el("option", { value }, text))
  );
  return { node, field: el("label", { class: "community-field" }, [el("span", {}, label), node]) };
};
const lang = select(
  "filter-lang",
  t("Lingua"),
  [
    ["", t("Tutte le lingue")],
    ["it", "Italiano"],
    ["en", "English"],
  ],
  (v) => setFilter("lang", v)
);
const difficulty = select(
  "filter-difficulty",
  t("Difficoltà"),
  [["", t("Tutte")], ...DIFFICULTY_LEVELS.filter((d) => d.value).map((d) => [d.value, d.label])],
  (v) => setFilter("difficulty", v)
);
const size = select(
  "filter-size",
  t("Dimensione"),
  [
    ["", t("Tutte")],
    ["small", t("Piccola (fino a 5×5)")],
    ["medium", t("Media (da 6 a 8)")],
    ["large", t("Grande (9 o più)")],
  ],
  (v) => setFilter("sizeBand", v)
);
const tag = select("filter-tag", t("Tag"), [["", t("Tutti i tag")], ...TAGS.map((x) => [x, tagLabel(x)])], (v) => setFilter("tag", v));
const sort = select(
  "filter-sort",
  t("Ordina per"),
  [
    ["new", t("Più recenti")],
    ["title", t("Titolo (A→Z)")],
    ["played", t("Più giocati")],
    ["liked", t("Più apprezzati")],
    ["solved", t("Più risolti")],
  ],
  (v) => setFilter("sort", v)
);

const searchMode = el(
  "select",
  {
    "data-key": "search-mode",
    "aria-label": t("Cerca per"),
    onChange: (e) => {
      state.searchMode = e.target.value;
      searchInput.placeholder = state.searchMode === "author" ? t("Cerca un autore…") : t("Cerca per titolo…");
      searchInput.value = "";
      state.filters.search = "";
      authorsFound.hidden = true;
      refresh();
    },
  },
  [el("option", { value: "title" }, t("Per titolo")), el("option", { value: "author" }, t("Per autore"))]
);
const searchInput = el("input", {
  type: "search",
  maxlength: "40",
  autocomplete: "off",
  placeholder: t("Cerca per titolo…"),
  "aria-label": t("Cerca"),
  "data-key": "search",
});
const authorsFound = el("div", { class: "community-authors", "data-key": "authors-found" });
authorsFound.hidden = true;
const authorChip = el("p", { class: "community-chip", "data-key": "author-chip" });
authorChip.hidden = true;
const resetButton = el("button", { type: "button", "data-key": "reset", onClick: () => resetFilters() }, t("Azzera i filtri"));

const onSearch = debounce(async () => {
  const text = searchInput.value;
  if (state.searchMode === "author") {
    await showAuthors(text);
    return;
  }
  state.filters.search = text;
  refresh();
}, 350);
searchInput.addEventListener("input", onSearch);

const filtersBox = el("form", { class: "community-filters panel", onSubmit: (e) => e.preventDefault() }, [
  el("div", { class: "community-search" }, [searchMode, searchInput]),
  authorsFound,
  authorChip,
  el("div", { class: "community-selects" }, [lang.field, difficulty.field, size.field, tag.field, sort.field]),
  el("div", { class: "field-row" }, [resetButton]),
]);

const profileBox = el("section", { class: "community-profile panel", "data-key": "profile" });
profileBox.hidden = true;
const statusLine = el("p", { class: "community-status", role: "status", "aria-live": "polite", "data-key": "status" });
const grid = el("ul", { class: "case-grid", "data-key": "grid" });
const moreButton = el("button", { type: "button", class: "primary", "data-key": "more", onClick: () => load(false) }, t("Carica altri"));
moreButton.hidden = true;
const notice = el("div", { class: "community-notice", "data-key": "notice" });

app.append(
  el("section", { class: "community-intro panel" }, [
    el("p", { class: "lede" }, t("Casi pubblicati da altri giocatori. Per giocarli non serve accedere: basta un clic su «Gioca».")),
    el("div", { class: "community-actions" }, [
      el("div", { class: "field-row" }, [
        codeInput,
        el("button", { type: "button", "data-key": "code-go", onClick: openCode }, t("Apri con un codice")),
      ]),
      el("a", { class: "button-link", href: "editor.html", "data-key": "publish-link" }, t("✏️ Pubblica un tuo caso")),
    ]),
    codeNotice,
  ]),
  tabs,
  filtersBox,
  profileBox,
  notice,
  statusLine,
  grid,
  el("div", { class: "community-more" }, [moreButton])
);

// ---- the list ----------------------------------------------------------------------------------------------------------
const queryFilters = () => {
  if (state.scope === "mine") return { scope: "mine", uid: state.user?.uid };
  if (state.scope === "all") return { scope: "all" };
  if (state.scope === "feed") return { scope: "feed", authors: state.following.map((a) => a.uid) };
  const f = state.filters;
  return {
    scope: "gallery",
    lang: f.lang,
    difficulty: f.difficulty,
    sizeBand: f.sizeBand,
    tag: f.tag,
    search: state.searchMode === "title" ? f.search : "",
    sort: f.sort,
    authorUid: f.authorUid,
  };
};

const hasFilters = () => {
  const f = state.filters;
  return Boolean(f.lang || f.difficulty || f.sizeBand || f.tag || f.search || f.authorUid);
};

function syncControls() {
  const gallery = state.scope === "gallery";
  filtersBox.hidden = !gallery;
  for (const [scope, button] of [
    ["gallery", tabAll],
    ["feed", tabFeed],
    ["mine", tabMine],
    ["all", tabEverything],
  ])
    button.setAttribute("aria-pressed", String(state.scope === scope));
  tabEverything.hidden = !state.admin;
  modLink.hidden = !state.admin;
  // searching a title sorts by title; the sort control says so and cannot be changed meanwhile
  const titleSearch = state.searchMode === "title" && state.filters.search.trim() !== "";
  sort.node.disabled = titleSearch || Boolean(state.filters.authorUid);
  if (state.filters.authorUid && sort.node.value !== state.filters.sort) sort.node.value = state.filters.sort;
  sort.node.value = titleSearch ? "title" : state.filters.sort;
  authorChip.hidden = !state.filters.authorUid;
  if (state.filters.authorUid) {
    clear(authorChip);
    authorChip.append(
      t("Autore: {nick}", { nick: state.filters.authorNick }),
      " ",
      el(
        "button",
        {
          type: "button",
          "data-key": "author-clear",
          onClick: () => ((state.filters.authorUid = ""), (state.filters.authorNick = ""), refresh()),
        },
        t("Togli il filtro")
      )
    );
  }
  resetButton.disabled = !hasFilters();
  renderProfile();
}

function setFilter(name, value) {
  state.filters[name] = value;
  refresh();
}

function resetFilters() {
  state.filters = { lang: "", difficulty: "", sizeBand: "", tag: "", search: "", sort: "new", authorUid: "", authorNick: "" };
  searchInput.value = "";
  authorsFound.hidden = true;
  for (const [control, value] of [
    [lang, ""],
    [difficulty, ""],
    [size, ""],
    [tag, ""],
  ])
    control.node.value = value;
  refresh();
}

function chooseScope(scope) {
  if ((scope === "mine" || scope === "feed") && !state.user) {
    wantScope = scope;
    signInNow();
    return;
  }
  state.scope = scope;
  if (scope === "feed") {
    tryWriteJson(FEED_SEEN_KEY, Date.now());
    feedDot.hidden = true;
  }
  refresh();
}

const refresh = () => {
  syncControls();
  return load(true);
};

async function load(reset) {
  const id = ++requestId;
  if (reset) {
    cursor = null;
    done = false;
    shown = 0;
    clear(grid);
  }
  clear(notice);
  moreButton.hidden = true;
  statusLine.textContent = t("Sto caricando i casi…");
  try {
    if (state.scope === "feed" && state.following.length === 0) {
      statusLine.textContent = "";
      moreButton.hidden = true;
      notice.append(
        el("p", {}, t("Non segui ancora nessun autore: apri la pagina di un autore e premi «Segui»; qui compariranno i suoi casi nuovi."))
      );
      return;
    }
    const page = await fetchCards(queryFilters(), cursor);
    if (id !== requestId) return; // the person changed the filters meanwhile
    cursor = page.cursor;
    done = page.done;
    if (state.user) {
      const found = await fetchLiked(
        state.user.uid,
        page.cards.map((c) => c.code)
      );
      for (const code of found) state.liked.add(code);
      if (id !== requestId) return;
    }
    const saved = new Map(store.list().map((entry) => [entry.id, entry]));
    const firstNew = grid.children.length;
    for (const card of page.cards) {
      const node = renderCard(card, saved);
      if (node) grid.appendChild(node);
    }
    shown = grid.children.length;
    moreButton.hidden = done;
    statusLine.textContent = shown === 0 ? "" : shown === 1 ? t("1 caso") : t("{count} casi", { count: shown });
    if (shown === 0) showEmpty();
    else if (!reset && grid.children[firstNew]) announce(t("Caricati altri casi: ora {count}.", { count: shown }));
  } catch (error) {
    if (id !== requestId) return;
    statusLine.textContent = "";
    showError(describeReason(error?.reason ?? "network", error?.details));
  }
}

function showEmpty() {
  clear(notice);
  if (state.scope === "mine")
    notice.append(el("p", {}, t("Non hai ancora pubblicato nessun caso: puoi farlo dall'editor, con «🌐 Pubblica».")));
  else if (state.scope === "feed") notice.append(el("p", {}, t("Gli autori che segui non hanno ancora casi pubblici.")));
  else if (state.scope === "all") notice.append(el("p", {}, t("Non c'è nessun caso.")));
  else if (hasFilters())
    notice.append(
      el("p", {}, t("Nessun caso corrisponde a questi filtri.")),
      el("button", { type: "button", onClick: () => resetFilters() }, t("Azzera i filtri"))
    );
  else notice.append(el("p", {}, t("Non c'è ancora nessun caso pubblicato: pubblica il primo dall'editor!")));
}

function showError(text) {
  clear(notice);
  notice.append(
    el("p", { class: "violation", role: "alert" }, t("Non riesco a caricare l'elenco: {message}", { message: text })),
    el("button", { type: "button", "data-key": "retry", onClick: () => load(true) }, t("Riprova"))
  );
}

// ---- a card ------------------------------------------------------------------------------------------------------------
function renderCard(card, saved) {
  if (!isCaseCode(card.code)) return null;
  const title = str(card.title, 80) || t("(senza titolo)");
  const rows = whole(card.rows);
  const cols = whole(card.cols);
  const characters = whole(card.characters);
  const clues = whole(card.clues);
  const code = card.code;
  const mine = state.scope !== "gallery";
  const local = saved.get(`shared_${code}`);

  const map =
    rows && cols
      ? miniMapSvg(card.preview, rows, cols, rows && cols ? t("Mappa del caso, {rows} righe per {cols} colonne", { rows, cols }) : "")
      : null;
  const facts = [
    rows && cols ? `${rows}×${cols}` : null,
    characters ? t("{n} personaggi", { n: characters }) : null,
    clues === 1 ? t("1 indizio") : clues ? t("{n} indizi", { n: clues }) : null,
  ]
    .filter(Boolean)
    .map((fact) => fact.replace(/ /g, "\u00a0")) // each fact stays on one line, the line breaks fall between them
    .join(" · ");

  const badges = [];
  const badge = (text, kind = "") => badges.push(el("span", { class: `case-badge ${kind}`.trim() }, text));
  if (card.difficulty)
    badge(difficultyLabel(card.difficulty), `difficulty-badge difficulty-${String(card.difficulty).replace(/[^a-z-]/g, "")}`);
  if (card.lang === "it" || card.lang === "en") badge(card.lang === "it" ? "IT" : "EN");
  badge(card.license === "cc-by" ? `🧬 ${t("Remix consentito")}` : `🔒 ${t("Solo da giocare")}`);
  for (const x of Array.isArray(card.tags) ? card.tags.slice(0, 3) : []) if (TAGS.includes(x)) badge(tagLabel(x));
  if (local?.completed) badge(`✓ ${t("Risolto da te")}`, "ok");
  else if (local) badge(t("Già nel tuo browser"));
  if (mine) {
    if (card.status === "withdrawn") badge(t("Ritirato"), "warn");
    else if (card.status === "hidden") badge(t("Nascosto dalla moderazione"), "warn");
    else if (card.listed === false) badge(t("Non in elenco: si apre solo con il codice"), "warn");
  }

  const author = str(card.authorNick, 40);
  const clickable = author && typeof card.authorUid === "string" && card.authorUid !== "deleted" && !mine;
  const authorNode = clickable
    ? el(
        "button",
        {
          type: "button",
          class: "link-button",
          "data-key": "author-link",
          title: t("Apri la pagina di questo autore"),
          onClick: () => openAuthor(card.authorUid, author),
        },
        author
      )
    : author;
  const stats = card.stats ?? {};
  const counters = [
    whole(stats.opened) !== null ? t("👥 {n} hanno provato", { n: whole(stats.opened) }) : null,
    whole(stats.solved) !== null ? t("✓ {n} risolti", { n: whole(stats.solved) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const likeButton = renderLike(card);
  const own = state.user && card.authorUid === state.user.uid;
  const reportButton =
    mine || own
      ? null
      : el("button", { type: "button", class: "link-button", "data-key": "report", onClick: () => openReport(code) }, t("Segnala"));

  const localId = mine ? registry.findPublishedByCode(code) : null;
  const actions = [
    el("a", { class: "button-link primary", href: `player.html?c=${code}`, "data-key": "play" }, t("Gioca")),
    el(
      "button",
      {
        type: "button",
        "data-key": "copy-link",
        onClick: async (e) => {
          try {
            await navigator.clipboard.writeText(caseLink(code, location.href));
            announce(t("Link copiato: chi lo apre può giocare il caso subito."));
            e.target.textContent = t("Link copiato");
          } catch {
            announce(t("Impossibile copiare il link negli appunti."));
          }
        },
      },
      t("Copia il link")
    ),
  ];
  if (localId && store.get(localId))
    actions.push(
      el("a", { class: "button-link", href: `editor.html?id=${encodeURIComponent(localId)}`, "data-key": "edit" }, t("✏️ Apri nell'editor"))
    );

  return el("li", { class: "case-card", "data-code": code }, [
    el("div", { class: "case-card-map" }, [map ?? el("span", { class: "case-card-nomap", "aria-hidden": "true" }, "🗺️")]),
    el("div", { class: "case-card-body" }, [
      el("h2", { class: "case-title" }, title),
      el("p", { class: "case-meta muted" }, [
        author ? `${t("Autore:")} ` : "",
        author ? authorNode : "",
        author && facts ? " · " : "",
        facts,
      ]),
      str(card.blurb, 280) ? el("p", { class: "case-blurb" }, str(card.blurb, 280)) : null,
      el("p", { class: "case-badges" }, badges),
      counters ? el("p", { class: "case-counters muted", "data-key": "counters" }, counters) : null,
      el("div", { class: "case-actions" }, [
        ...actions,
        likeButton,
        reportButton,
        el("span", { class: "case-code", title: t("Codice del caso") }, formatCode(code)),
      ]),
    ]),
  ]);
}

// ---- likes, reports, the page of an author --------------------------------------------------------------------------------
// Asks for the sign-in when the person is not in (the action then waits for them to press it again): -> true when signed in.
async function needSignIn() {
  if (state.hasAccount) return true;
  const account = await requireAccount(); // quick when they are in and have a nickname; otherwise the window asks
  if (!account) return false;
  state.user = account.user;
  state.hasAccount = true;
  return true;
}

function renderLike(card) {
  const own = state.user && card.authorUid === state.user.uid;
  const mine = state.scope === "mine" || state.scope === "all";
  const likes = whole(card.stats?.likes) ?? 0;
  let liked = state.liked.has(card.code);
  let count = likes;
  const button = el("button", { type: "button", class: "like-button", "data-key": "like", "aria-pressed": String(liked) });
  const paint = () => {
    button.setAttribute("aria-pressed", String(liked));
    button.textContent = `${liked ? "♥" : "♡"} ${count}`;
    button.title = liked ? t("Non mi piace più") : t("Mi piace");
    button.setAttribute(
      "aria-label",
      liked ? t("Non mi piace più: {n} mi piace", { n: count }) : t("Mi piace: {n} mi piace finora", { n: count })
    );
  };
  paint();
  if (own || mine) button.disabled = true;
  button.addEventListener("click", async () => {
    if (!(await needSignIn())) return;
    const wanted = !liked;
    button.disabled = true;
    try {
      const out = await community.setLike(card.code, wanted);
      liked = out.liked;
      count = out.likes;
      if (liked) state.liked.add(card.code);
      else state.liked.delete(card.code);
      paint();
    } catch (error) {
      announce(describeReason(error?.reason ?? "network", error?.details));
      clear(notice);
      notice.append(el("p", { class: "violation", role: "alert" }, describeReason(error?.reason ?? "network", error?.details)));
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

// The window to report a case (src/community/reportDialog.js).
async function openReport(code) {
  if (!(await needSignIn())) return;
  openReportDialog({
    submit: (report) => community.reportCase({ code, ...report }),
    onSent: () => {
      clear(notice);
      notice.append(el("p", { role: "status", "data-key": "report-done" }, t("Grazie: la segnalazione è arrivata.")));
    },
  });
}

// The page of an author: who they are, a few lines about them, how many cases and followers, "Segui", and their cases below.
async function openAuthor(uid, nick) {
  state.filters.authorUid = uid;
  state.filters.authorNick = nick;
  state.scope = "gallery";
  state.profile = null;
  state.iFollow = false;
  history.replaceState(null, "", `community.html?author=${encodeURIComponent(uid)}`);
  refresh();
  try {
    const [profile, following] = await Promise.all([fetchAuthor(uid), state.user ? isFollowing(state.user.uid, uid) : false]);
    if (state.filters.authorUid !== uid) return;
    state.profile = profile;
    state.iFollow = following;
    renderProfile();
  } catch {
    // no page to show: the cases are listed all the same
  }
}

function closeAuthor() {
  state.filters.authorUid = "";
  state.filters.authorNick = "";
  state.profile = null;
  history.replaceState(null, "", "community.html");
  refresh();
}

function renderProfile() {
  const uid = state.filters.authorUid;
  profileBox.hidden = !uid || state.scope !== "gallery";
  clear(profileBox);
  if (profileBox.hidden) return;
  const p = state.profile;
  const self = state.user && state.user.uid === uid;
  const followersText = p ? (p.followers === 1 ? t("1 follower") : t("{n} follower", { n: p.followers })) : "";
  const casesText = p ? (p.caseCount === 1 ? t("1 caso") : t("{count} casi", { count: p.caseCount })) : "";
  const follow = el(
    "button",
    {
      type: "button",
      class: state.iFollow ? "" : "primary",
      "data-key": "follow",
      "aria-pressed": String(state.iFollow),
      onClick: async () => {
        if (!(await needSignIn())) return;
        follow.disabled = true;
        try {
          const out = await community.followAuthor(uid, !state.iFollow);
          state.iFollow = out.following;
          if (state.profile) state.profile.followers = out.followers;
          const list = await fetchFollowing(state.user.uid);
          state.following = list;
          renderProfile();
        } catch (error) {
          clear(notice);
          notice.append(el("p", { class: "violation", role: "alert" }, describeReason(error?.reason ?? "network", error?.details)));
          follow.disabled = false;
        }
      },
    },
    state.iFollow ? t("✓ Segui già: smetti di seguire") : t("➕ Segui")
  );
  profileBox.append(
    el("h2", { class: "profile-name" }, p?.nick || state.filters.authorNick),
    p ? el("p", { class: "muted profile-counts", "data-key": "profile-counts" }, `${casesText} · ${followersText}`) : null,
    p?.bio ? el("p", { class: "profile-bio", "data-key": "profile-bio" }, p.bio) : null,
    el("div", { class: "field-row" }, [
      self ? null : follow,
      self && p ? el("button", { type: "button", "data-key": "bio-edit", onClick: () => editBio() }, t("Modifica la presentazione")) : null,
      el("button", { type: "button", "data-key": "author-clear", onClick: closeAuthor }, t("Mostra tutti i casi")),
    ])
  );
}

function editBio() {
  const area = el("textarea", { rows: "4", maxlength: String(LIMITS.bioMax), "aria-label": t("Presentazione"), "data-key": "bio-input" });
  area.value = state.profile?.bio ?? "";
  const notice2 = el("p", { class: "violation", role: "alert" });
  notice2.hidden = true;
  const save = el(
    "button",
    {
      type: "button",
      class: "primary",
      "data-key": "bio-save",
      onClick: async () => {
        save.disabled = true;
        try {
          const out = await community.setAuthorProfile(area.value);
          state.profile.bio = out.bio;
          renderProfile();
        } catch (error) {
          notice2.textContent = describeReason(error?.reason ?? "network", error?.details);
          notice2.hidden = false;
          save.disabled = false;
        }
      },
    },
    t("Salva")
  );
  clear(profileBox);
  profileBox.append(
    el("h2", {}, t("La tua presentazione")),
    el(
      "p",
      { class: "muted" },
      t("Poche righe su di te, visibili a tutti nella tua pagina da autore (al massimo {max} caratteri).", { max: LIMITS.bioMax })
    ),
    area,
    notice2,
    el("div", { class: "field-row" }, [save, el("button", { type: "button", onClick: () => renderProfile() }, t("Annulla"))])
  );
  area.focus();
}

// ---- authors -----------------------------------------------------------------------------------------------------------
async function showAuthors(text) {
  clear(authorsFound);
  if (!text.trim()) {
    authorsFound.hidden = true;
    return;
  }
  try {
    const found = await searchAuthors(text);
    authorsFound.hidden = false;
    if (found.length === 0) authorsFound.append(el("p", { class: "muted" }, t("Nessun autore con questo nome.")));
    else
      authorsFound.append(
        el("p", { class: "muted" }, t("Autori trovati:")),
        ...found.map((a) =>
          el(
            "button",
            {
              type: "button",
              "data-key": "author-pick",
              onClick: () => {
                authorsFound.hidden = true;
                searchInput.value = "";
                openAuthor(a.uid, a.nick);
              },
            },
            `${a.nick} (${a.caseCount})`
          )
        )
      );
  } catch (error) {
    authorsFound.hidden = false;
    authorsFound.append(el("p", { class: "violation" }, describeReason(error?.reason ?? "network")));
  }
}

// ---- sign in -----------------------------------------------------------------------------------------------------------
async function signInNow() {
  try {
    await signIn();
  } catch (error) {
    wantScope = "";
    clear(notice);
    notice.append(el("p", { class: "violation", role: "alert" }, describeAuthError(error)));
  }
}

function renderAuthBar() {
  clear(authBar);
  if (state.user) {
    authBar.append(
      el("span", { class: "muted" }, state.user.email ?? ""),
      el("button", { type: "button", onClick: () => signOutUser() }, t("Esci"))
    );
  } else {
    authBar.append(el("button", { type: "button", "data-key": "signin", onClick: () => signInNow() }, t("Accedi con Google")));
  }
}

// The little dot on "Novità": is there a case of an author this person follows that is newer than the last time they looked?
async function checkFeedDot() {
  feedDot.hidden = true;
  if (!state.user || state.following.length === 0) return;
  try {
    const page = await fetchCards({ scope: "feed", authors: state.following.map((a) => a.uid) }, null, 1);
    const newest = page.cards[0];
    if (!newest) return;
    const created = typeof newest.createdAt?.toMillis === "function" ? newest.createdAt.toMillis() : Date.parse(newest.createdAt);
    const seen = Number(readJson(FEED_SEEN_KEY, 0)) || 0;
    feedDot.hidden = !(created > seen) || state.scope === "feed";
  } catch {
    // the dot is a courtesy
  }
}

onAuthChange(async (user) => {
  const before = state.user?.uid;
  state.user = user;
  registry.setSignedIn(Boolean(user));
  if (!user || before !== user.uid) state.hasAccount = false;
  state.admin = user ? await isAdmin(user.uid) : false;
  state.following = user ? await fetchFollowing(user.uid) : [];
  if (state.filters.authorUid) {
    // the page of an author may have been opened (from a link) before the account was known
    state.iFollow = state.following.some((a) => a.uid === state.filters.authorUid);
    renderProfile();
  }
  if (!user || before !== user.uid) state.liked = new Set();
  renderAuthBar();
  checkFeedDot();
  if (!user && state.scope !== "gallery") state.scope = "gallery";
  else if (user && wantScope) {
    state.scope = wantScope;
    if (wantScope === "feed") tryWriteJson(FEED_SEEN_KEY, Date.now());
  } else if (!state.admin && state.scope === "all") state.scope = "gallery";
  else {
    syncControls();
    if (user && before !== user.uid) load(true); // the hearts of this person on the cards already shown
    return;
  }
  wantScope = "";
  refresh();
});

// A link to the page of an author (community.html?author=...) opens it.
const linkedAuthor = new URLSearchParams(location.search).get("author");
renderAuthBar();
if (linkedAuthor && linkedAuthor.length <= 128) openAuthor(linkedAuthor, "");
else refresh();
