import "../i18n/i18n.js";
import { el, clear, qs } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { onAuthChange, signIn, signOutUser } from "../auth/googleAuth.js";
import { describeAuthError, renderLoginHelp } from "../auth/loginHelp.js";
import { importPuzzleFromUrl } from "../storage/importExport.js";
import { readJson, tryWriteJson, remove } from "../storage/storage.js";
import { createBoardState, serializeBoardState, deserializeBoardState } from "../player/board.js";
import { createGameScreen } from "../player/gameScreen.js";
import { loadLibraryIndex, caseOfTheDay } from "../player/libraryPanel.js";
import { formatElapsed } from "../util/time.js";
import * as dailyStore from "./dailyStore.js";
import { utcDateKey, previousDateKey, rankEntries, positionOf, validateNickname, NICKNAME_MAX } from "./dailyMath.js";
import { NICKNAME_ERRORS } from "./nicknameErrors.js";
import { getLanguage, t, intlLocale } from "../i18n/i18n.js";

wireThemeToggle();

// The daily challenge: today's case (the library's "case of the day", the same for everybody), played with no hints,
// scored by the time really spent; one scored run per signed-in player per day, ranked on a public board by nickname.
// The times are the player's own report (nothing checks the solve): a friendly board, not a proof.

const gateEl = qs("#gate");
const introEl = qs("#daily-intro");
const infoEl = qs("#daily-info");
const nicknameEl = qs("#nickname-panel");
const gameEl = qs("#game");
const timerEl = qs("#timer");
const authBar = qs("#auth-bar");
const boardSection = qs("#leaderboard");
const boardPanel = qs("#leaderboard-panel");

const dateKey = utcDateKey();
const progressKey = `murdoku:daily:${dateKey}`;
const pendingKey = `murdoku:daily-pending:${dateKey}`;

let user = null;
let nickname = null;
let boardTab = "today"; // "today" | "yesterday"
let result = null; // { rank, of } once this player's run is on the board

function renderAuthBar() {
  clear(authBar);
  if (!user) return;
  authBar.appendChild(el("span", { class: "muted" }, user.email));
  authBar.appendChild(el("button", { onClick: () => signOutUser() }, t("Esci")));
}

function renderGate() {
  clear(gateEl);
  gateEl.classList.remove("hidden");
  gateEl.appendChild(el("h1", {}, t("Sfida del giorno")));
  gateEl.appendChild(
    el(
      "p",
      { class: "lede" },
      t(
        "Un caso al giorno, uguale per tutti, senza suggerimenti. Accedi con Google per giocarlo e comparire in classifica con un nickname a tua scelta."
      )
    )
  );
  gateEl.appendChild(
    el(
      "button",
      {
        class: "primary",
        onClick: () => signIn().catch((err) => gateEl.appendChild(el("p", { class: "violation" }, describeAuthError(err)))),
      },
      t("Accedi con Google")
    )
  );
  gateEl.appendChild(renderLoginHelp());
}

const localDate = () =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function setInfo(children) {
  clear(infoEl);
  for (const c of children) if (c) infoEl.appendChild(c);
}

// ---- nickname ----------------------------------------------------------------------------

function askNickname(onDone) {
  clear(nicknameEl);
  nicknameEl.classList.remove("hidden");
  const input = el("input", {
    type: "text",
    maxlength: String(NICKNAME_MAX),
    "aria-label": t("Nickname"),
    "data-key": "nickname",
    placeholder: t("Il tuo nickname"),
  });
  const notice = el("p", { class: "violation", role: "alert" });
  notice.hidden = true;
  const submit = async () => {
    notice.hidden = true;
    const checked = validateNickname(input.value);
    if (!checked.ok) {
      notice.textContent = NICKNAME_ERRORS[checked.error]();
      notice.hidden = false;
      return;
    }
    button.disabled = true;
    try {
      const outcome = await dailyStore.chooseNickname(user.uid, checked.nickname);
      if (!outcome.ok) {
        notice.textContent = NICKNAME_ERRORS[outcome.error]();
        notice.hidden = false;
        return;
      }
      nickname = outcome.nickname;
      nicknameEl.classList.add("hidden");
      onDone();
    } catch (err) {
      notice.textContent = t("Non sono riuscito a salvare il nickname: {message}", { message: err.message });
      notice.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
  const button = el("button", { type: "button", class: "primary", "data-key": "nickname-go", onClick: submit }, t("Scegli"));
  input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
  nicknameEl.append(
    el("h2", {}, t("Scegli un nickname")),
    el(
      "p",
      { class: "muted" },
      t("È il nome che gli altri vedranno in classifica (non l'indirizzo email). Puoi cambiarlo o cancellarlo dalla pagina Privacy.")
    ),
    el("div", { class: "field-row" }, [input, button]),
    notice
  );
  input.focus();
}

// ---- the board ----------------------------------------------------------------------------

async function renderBoard() {
  boardSection.classList.remove("hidden");
  clear(boardPanel);
  const key = boardTab === "today" ? dateKey : previousDateKey(dateKey);
  const tabs = el(
    "div",
    { class: "field-row", role: "tablist" },
    [
      ["today", t("Oggi")],
      ["yesterday", t("Ieri")],
    ].map(([id, label]) =>
      el(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": String(boardTab === id),
          class: boardTab === id ? "primary" : "",
          onClick: () => ((boardTab = id), renderBoard()),
        },
        label
      )
    )
  );
  boardPanel.append(el("h2", {}, t("Classifica")), tabs);
  const body = el("div", { "aria-live": "polite" }, el("p", { class: "muted" }, t("Caricamento…")));
  boardPanel.appendChild(body);
  try {
    const entries = rankEntries(await dailyStore.getBoard(key));
    clear(body);
    if (entries.length === 0) {
      body.appendChild(el("p", { class: "muted" }, t("Nessuno ha ancora giocato.")));
      return;
    }
    const mine = positionOf(entries, user?.uid);
    if (mine && boardTab === "today")
      body.appendChild(el("p", { class: "ok-message" }, t("Sei {rank}° su {of}.", { rank: mine.rank, of: mine.of })));
    const table = el("table", { class: "daily-board" }, [
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          [t("Pos."), t("Giocatore"), t("Tempo"), t("Verifiche sbagliate")].map((h) => el("th", { scope: "col" }, h))
        )
      ),
      el(
        "tbody",
        {},
        entries.map((e) =>
          el("tr", { class: e.uid === user?.uid ? "mine" : "" }, [
            el("td", {}, String(e.rank)),
            el("td", {}, e.uid === user?.uid ? `${e.nickname} ${t("(tu)")}` : e.nickname),
            el("td", {}, formatElapsed(e.seconds)),
            el("td", {}, String(e.checks)),
          ])
        )
      ),
    ]);
    body.appendChild(table);
  } catch (err) {
    clear(body);
    body.appendChild(el("p", { class: "violation" }, t("Non riesco a caricare la classifica: {message}", { message: err.message })));
  }
}

// ---- the run ----------------------------------------------------------------------------------

// Sends a finished run; remembered locally until the board accepts it, so a failed send can be retried.
async function sendRun(run) {
  tryWriteJson(pendingKey, run);
  await dailyStore.submitRun(user.uid, dateKey, run);
  remove(pendingKey);
}

async function showFinished(mine) {
  gameEl.classList.add("hidden");
  timerEl.classList.add("hidden");
  setInfo([
    el("h2", {}, t("Sfida di oggi completata")),
    el(
      "p",
      { class: "ok-message" },
      t("Il tuo tempo: {time} · verifiche sbagliate: {checks}", { time: formatElapsed(mine.seconds), checks: mine.checks })
    ),
    el(
      "p",
      { class: "muted" },
      t("Una sola partita valida al giorno: torna domani per il prossimo caso, o gioca gli altri casi nel gioco libero.")
    ),
    el("p", {}, el("a", { class: "play", href: "player.html" }, t("Gioco libero"))),
  ]);
  await renderBoard();
}

async function startGame(libraryEntry) {
  const lang = getLanguage();
  let puzzle;
  try {
    puzzle = await importPuzzleFromUrl(libraryEntry.files[lang] ?? libraryEntry.files.en);
  } catch (err) {
    setInfo([el("p", { class: "violation" }, t("Non riesco a caricare il caso di oggi: {message}", { message: err.message }))]);
    return;
  }
  const state = deserializeBoardState(readJson(progressKey, null)) ?? createBoardState();
  const resuming = state.activeSeconds > 0 || state.placements.size > 0;
  const persistProgress = () => tryWriteJson(progressKey, serializeBoardState(state));
  const finish = { sent: false };

  const screen = createGameScreen({
    puzzle,
    state,
    persistProgress,
    achievementKey: `daily:${dateKey}:${libraryEntry.id}`,
    challenge: { noHints: true },
    onSolved: async (seconds, { checks }) => {
      const run = { nickname, seconds, checks, caseId: libraryEntry.id };
      try {
        await sendRun(run);
        finish.sent = true;
        const entries = await dailyStore.getBoard(dateKey);
        result = positionOf(entries, user.uid);
      } catch (err) {
        finish.error = err.message;
      }
    },
    winExtras: () => {
      if (finish.sent) {
        return el("div", { class: "result-banner success", role: "status" }, [
          t("🏆 Risultato inviato alla classifica."),
          result ? ` ${t("Sei {rank}° su {of}.", { rank: result.rank, of: result.of })}` : "",
        ]);
      }
      return el("div", { class: "result-banner hint-error", role: "alert" }, [
        t("Non sono riuscito a inviare il risultato: {message}", { message: finish.error ?? "?" }),
        " ",
        el(
          "button",
          {
            type: "button",
            onClick: async (e) => {
              e.target.disabled = true;
              try {
                await sendRun(readJson(pendingKey, null));
                location.reload();
              } catch (err) {
                e.target.disabled = false;
                e.target.parentElement.firstChild.textContent = t("Non sono riuscito a inviare il risultato: {message}", {
                  message: err.message,
                });
              }
            },
          },
          t("Riprova a inviare")
        ),
      ]);
    },
  });

  const begin = () => {
    introEl.classList.add("hidden");
    gameEl.classList.remove("hidden");
    timerEl.classList.remove("hidden");
    qs("#player-title").textContent = puzzle.title;
    screen.start();
  };

  setInfo([
    el("h2", {}, t("Sfida del giorno · {date}", { date: localDate() })),
    el("p", {}, [
      el("strong", {}, libraryEntry.title[lang] ?? libraryEntry.title.en),
      ` · ${libraryEntry.size[0]}×${libraryEntry.size[1]} · ${t("{count} personaggi", { count: libraryEntry.characters })}`,
    ]),
    el("ul", { class: "muted" }, [
      el("li", {}, t("Niente suggerimenti.")),
      el("li", {}, t("Conta il tempo in cui la pagina è aperta e visibile; una sola partita valida al giorno.")),
      el("li", {}, t("A parità di tempo vince chi ha sbagliato meno verifiche.")),
    ]),
    el(
      "button",
      { type: "button", class: "primary", "data-key": "daily-start", onClick: begin },
      resuming ? t("Riprendi la sfida") : t("Inizia la sfida")
    ),
  ]);
  await renderBoard();
}

async function enter() {
  gateEl.classList.add("hidden");
  introEl.classList.remove("hidden");
  setInfo([el("p", { class: "muted" }, t("Caricamento…"))]);
  let libraryEntry = null;
  try {
    libraryEntry = caseOfTheDay(await loadLibraryIndex());
  } catch {
    libraryEntry = null;
  }
  if (!libraryEntry) {
    setInfo([
      el("h2", {}, t("Nessuna sfida oggi")),
      el(
        "p",
        { class: "muted" },
        t("La libreria dei casi non ne ha ancora, quindi oggi non c'è un caso del giorno. Intanto puoi giocare i tuoi casi.")
      ),
      el("p", {}, el("a", { class: "play", href: "player.html" }, t("Gioco libero"))),
    ]);
    return;
  }
  try {
    nickname = await dailyStore.getNickname(user.uid);
  } catch (err) {
    setInfo([el("p", { class: "violation" }, t("Non riesco a leggere il tuo profilo: {message}", { message: err.message }))]);
    return;
  }
  const proceed = async () => {
    try {
      // a run that was finished but not sent (offline, closed too soon): send it now
      const pending = readJson(pendingKey, null);
      if (pending && pending.nickname === nickname) await sendRun(pending).catch(() => {});
      const mine = await dailyStore.getMyEntry(user.uid, dateKey);
      if (mine) return showFinished(mine);
    } catch (err) {
      setInfo([el("p", { class: "violation" }, t("Non riesco a leggere la tua partita di oggi: {message}", { message: err.message }))]);
      return;
    }
    await startGame(libraryEntry);
  };
  if (!nickname) {
    setInfo([
      el("h2", {}, t("Sfida del giorno · {date}", { date: localDate() })),
      el("p", { class: "muted" }, t("Prima di cominciare scegli il nickname con cui comparire in classifica.")),
    ]);
    askNickname(proceed);
    await renderBoard();
    return;
  }
  await proceed();
}

onAuthChange((u) => {
  user = u;
  renderAuthBar();
  if (!u) {
    introEl.classList.add("hidden");
    gameEl.classList.add("hidden");
    boardSection.classList.add("hidden");
    renderGate();
    return;
  }
  enter();
});
