// "You need an account for that": the sign-in with Google and the nickname (the name an author, a person who likes a case or
// reports one is known by), in one small window, wherever the page is (the list of cases, the player). Firebase is loaded only
// when this is asked for. -> { user, nickname }, or null when the person gave up.
import { el, clear } from "../util/dom.js";
import { t } from "../i18n/i18n.js";
import { describeAuthError, renderLoginHelp } from "../auth/loginHelp.js";
import { validateNickname, NICKNAME_MAX } from "../daily/dailyMath.js";
import { NICKNAME_ERRORS } from "../daily/nicknameErrors.js";
import { setSignedIn } from "./localRegistry.js";

const currentUser = (auth) =>
  new Promise((resolve) => {
    const off = auth.onAuthChange((user) => {
      resolve(user);
      queueMicrotask(() => off());
    });
  });

export async function requireAccount() {
  let auth;
  let daily;
  try {
    [auth, daily] = await Promise.all([import("../auth/googleAuth.js"), import("../daily/dailyStore.js")]);
  } catch {
    return null; // offline: the Firebase modules are on Google's servers
  }
  let user = await currentUser(auth);
  let nickname = user ? await daily.getNickname(user.uid).catch(() => null) : null;
  if (user && nickname) {
    setSignedIn(true);
    return { user, nickname };
  }

  const dialog = el("dialog", { class: "publish-dialog", "aria-labelledby": "account-title" });
  const body = el("div", { class: "publish-body" });
  dialog.append(el("h2", { id: "account-title" }, t("Serve un account")), body);
  let finish = () => {};
  const result = new Promise((resolve) => {
    finish = resolve;
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    finish(null);
  });
  document.body.appendChild(dialog);
  dialog.showModal();
  const cancel = el("button", { type: "button", onClick: () => dialog.close() }, t("Annulla"));
  const show = (...nodes) => {
    clear(body);
    body.append(...nodes);
  };

  const askNickname = () => {
    const notice = el("p", { class: "violation", role: "alert" });
    notice.hidden = true;
    const input = el("input", {
      type: "text",
      maxlength: String(NICKNAME_MAX),
      "aria-label": t("Nickname"),
      placeholder: t("Il tuo nickname"),
      "data-key": "account-nickname",
    });
    const go = el("button", { type: "button", class: "primary", "data-key": "account-nickname-go" }, t("Scegli"));
    const submit = async () => {
      notice.hidden = true;
      const checked = validateNickname(input.value);
      if (!checked.ok) {
        notice.textContent = NICKNAME_ERRORS[checked.error]();
        notice.hidden = false;
        return;
      }
      go.disabled = true;
      try {
        const out = await daily.chooseNickname(user.uid, checked.nickname);
        if (!out.ok) {
          notice.textContent = NICKNAME_ERRORS[out.error]();
          notice.hidden = false;
          go.disabled = false;
          return;
        }
        nickname = out.nickname;
        setSignedIn(true);
        finish({ user, nickname });
        dialog.close();
      } catch (error) {
        notice.textContent = t("Non sono riuscito a salvare il nickname: {message}", { message: error.message });
        notice.hidden = false;
        go.disabled = false;
      }
    };
    go.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    show(
      el("h3", {}, t("Scegli un nickname")),
      el(
        "p",
        { class: "muted" },
        t("È il nome che gli altri vedranno accanto a ciò che fai qui (casi, «mi piace», segnalazioni). Non è l'indirizzo email.")
      ),
      el("div", { class: "field-row" }, [input, go]),
      notice,
      el("div", { class: "publish-actions" }, [cancel])
    );
    input.focus();
  };

  if (user) askNickname();
  else {
    const notice = el("p", { class: "violation", role: "alert" });
    notice.hidden = true;
    const go = el(
      "button",
      {
        type: "button",
        class: "primary",
        "data-key": "account-signin",
        onClick: async () => {
          go.disabled = true;
          try {
            user = (await auth.signIn()).user;
            nickname = await daily.getNickname(user.uid).catch(() => null);
            if (nickname) {
              setSignedIn(true);
              finish({ user, nickname });
              dialog.close();
            } else askNickname();
          } catch (error) {
            notice.textContent = describeAuthError(error);
            notice.hidden = false;
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
          "Per mettere «mi piace», segnalare un caso o seguire un autore serve un account Google e un nickname. Per giocare non serve nessun accesso."
        )
      ),
      el("div", { class: "publish-actions" }, [cancel, go]),
      notice,
      renderLoginHelp()
    );
  }
  return result;
}
