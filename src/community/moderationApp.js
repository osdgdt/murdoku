import "../i18n/i18n.js";
import { el, clear, qs } from "../util/dom.js";
import { t } from "../i18n/i18n.js";
import { wireThemeToggle } from "../util/theme.js";
import { announce } from "../util/announcer.js";
import { onAuthChange, signIn, signOutUser } from "../auth/googleAuth.js";
import { describeAuthError } from "../auth/loginHelp.js";
import { isAdmin, fetchReportedCases, fetchReports } from "./galleryStore.js";
import * as community from "./communityStore.js";
import { formatCode, isCaseCode } from "./casePolicy.js";
import { describeReason, reportReasonLabel } from "./messages.js";

wireThemeToggle();

// The administrators' page: the cases that have open reports (the most reported first) and the ones that are hidden, with the
// reports of each, and what can be done: hide, restore, delete, dismiss the reports. Who is an administrator is decided by the
// rules and by the functions (`admins/{uid}`); this page only shows the buttons to whoever can read the reports.
const app = qs("#moderation-app");
const authBar = qs("#auth-bar");
const status = el("p", { class: "community-status", role: "status", "aria-live": "polite", "data-key": "mod-status" });
const list = el("ul", { class: "case-grid mod-list", "data-key": "mod-list" });
const notice = el("div", { class: "community-notice", "data-key": "mod-notice" });
app.append(notice, status, list);
let user = null;

const str = (value, max = 200) => (typeof value === "string" ? value.slice(0, max) : "");
const say = (text, bad = false) => {
  clear(notice);
  notice.append(el("p", { class: bad ? "violation" : "", role: bad ? "alert" : "status" }, text));
};

function renderAuthBar() {
  clear(authBar);
  if (user)
    authBar.append(
      el("span", { class: "muted" }, user.email ?? ""),
      el("button", { type: "button", onClick: () => signOutUser() }, t("Esci"))
    );
  else
    authBar.append(
      el(
        "button",
        {
          type: "button",
          "data-key": "signin",
          onClick: () => signIn().catch((error) => say(describeAuthError(error), true)),
        },
        t("Accedi con Google")
      )
    );
}

async function act(code, what) {
  if (
    what === "delete" &&
    !confirm(t("Eliminare per sempre il caso {code}? Il codice smette di funzionare per tutti.", { code: formatCode(code) }))
  )
    return;
  try {
    if (what === "dismiss") await community.dismissReports(code);
    else await community.moderateCase(code, what);
    say(t("Fatto."));
    announce(t("Fatto."));
    await load();
  } catch (error) {
    say(describeReason(error?.reason ?? "network", error?.details), true);
  }
}

function renderCase(card) {
  if (!isCaseCode(card.code)) return null;
  const reportsBox = el("div", { class: "mod-reports", "data-key": "mod-reports" });
  const showReports = el(
    "button",
    {
      type: "button",
      "data-key": "mod-show-reports",
      onClick: async () => {
        showReports.disabled = true;
        try {
          const reports = await fetchReports(card.code);
          clear(reportsBox);
          if (reports.length === 0) reportsBox.append(el("p", { class: "muted" }, t("Nessuna segnalazione.")));
          for (const r of reports)
            reportsBox.append(
              el("p", { class: "mod-report" }, [
                el("strong", {}, reportReasonLabel(r.reason)),
                r.status === "dismissed" ? ` (${t("respinta")})` : "",
                r.note ? `: ${str(r.note, 280)}` : "",
              ])
            );
        } catch (error) {
          say(describeReason(error?.reason ?? "network"), true);
          showReports.disabled = false;
        }
      },
    },
    t("Vedi le segnalazioni")
  );
  const hidden = card.status === "hidden";
  const button = (key, label, what, cls = "") =>
    el("button", { type: "button", class: cls, "data-key": key, onClick: () => act(card.code, what) }, label);
  return el("li", { class: "case-card", "data-code": card.code }, [
    el("div", { class: "case-card-body" }, [
      el("h2", { class: "case-title" }, str(card.title, 80) || t("(senza titolo)")),
      el("p", { class: "case-meta muted" }, `${t("Autore:")} ${str(card.authorNick, 40)} · ${formatCode(card.code)}`),
      el("p", { class: "case-badges" }, [
        el(
          "span",
          { class: `case-badge ${hidden ? "warn" : ""}` },
          hidden ? t("Nascosto") : card.status === "withdrawn" ? t("Ritirato") : t("Pubblico")
        ),
        el(
          "span",
          { class: "case-badge warn", "data-key": "mod-count" },
          t("{n} segnalazioni aperte", { n: Number.isInteger(card.reportsOpen) ? card.reportsOpen : 0 })
        ),
      ]),
      el("div", { class: "case-actions" }, [
        el("a", { class: "button-link", href: `player.html?c=${card.code}`, "data-key": "mod-open" }, t("Apri il caso")),
        showReports,
        hidden ? button("mod-restore", t("Ripristina"), "restore") : button("mod-hide", t("Nascondi"), "hide"),
        button("mod-dismiss", t("Respingi le segnalazioni"), "dismiss"),
        button("mod-delete", t("Elimina"), "delete", "danger"),
      ]),
      reportsBox,
    ]),
  ]);
}

async function load() {
  clear(list);
  status.textContent = t("Sto caricando…");
  try {
    const cases = await fetchReportedCases();
    cases.sort((a, b) => (b.reportsOpen || 0) - (a.reportsOpen || 0));
    for (const card of cases) {
      const node = renderCase(card);
      if (node) list.appendChild(node);
    }
    status.textContent = cases.length === 0 ? t("Nessun caso segnalato o nascosto.") : "";
  } catch (error) {
    status.textContent = "";
    say(describeReason(error?.reason ?? "network", error?.details), true);
  }
}

onAuthChange(async (next) => {
  user = next;
  renderAuthBar();
  clear(list);
  clear(notice);
  if (!user) {
    status.textContent = t("Accedi con un account amministratore per vedere le segnalazioni.");
    return;
  }
  if (!(await isAdmin(user.uid))) {
    status.textContent = "";
    say(t("Questa pagina è riservata agli amministratori."), true);
    return;
  }
  load();
});

renderAuthBar();
