import "../i18n/i18n.js";
import { el, qs, clear } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { clearLocalData, localDataKeys } from "../storage/dataControl.js";
import { t } from "../i18n/i18n.js";
import { describeAuthError } from "../auth/loginHelp.js";

wireThemeToggle();

const statusEl = qs("#privacy-status");
function say(text, kind = "ok-message") {
  clear(statusEl);
  statusEl.appendChild(el("p", { class: kind }, text));
}

qs("#clear-local-btn").addEventListener("click", () => {
  const n = localDataKeys().length;
  if (
    !confirm(
      t("Cancellare tutti i dati salvati su questo dispositivo ({count} voci)? Casi, progressi, traguardi e preferenze andranno persi.", {
        count: n,
      })
    )
  )
    return;
  clearLocalData();
  say(t("Fatto: i dati locali sono stati cancellati."));
});

// The cloud part needs Firebase (loaded from Google's CDN), so it is only
// imported when the visitor actually asks for it.
qs("#clear-cloud-btn").addEventListener("click", async () => {
  try {
    const { onAuthChange, signIn } = await import("../auth/googleAuth.js");
    const user = await new Promise((resolve) => {
      const off = onAuthChange((u) => {
        off();
        resolve(u);
      });
    });
    const current = user || (await signIn()).user;
    const { deleteCloudData, deleteSignInAccount, countPublishedCases } = await import("../auth/cloudData.js");
    const published = await countPublishedCases(current.uid).catch(() => 0);
    if (
      !confirm(
        t(
          "Cancellare dal cloud i progressi delle campagne, i traguardi sincronizzati, i contrassegni delle statistiche e il nickname con le partite della sfida del giorno dell'account {email}? Verranno tolti anche i tuoi «mi piace», le tue segnalazioni e gli autori che segui.",
          { email: current.email }
        )
      )
    )
      return;
    // The cases this person published: delete them or leave them, signed "Account eliminato"? Asked only when there are some.
    let keepCases = false;
    if (published > 0) {
      const choice = await askWhatToDoWithCases(published);
      if (!choice) return;
      keepCases = choice === "keep";
    }
    // What only the server can delete (the cases, the author's page, likes, follows, reports) goes first, and if it fails nothing
    // else is deleted: a half-deleted account is worse than a clear "try again".
    try {
      const { prepareAccountDeletion } = await import("../community/communityStore.js");
      await prepareAccountDeletion(keepCases);
    } catch (err) {
      say(
        t("Non sono riuscito a cancellare i dati del database dei casi ({reason}): non ho cancellato nient'altro. Riprova tra poco.", {
          reason: err?.reason ?? "?",
        }),
        "violation"
      );
      return;
    }
    const removed = await deleteCloudData(current.uid);
    let message = t("Fatto: {count} elementi cancellati dal cloud.", { count: removed });
    if (confirm(t("Vuoi anche eliminare l'accesso con Google a questo sito (l'account Google resta invariato)?"))) {
      try {
        await deleteSignInAccount();
        message += " " + t("L'accesso è stato eliminato.");
      } catch (err) {
        message +=
          " " +
          (err?.code === "auth/requires-recent-login"
            ? t("Per eliminare l'accesso devi prima uscire, rientrare con Google e ripetere l'operazione.")
            : t("Impossibile eliminare l'accesso: {message}", { message: err.message }));
      }
    }
    say(message);
  } catch (err) {
    say(t("Operazione non riuscita: {message}", { message: describeAuthError(err) }), "violation");
  }
});

// "What do I do with the cases I published?": delete them, or leave them signed "Account eliminato", or stop. -> "delete" | "keep" | null
function askWhatToDoWithCases(count) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { class: "publish-dialog", "aria-labelledby": "keep-title" });
    let answer = null;
    const pick = (value) => () => {
      answer = value;
      dialog.close();
    };
    dialog.append(
      el("h2", { id: "keep-title" }, t("Cosa faccio dei tuoi casi pubblicati?")),
      el(
        "p",
        {},
        count === 1
          ? t(
              "Hai pubblicato 1 caso. Puoi eliminarlo oppure lasciarlo online con autore «Account eliminato»: il tuo nickname sparisce dal caso e da ogni sua revisione."
            )
          : t(
              "Hai pubblicato {count} casi. Puoi eliminarli oppure lasciarli online con autore «Account eliminato»: il tuo nickname sparisce dai casi e da ogni loro revisione.",
              { count }
            )
      ),
      el("div", { class: "publish-actions" }, [
        el("button", { type: "button", "data-key": "keep-cancel", onClick: pick(null) }, t("Annulla")),
        el("button", { type: "button", "data-key": "keep-keep", onClick: pick("keep") }, t("Lasciali come «Account eliminato»")),
        el("button", { type: "button", class: "danger", "data-key": "keep-delete", onClick: pick("delete") }, t("Eliminali")),
      ])
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(answer);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
