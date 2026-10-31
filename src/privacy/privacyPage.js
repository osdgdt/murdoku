import "../i18n/i18n.js";
import { el, qs, clear } from "../util/dom.js";
import { wireThemeToggle } from "../util/theme.js";
import { clearLocalData, localDataKeys } from "../storage/dataControl.js";
import { t } from "../i18n/i18n.js";

wireThemeToggle();

const statusEl = qs("#privacy-status");
function say(text, kind = "ok-message") {
  clear(statusEl);
  statusEl.appendChild(el("p", { class: kind }, text));
}

qs("#clear-local-btn").addEventListener("click", () => {
  const n = localDataKeys().length;
  if (!confirm(t("Cancellare tutti i dati salvati su questo dispositivo ({count} voci)? Casi, progressi, traguardi e preferenze andranno persi.", { count: n }))) return;
  clearLocalData();
  say(t("Fatto: i dati locali sono stati cancellati."));
});

// The cloud part needs Firebase (loaded from Google's CDN), so it is only
// imported when the visitor actually asks for it.
qs("#clear-cloud-btn").addEventListener("click", async () => {
  try {
    const { onAuthChange, signIn } = await import("../auth/googleAuth.js");
    const user = await new Promise((resolve) => {
      const off = onAuthChange((u) => { off(); resolve(u); });
    });
    const current = user || (await signIn()).user;
    if (!confirm(t("Cancellare dal cloud i progressi delle campagne e i traguardi sincronizzati dell'account {email}?", { email: current.email }))) return;
    const { deleteCloudData, deleteSignInAccount } = await import("../auth/cloudData.js");
    const removed = await deleteCloudData(current.uid);
    let message = t("Fatto: {count} elementi cancellati dal cloud.", { count: removed });
    if (confirm(t("Vuoi anche eliminare l'accesso con Google a questo sito (l'account Google resta invariato)?"))) {
      try {
        await deleteSignInAccount();
        message += " " + t("L'accesso è stato eliminato.");
      } catch (err) {
        message += " " + (err?.code === "auth/requires-recent-login"
          ? t("Per eliminare l'accesso devi prima uscire, rientrare con Google e ripetere l'operazione.")
          : t("Impossibile eliminare l'accesso: {message}", { message: err.message }));
      }
    }
    say(message);
  } catch (err) {
    say(t("Operazione non riuscita: {message}", { message: err.message }), "violation");
  }
});
