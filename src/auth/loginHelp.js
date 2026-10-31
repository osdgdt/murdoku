// Helps with the one thing Google sign-in cannot do by itself: work inside a
// browser embedded in another app (a chat app's in-app browser, an Android
// WebView or Custom Tab). There the sign-in window loses its link to the page
// that opened it, so after choosing an account Google falls back to its
// default destination — Gmail. This module recognises that situation, tells
// the visitor what to do, and turns Firebase's error codes into plain words.
// It deliberately imports nothing from Firebase, so it is safe to load anywhere.
import { el } from "../util/dom.js";
import { t } from "../i18n/i18n.js";

const IN_APP_UA = /(FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|LinkedInApp|Pinterest|Telegram)/i;

// `embedded`: the user agent says so (Android WebView "; wv)" or a known app).
// `fromApp`: the page was opened from another Android app (referrer
// android-app://…), typically in a Custom Tab, which can't run sign-in popups.
export function detectEmbeddedBrowser(ua = globalThis.navigator?.userAgent || "", referrer = globalThis.document?.referrer || "") {
  const embedded = /; wv\)/.test(ua) || IN_APP_UA.test(ua);
  const fromApp = referrer.startsWith("android-app://");
  return { embedded, fromApp, risky: embedded || fromApp };
}

export function describeAuthError(err) {
  switch (err?.code) {
    case "auth/popup-blocked":
      return t("Il browser ha bloccato la finestra di accesso: consentila e riprova.");
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return t("Accesso annullato.");
    case "auth/unauthorized-domain":
      return t("Questo indirizzo non è tra quelli autorizzati per l'accesso con Google (impostazione del progetto Firebase).");
    case "auth/network-request-failed":
      return t("Connessione assente o instabile: riprova tra poco.");
    case "auth/web-storage-unsupported":
      return t("Il browser blocca l'archiviazione necessaria all'accesso: aprilo in Chrome e fuori dalla navigazione privata.");
    default:
      return err?.message || t("Accesso non riuscito.");
  }
}

// The note shown under every "Accedi con Google" button. Always a gentle hint;
// a stronger warning with a "copy link" button when we can tell the page is
// open inside another app.
export function renderLoginHelp(env = detectEmbeddedBrowser()) {
  const children = [
    el("p", { class: env.risky ? "violation" : "muted" }, env.risky
      ? t("Stai usando un browser incorporato in un'altra app: Google non permette di accedere da qui (di solito ti porta su Gmail). Copia il link e aprilo in Chrome.")
      : t("Se l'accesso ti porta su Gmail o non si completa, apri il sito direttamente nel browser (per esempio Chrome) e riprova.")),
  ];
  if (env.risky) {
    const copyBtn = el("button", { type: "button" }, t("📋 Copia il link"));
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        copyBtn.textContent = t("✓ Link copiato: incollalo in Chrome");
      } catch {
        copyBtn.textContent = t("Impossibile copiare: selezionalo dalla barra degli indirizzi");
      }
    });
    children.push(copyBtn);
  }
  return el("div", { class: "login-help" }, children);
}
