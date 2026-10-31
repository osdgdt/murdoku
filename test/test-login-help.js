import { detectEmbeddedBrowser, describeAuthError } from "../src/auth/loginHelp.js";
import { assert, assertEqual } from "./assert.js";

const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36";

export const tests = [
  {
    name: "loginHelp: Chrome normale non è considerato un browser incorporato",
    fn: () => {
      const env = detectEmbeddedBrowser(CHROME, "https://www.google.com/");
      assertEqual(env.risky, false);
    },
  },
  {
    name: "loginHelp: una WebView Android, un'app nota o un referrer android-app:// vengono riconosciuti",
    fn: () => {
      assert(detectEmbeddedBrowser(WEBVIEW, "").embedded, "WebView Android");
      assert(detectEmbeddedBrowser(CHROME + " Instagram 300.0", "").embedded, "Instagram");
      assert(detectEmbeddedBrowser(CHROME + " [FBAN/FB4A;FBAV/450]", "").embedded, "Facebook");
      const fromApp = detectEmbeddedBrowser(CHROME, "android-app://com.example.chat");
      assert(fromApp.fromApp && fromApp.risky && !fromApp.embedded, "aperto da un'altra app");
    },
  },
  {
    name: "loginHelp: gli errori di Firebase diventano messaggi chiari; un errore sconosciuto mantiene il suo testo",
    fn: () => {
      assert(describeAuthError({ code: "auth/popup-blocked" }).includes("bloccato"));
      assertEqual(describeAuthError({ code: "auth/popup-closed-by-user" }), "Accesso annullato.");
      assert(describeAuthError({ code: "auth/unauthorized-domain" }).includes("autorizzati"));
      assertEqual(describeAuthError({ code: "auth/boh", message: "dettaglio tecnico" }), "dettaglio tecnico");
      assertEqual(describeAuthError({}), "Accesso non riuscito.");
    },
  },
];
