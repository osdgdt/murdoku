// The "Pubblica" window of the editor: put a case in the shared database (so that anybody can open it with a short code, a
// link or a QR), publish a new revision of it, take it offline or delete it. The rules are in src/community/casePolicy.js
// (the server checks them again: functions/src/handlers.js); everything that needs Firebase (sign-in, nickname, the Cloud
// Functions) is loaded only when this window is opened and something needs it, so the editor itself stays offline-friendly.
// A native <dialog>: it traps focus, closes with Escape and is announced as a dialog.
import { el, clear } from "../util/dom.js";
import { t, getLanguage } from "../i18n/i18n.js";
import { announce } from "../util/announcer.js";
import { DIFFICULTY_LEVELS } from "../model/puzzle.js";
import {
  LIMITS,
  LICENSES,
  TAGS,
  isSharedPuzzleId,
  validatePublishMeta,
  validatePuzzleForPublish,
  formatCode,
  caseLink,
} from "../community/casePolicy.js";
import { qrSvg } from "../community/qr.js";
import { describeMetaErrors, describePuzzleErrors, describeReason, tagLabel, LICENSE_LABELS } from "../community/messages.js";
import * as registry from "../community/localRegistry.js";
import * as achievementsStore from "../storage/achievementsStore.js";
import { describeAuthError, renderLoginHelp } from "../auth/loginHelp.js";
import { validateNickname, NICKNAME_MAX } from "../daily/dailyMath.js";
import { NICKNAME_ERRORS } from "../daily/nicknameErrors.js";

const reasonOf = (error) => error?.reason ?? "internal";

// Did this person play this very case to the end (on this device)? The server wants the same, from the synced copy.
const hasSolved = (puzzleId) => Boolean(achievementsStore.getRawData()?.solves?.[`puzzle:${puzzleId}`]);

// A line of feedback inside the window: errors are announced at once (role=alert), news politely.
function noticeBox() {
  const node = el("div", { class: "publish-notice", "data-key": "publish-notice" });
  const set = (kind, nodes) => {
    clear(node);
    node.setAttribute("role", kind === "error" ? "alert" : "status");
    node.className = `publish-notice ${kind}`;
    for (const n of [].concat(nodes)) node.appendChild(typeof n === "string" ? el("p", {}, n) : n);
  };
  return {
    node,
    error: (text) => set("error", text),
    errors: (texts) =>
      set(
        "error",
        texts.length === 1
          ? texts[0]
          : el(
              "ul",
              {},
              texts.map((x) => el("li", {}, x))
            )
      ),
    info: (text) => set("info", text),
    clear: () => {
      clear(node);
      node.className = "publish-notice";
    },
  };
}

// getPuzzle(): the case being edited, now. confirmPublishable(): the editor's own check that the case has ONE solution
// (it shows its progress bar in the page behind, so the window steps aside while it runs). onPlay(): go and play it.
export function openPublishDialog({ getPuzzle, confirmPublishable, onPlay }) {
  const dialog = el("dialog", { class: "publish-dialog", "aria-labelledby": "publish-title" });
  const body = el("div", { class: "publish-body" });
  dialog.append(el("h2", { id: "publish-title" }, t("Pubblica nel database dei casi")), body);

  let ignoreClose = 0; // the window steps aside while the solver works: that "close" is not the end
  let closed = false;
  let abandon = null; // answers the question on the screen with "nothing" when the window is closed
  dialog.addEventListener("close", () => {
    if (ignoreClose > 0) {
      ignoreClose--;
      return;
    }
    closed = true;
    abandon?.();
    dialog.remove();
  });
  document.body.appendChild(dialog);
  dialog.showModal();

  const show = (...nodes) => {
    clear(body);
    body.append(...nodes.filter(Boolean));
  };
  const working = (text) => show(el("p", { class: "publish-working", role: "status", "data-key": "publish-working" }, text));
  const closeButton = (label = t("Chiudi")) => el("button", { type: "button", onClick: () => dialog.close() }, label);
  const ask = (render) =>
    new Promise((resolve) => {
      abandon = () => resolve(null);
      render(resolve);
    });

  // ---- the part that needs Firebase ---------------------------------------------------------------------------------
  let backendPromise = null;
  async function backend() {
    backendPromise ??= Promise.all([
      import("../community/communityStore.js"),
      import("../auth/googleAuth.js"),
      import("../daily/dailyStore.js"),
      import("../storage/achievementsSyncStore.js"),
    ]).then(([community, auth, daily, sync]) => ({ community, auth, daily, sync }));
    try {
      return await backendPromise;
    } catch {
      backendPromise = null;
      throw Object.assign(new Error("network"), { reason: "network" }); // offline: the modules are on Google's servers
    }
  }

  const currentUser = (auth) =>
    new Promise((resolve) => {
      const off = auth.onAuthChange((user) => {
        resolve(user);
        queueMicrotask(() => off());
      });
    });

  const askSignIn = (auth) => (resolve) => {
    const note = noticeBox();
    const go = el(
      "button",
      {
        type: "button",
        class: "primary",
        "data-key": "publish-signin",
        onClick: async () => {
          go.disabled = true;
          try {
            resolve((await auth.signIn()).user);
          } catch (err) {
            note.error(describeAuthError(err));
            go.disabled = false;
          }
        },
      },
      t("Accedi con Google")
    );
    show(
      el(
        "p",
        {},
        t(
          "Per pubblicare serve un account Google e un nickname. Il nickname è il nome con cui sarai riconosciuto come autore: l'email non si vede mai."
        )
      ),
      el("p", { class: "muted" }, t("Per giocare i casi degli altri non serve nessun accesso.")),
      el("div", { class: "publish-actions" }, [el("button", { type: "button", onClick: () => resolve(null) }, t("Annulla")), go]),
      note.node,
      renderLoginHelp()
    );
  };

  const askNickname = (b, user) => (resolve) => {
    const note = noticeBox();
    const input = el("input", {
      type: "text",
      maxlength: String(NICKNAME_MAX),
      "aria-label": t("Nickname"),
      placeholder: t("Il tuo nickname"),
      "data-key": "publish-nickname",
    });
    const submit = async () => {
      note.clear();
      const checked = validateNickname(input.value);
      if (!checked.ok) return note.error(NICKNAME_ERRORS[checked.error]());
      go.disabled = true;
      try {
        const outcome = await b.daily.chooseNickname(user.uid, checked.nickname);
        if (!outcome.ok) note.error(NICKNAME_ERRORS[outcome.error]());
        else resolve(outcome.nickname);
      } catch (err) {
        note.error(t("Non sono riuscito a salvare il nickname: {message}", { message: err.message }));
      } finally {
        go.disabled = false;
      }
    };
    const go = el("button", { type: "button", class: "primary", "data-key": "publish-nickname-go", onClick: submit }, t("Scegli"));
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    show(
      el("h3", {}, t("Scegli un nickname")),
      el(
        "p",
        { class: "muted" },
        t("Sarà il nome dell'autore su tutti i casi che pubblichi (e in classifica nella sfida del giorno). Non è l'indirizzo email.")
      ),
      el("div", { class: "field-row" }, [input, go]),
      el("div", { class: "publish-actions" }, [el("button", { type: "button", onClick: () => resolve(null) }, t("Annulla"))]),
      note.node
    );
  };

  // Signed in with a nickname: { b, user, nickname }, or null when the person gave up on the way.
  async function ensureReady() {
    const b = await backend();
    let user = await currentUser(b.auth);
    if (!user) user = await ask(askSignIn(b.auth));
    if (!user || closed) return null;
    let nickname = await b.daily.getNickname(user.uid);
    if (!nickname) nickname = await ask(askNickname(b, user));
    if (!nickname || closed) return null;
    return { b, user, nickname };
  }

  // The editor's uniqueness check, with this window out of the way (it would cover the progress bar and its Cancel).
  async function runCheck() {
    ignoreClose++;
    dialog.close();
    try {
      return await confirmPublishable();
    } finally {
      if (!closed) dialog.showModal();
    }
  }

  // ---- the form -----------------------------------------------------------------------------------------------------
  function defaultValues(entry) {
    const puzzle = getPuzzle();
    return {
      title: puzzle.title || "",
      blurb: "",
      lang: getLanguage(),
      difficulty: puzzle.difficulty || "",
      tags: [],
      license: entry?.license ?? "",
      listed: true,
    };
  }

  function renderForm({ mode, entry = null, values = defaultValues(entry), error = null, forget = false }) {
    const note = noticeBox();
    if (error) note.error(error);
    const update = mode === "update";
    const field = (label, control, hint) =>
      el("div", { class: "publish-field" }, [
        el("label", {}, [el("span", { class: "publish-label" }, label), control]),
        hint && el("p", { class: "muted" }, hint),
      ]);

    const titleInput = el("input", {
      type: "text",
      maxlength: String(LIMITS.titleMax),
      value: values.title,
      "data-key": "publish-title-input",
    });
    const blurbInput = el("textarea", { rows: "3", maxlength: String(LIMITS.blurbMax), "data-key": "publish-blurb" });
    blurbInput.value = values.blurb;
    const langSelect = el("select", { "data-key": "publish-lang" }, [
      el("option", { value: "it", selected: values.lang === "it" || undefined, "data-no-i18n": "" }, "Italiano"),
      el("option", { value: "en", selected: values.lang === "en" || undefined, "data-no-i18n": "" }, "English"),
    ]);
    const diffSelect = el("select", { "data-key": "publish-difficulty" }, [
      el("option", { value: "" }, t("Scegli…")),
      ...DIFFICULTY_LEVELS.filter((d) => d.value).map((d) =>
        el("option", { value: d.value, selected: values.difficulty === d.value || undefined }, d.label)
      ),
    ]);

    const tagBoxes = TAGS.map((tag) => el("input", { type: "checkbox", value: tag, checked: values.tags.includes(tag) || undefined }));
    const limitTags = () => {
      const full = tagBoxes.filter((b) => b.checked).length >= LIMITS.tagsMax;
      for (const b of tagBoxes) b.disabled = full && !b.checked;
    };
    tagBoxes.forEach((b) => b.addEventListener("change", limitTags));
    limitTags();

    const labels = LICENSE_LABELS();
    const radios = LICENSES.map((value) =>
      el("input", {
        type: "radio",
        name: "publish-license",
        value,
        checked: values.license === value || undefined,
        disabled: update || undefined,
        "data-key": `publish-license-${value}`,
      })
    );

    const listedBox = el("input", { type: "checkbox", checked: values.listed !== false || undefined, "data-key": "publish-listed" });
    const readValues = () => ({
      listed: listedBox.checked,
      title: titleInput.value,
      blurb: blurbInput.value,
      lang: langSelect.value,
      difficulty: diffSelect.value,
      tags: tagBoxes.filter((b) => b.checked).map((b) => b.value),
      license: radios.find((r) => r.checked)?.value ?? "",
    });

    const go = el(
      "button",
      { type: "button", class: "primary", "data-key": "publish-go", onClick: () => submit(mode, entry, readValues(), note) },
      update ? t("Pubblica le modifiche") : t("Pubblica")
    );
    show(
      update
        ? el(
            "p",
            { class: "muted" },
            t(
              "Pubblichi una nuova revisione del caso {code}: chi l'ha già salvato vedrà «Aggiornato» e potrà scegliere se passare alla nuova.",
              { code: formatCode(entry.code) }
            )
          )
        : el(
            "p",
            { class: "muted" },
            t("Chiunque potrà aprire il caso con un codice o un link, senza accedere. Chi lo risolve vedrà il tuo nickname come autore.")
          ),
      field(t("Titolo"), titleInput),
      field(
        t("Descrizione breve"),
        blurbInput,
        t("Una o due frasi che invoglino a giocarlo, senza rivelare il colpevole (al massimo {max} caratteri).", { max: LIMITS.blurbMax })
      ),
      el("div", { class: "publish-row" }, [field(t("Lingua"), langSelect), field(t("Difficoltà"), diffSelect)]),
      el("div", { class: "publish-field" }, [
        el("label", { class: "publish-radio" }, [
          listedBox,
          el("span", {}, [
            el("strong", {}, t("Mostra nell'elenco dei casi della community")),
            el(
              "small",
              {},
              t(
                "Se la togli, il caso non compare nell'elenco e si apre solo con il codice o il link: utile per condividerlo con pochi amici. Tu lo vedi sempre in «I miei casi»."
              )
            ),
          ]),
        ]),
      ]),
      el("fieldset", { class: "publish-field" }, [
        el("legend", {}, t("Tag (fino a {max})", { max: LIMITS.tagsMax })),
        el(
          "div",
          { class: "publish-tags" },
          TAGS.map((tag, i) => el("label", { class: "publish-check" }, [tagBoxes[i], " ", tagLabel(tag)]))
        ),
      ]),
      el("fieldset", { class: "publish-field" }, [
        el("legend", {}, t("Licenza")),
        ...LICENSES.map((value, i) =>
          el("label", { class: "publish-radio" }, [
            radios[i],
            el("span", {}, [el("strong", {}, labels[value].name), el("small", {}, labels[value].text)]),
          ])
        ),
        el(
          "p",
          { class: "muted" },
          update ? t("La licenza non si può cambiare dopo la pubblicazione.") : t("Non potrai cambiarla dopo la pubblicazione.")
        ),
      ]),
      el(
        "p",
        { class: "publish-warning" },
        t(
          "Il caso verrà pubblicato con la soluzione, visibile a tutti. Nel database non finisce nient'altro di tuo: nessun progresso, nessun tempo."
        )
      ),
      note.node,
      forget
        ? el(
            "button",
            { type: "button", onClick: () => (registry.removePublished(getPuzzle().id), renderForm({ mode: "new" })) },
            t("Dimentica la pubblicazione e ricomincia")
          )
        : null,
      el("div", { class: "publish-actions" }, [
        update ? el("button", { type: "button", onClick: () => renderManage(entry) }, t("Indietro")) : closeButton(t("Annulla")),
        go,
      ])
    );
    titleInput.focus();
  }

  // Not played to the end yet: the server will not take it, and it is also the best check that the case is playable.
  function renderNotSolved(back) {
    show(
      el(
        "p",
        { role: "alert" },
        t("Prima di pubblicare un caso devi averlo risolto almeno una volta: è il modo più sicuro per accorgersi di errori negli indizi.")
      ),
      el("div", { class: "publish-actions" }, [
        el("button", { type: "button", onClick: back }, t("Indietro")),
        el("button", { type: "button", class: "primary", "data-key": "publish-play", onClick: () => onPlay() }, t("▶ Gioca ora")),
      ])
    );
  }

  async function submit(mode, entry, values, note) {
    note.clear();
    const puzzle = getPuzzle();
    const problems = [];
    const meta = validatePublishMeta(values);
    if (!meta.ok) problems.push(...describeMetaErrors(meta.errors).map((e) => e.text));
    const shape = validatePuzzleForPublish(puzzle);
    if (!shape.ok) problems.push(...describePuzzleErrors(shape.errors));
    if (problems.length) return note.errors(problems);
    const again = (extra = {}) => renderForm({ mode, entry, values, ...extra });
    if (mode === "new" && !hasSolved(puzzle.id)) return renderNotSolved(() => again());

    working(t("Controllo l'accesso…"));
    let ready;
    try {
      ready = await ensureReady();
    } catch (err) {
      return again({ error: describeReason(reasonOf(err), err.details) });
    }
    if (closed) return;
    if (!ready) return again();
    working(t("Sincronizzo i tuoi progressi…"));
    try {
      await ready.b.sync.syncAchievements(ready.user.uid); // the server looks at the synced copy for "solved at least once"
    } catch {
      // not fatal: if it really was not synced the server says "not solved" and the person is told
    }
    if (closed) return;
    if (!(await runCheck())) return closed ? undefined : again();
    working(mode === "new" ? t("Sto pubblicando il caso…") : t("Sto pubblicando le modifiche…"));
    try {
      const { community } = ready.b;
      const remixOf = puzzle.community?.remixOf?.code;
      const result =
        mode === "new"
          ? await community.publishCase({ puzzle, puzzleId: puzzle.id, meta: meta.meta, remixOf })
          : await community.updateCase({ code: entry.code, puzzle, meta: meta.meta });
      const saved = {
        code: result.code,
        revision: result.revision,
        license: values.license || entry?.license,
        title: meta.meta.title,
        publishedAt: Date.now(),
      };
      registry.setPublished(puzzle.id, saved);
      announce(t("Caso pubblicato: codice {code}", { code: formatCode(result.code) }));
      const cardOnly = mode === "update" && result.revisionChanged === false;
      if (!closed)
        renderManage(saved, {
          notice: cardOnly
            ? t("Scheda aggiornata. Il caso non è cambiato, quindi resta la revisione {n}.", { n: result.revision })
            : t("Fatto! Il caso è online."),
          card: null,
          listed: values.listed,
        });
    } catch (err) {
      if (closed) return;
      const reason = reasonOf(err);
      again({
        error: describeReason(reason, err.details),
        forget: mode === "update" && (reason === "no-such-case" || reason === "not-the-author"),
      });
    }
  }

  // The form of a new revision starts from what the card says now (so the author changes only what they want to change),
  // or from the case itself when the card cannot be read (offline).
  async function startUpdate(entry) {
    const values = { ...defaultValues(entry), title: entry.title || getPuzzle().title };
    try {
      const b = await backend();
      const card = await b.community.fetchCard(entry.code, { any: true });
      if (closed) return;
      Object.assign(values, {
        title: card.title,
        blurb: card.blurb,
        lang: card.lang,
        difficulty: card.difficulty,
        tags: card.tags ?? [],
        license: card.license,
        listed: card.listed !== false,
      });
    } catch {
      // keep the defaults
    }
    renderForm({ mode: "update", entry, values });
  }

  // ---- a published case: code, link, QR, and what can be done with it ---------------------------------------------------
  function renderManage(entry, { notice = "", error = "", card = undefined, listed = undefined } = {}) {
    const note = noticeBox();
    if (notice) note.info(notice);
    if (error) note.error(error);
    const link = caseLink(entry.code, location.href);
    const statusText = (revision, isWithdrawn, isListed) =>
      [
        t("Revisione {n}", { n: revision }),
        isWithdrawn ? t("ritirato: non lo apre nessuno") : null,
        isListed === false ? t("non in elenco: si apre solo con il codice") : null,
      ]
        .filter(Boolean)
        .join(" · ");
    const status = el("p", { class: "muted", "data-key": "publish-status" }, statusText(entry.revision, false, listed));
    const qr = el("div", { class: "publish-qr", "data-key": "publish-qr" });
    try {
      const svg = qrSvg(link, { ecc: "M", scale: 4, title: t("Codice QR del link del caso") });
      qr.appendChild(document.importNode(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement, true));
    } catch {
      // a link too long for the QR (never with a code): the code and the link are still there
    }
    const linkInput = el("input", {
      type: "text",
      readonly: true,
      value: link,
      "aria-label": t("Link del caso"),
      "data-key": "publish-link",
    });
    const copy = async (text, done) => {
      try {
        await navigator.clipboard.writeText(text);
        note.info(done);
      } catch {
        linkInput.select();
        note.error(t("Impossibile copiare negli appunti: seleziona il link e copialo a mano."));
      }
    };
    const share = typeof navigator.share === "function";

    // a withdrawn case: the dialog says so (only its author can read it)
    let withdrawn = card?.status === "withdrawn";
    const toggle = el(
      "button",
      { type: "button", "data-key": "publish-withdraw", onClick: () => manage("withdraw") },
      withdrawn ? t("Rimetti online") : t("Ritira dal database")
    );

    async function manage(what) {
      if (
        what === "delete" &&
        !confirm(t("Eliminare il caso dal database? Il codice smetterà di funzionare per tutti e l'azione non è reversibile."))
      )
        return;
      working(t("Un momento…"));
      try {
        const ready = await ensureReady();
        if (closed) return;
        if (!ready) return renderManage(entry, { card });
        if (what === "delete") {
          await ready.b.community.deleteCase(entry.code);
          registry.removePublished(getPuzzle().id);
          return renderForm({ mode: "new" });
        }
        const out = await ready.b.community.withdrawCase(entry.code, !withdrawn);
        renderManage(entry, {
          card: { ...(card ?? {}), status: out.status },
          notice:
            out.status === "active"
              ? t("Il caso è di nuovo online.")
              : t("Il caso è stato ritirato: nessuno può più aprirlo finché non lo rimetti online."),
        });
      } catch (err) {
        if (closed) return;
        const reason = reasonOf(err);
        if (reason === "no-such-case") {
          registry.removePublished(getPuzzle().id);
          return renderForm({ mode: "new", error: t("Il caso non risulta più nel database: puoi pubblicarlo di nuovo.") });
        }
        renderManage(entry, { card, error: describeReason(reason, err.details) });
      }
    }

    show(
      el("p", { class: "publish-code-line" }, [
        t("Codice del caso"),
        " ",
        el("strong", { class: "publish-code", "data-key": "publish-code" }, formatCode(entry.code)),
      ]),
      status,
      qr,
      el("div", { class: "field-row" }, [
        linkInput,
        el(
          "button",
          {
            type: "button",
            "data-key": "publish-copy",
            onClick: () => copy(link, t("Link copiato: chi lo apre può giocare il caso subito.")),
          },
          t("Copia il link")
        ),
      ]),
      el("div", { class: "publish-actions publish-actions-start" }, [
        el("button", { type: "button", onClick: () => copy(formatCode(entry.code), t("Codice copiato.")) }, t("Copia il codice")),
        share
          ? el(
              "button",
              {
                type: "button",
                "data-key": "publish-share",
                onClick: () =>
                  navigator
                    .share({
                      title: entry.title,
                      text: t("Prova a risolvere questo caso di Murdoku: {title}", { title: entry.title }),
                      url: link,
                    })
                    .catch(() => {}),
              },
              t("Condividi…")
            )
          : null,
      ]),
      note.node,
      el("div", { class: "publish-actions" }, [
        el(
          "button",
          { type: "button", class: "danger", "data-key": "publish-delete", onClick: () => manage("delete") },
          t("Elimina dal database")
        ),
        toggle,
        el(
          "button",
          {
            type: "button",
            "data-key": "publish-update",
            onClick: () => startUpdate(entry),
          },
          t("Pubblica le modifiche…")
        ),
        closeButton(),
      ])
    );

    // What the database says now (the case may have been withdrawn, or hidden): best effort, with no sign-in
    if (card === undefined) {
      backend()
        .then((b) => b.community.fetchCard(entry.code, { any: true }))
        .then((fresh) => {
          if (closed || !status.isConnected) return;
          withdrawn = fresh.status === "withdrawn";
          toggle.textContent = withdrawn ? t("Rimetti online") : t("Ritira dal database");
          status.textContent = statusText(fresh.revision, withdrawn, fresh.listed);
        })
        .catch(() => {});
    }
  }

  // ---- start --------------------------------------------------------------------------------------------------------
  const published = registry.getPublished(getPuzzle().id);
  if (isSharedPuzzleId(getPuzzle().id))
    // somebody else's case, saved here to be played: only a copy of one's own (a remix, when allowed) can be published
    show(
      el("p", { role: "alert" }, t("Questo è il caso di un altro autore, salvato qui per giocarlo: non si può ripubblicare.")),
      el("p", { class: "muted" }, t("Se l'autore lo permette, usa «Duplica» per farne una tua versione: quella potrai pubblicarla.")),
      el("div", { class: "publish-actions" }, [closeButton()])
    );
  else if (published) renderManage(published);
  else renderForm({ mode: "new" });
  return dialog;
}
