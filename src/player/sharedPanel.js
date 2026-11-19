// What the player shows above the board when the case comes from the shared database: whose it is, its code, a link to pass
// it on, "Remix" when the author allows it, and the "Aggiornato" banner when the author has published a newer revision.
import { el, clear } from "../util/dom.js";
import { t } from "../i18n/i18n.js";
import { announce } from "../util/announcer.js";
import * as store from "../storage/puzzleStore.js";
import { SHARED_PREFIX, formatCode, caseLink } from "../community/casePolicy.js";
import * as registry from "../community/localRegistry.js";
import { duplicateCase } from "../community/remix.js";
import { applyNewerRevision, loadCard } from "./sharedCase.js";
import { likedByMe, withAccount } from "./sharedActions.js";
import { describeReason } from "../community/messages.js";
import { openReportDialog } from "../community/reportDialog.js";

export function renderSharedPanel(container, puzzle) {
  const code = puzzle.id.slice(SHARED_PREFIX.length);
  const info = registry.getShared(code);
  const link = caseLink(code, location.href);
  clear(container);
  container.classList.remove("hidden");

  const status = el("span", { class: "shared-status", role: "status" });
  const say = (text) => {
    status.textContent = text;
    announce(text);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      say(t("Link copiato: chi lo apre può giocare il caso subito."));
    } catch {
      say(t("Impossibile copiare il link negli appunti."));
    }
  };
  const remix = () => {
    const made = duplicateCase(puzzle);
    if (!made.ok) return say(t("L'autore non permette di copiare questo caso: puoi solo giocarlo."));
    store.save(made.copy);
    location.href = `editor.html?id=${made.copy.id}`;
  };

  const who = [
    "🌐 ",
    t("Caso condiviso"),
    " · ",
    el("strong", { "data-key": "shared-code" }, formatCode(code)),
    info?.authorNick ? ` · ${t("di {nick}", { nick: info.authorNick })}` : "",
    info?.license === "cc-by" ? ` · ${t("Remix consentito (CC BY 4.0)")}` : ` · ${t("Solo da giocare")}`,
  ];
  const updateSlot = el("div", { class: "shared-update hidden", "data-key": "shared-update" });
  const socialSlot = el("div", { class: "shared-social hidden", "data-key": "shared-social" });
  container.append(
    el("div", { class: "shared-row" }, [
      el("span", { class: "shared-who" }, who),
      el("button", { type: "button", "data-key": "shared-copy", onClick: copy }, t("Copia il link")),
      info?.license === "cc-by" ? el("button", { type: "button", "data-key": "shared-remix", onClick: remix }, t("🧬 Rielabora")) : null,
      status,
    ]),
    socialSlot,
    updateSlot
  );

  // What the database says about the case now (best effort: nothing is shown when it cannot be read): how many tried and solved
  // it, the likes, whose it is, whether it is still public, and whether the author has published a newer revision.
  loadCard(code).then(async (card) => {
    if (!card || !updateSlot.isConnected) return;
    renderSocial(socialSlot, code, card);
    if (!(card.revision > (info?.revision ?? card.revision))) return;
    const apply = async (button) => {
      if (!confirm(t("I progressi su questo caso ripartiranno da zero con la nuova versione. Continuare?"))) return;
      button.disabled = true;
      try {
        await applyNewerRevision(code);
        location.reload();
      } catch {
        button.disabled = false;
        say(t("Non sono riuscito a scaricare la nuova versione: riprova tra poco."));
      }
    };
    const go = el(
      "button",
      { type: "button", class: "primary", "data-key": "shared-update-go", onClick: () => apply(go) },
      t("Passa alla nuova versione")
    );
    updateSlot.classList.remove("hidden");
    updateSlot.append(
      el("strong", {}, t("Aggiornato")),
      ` · ${t("L'autore ha pubblicato una nuova versione di questo caso (revisione {n}).", { n: card.revision })} `,
      go,
      el("button", { type: "button", onClick: () => updateSlot.classList.add("hidden") }, t("Resta con questa"))
    );
    announce(t("L'autore ha pubblicato una nuova versione di questo caso (revisione {n}).", { n: card.revision }));
  });
}

// The line under the panel: the counters, the heart, "Segnala", the author's page; and a note when the case is not public.
function renderSocial(slot, code, card) {
  clear(slot);
  slot.classList.remove("hidden");
  const stats = card.stats ?? {};
  let count = Number.isInteger(stats.likes) ? stats.likes : 0;
  let liked = false;
  const heart = el("button", { type: "button", class: "like-button", "data-key": "shared-like", "aria-pressed": "false" });
  const paint = () => {
    heart.setAttribute("aria-pressed", String(liked));
    heart.textContent = `${liked ? "♥" : "♡"} ${count}`;
    heart.title = liked ? t("Non mi piace più") : t("Mi piace");
    heart.setAttribute(
      "aria-label",
      liked ? t("Non mi piace più: {n} mi piace", { n: count }) : t("Mi piace: {n} mi piace finora", { n: count })
    );
  };
  paint();
  likedByMe(code).then((value) => {
    liked = value;
    paint();
  });
  heart.addEventListener("click", async () => {
    heart.disabled = true;
    try {
      const ready = await withAccount();
      if (!ready) return;
      const out = await ready.community.setLike(code, !liked);
      liked = out.liked;
      count = out.likes;
      paint();
    } catch (error) {
      announce(describeReason(error?.reason ?? "network", error?.details));
      slot.append(el("span", { class: "violation", role: "alert" }, ` ${describeReason(error?.reason ?? "network", error?.details)}`));
    } finally {
      heart.disabled = false;
    }
  });
  const report = el(
    "button",
    {
      type: "button",
      class: "link-button",
      "data-key": "shared-report",
      onClick: async () => {
        const ready = await withAccount();
        if (!ready) return;
        openReportDialog({
          submit: (r) => ready.community.reportCase({ code, ...r }),
          onSent: () =>
            slot.append(el("span", { role: "status", "data-key": "shared-report-done" }, ` ${t("Grazie: la segnalazione è arrivata.")}`)),
        });
      },
    },
    t("Segnala")
  );
  const counters = [
    Number.isInteger(stats.opened) ? t("👥 {n} hanno provato", { n: stats.opened }) : null,
    Number.isInteger(stats.solved) ? t("✓ {n} risolti", { n: stats.solved }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const author =
    typeof card.authorUid === "string" && card.authorUid !== "deleted" && card.authorNick
      ? el(
          "a",
          { href: `community.html?author=${encodeURIComponent(card.authorUid)}`, "data-key": "shared-author" },
          t("Altri casi di {nick}", { nick: String(card.authorNick).slice(0, 40) })
        )
      : null;
  slot.append(
    ...[
      card.status && card.status !== "active"
        ? el(
            "strong",
            { class: "violation", "data-key": "shared-not-public" },
            `${t("Questo caso non è pubblico (ritirato o nascosto): lo vedi perché sei l'autore o un amministratore.")} `
          )
        : null,
      counters ? el("span", { class: "muted", "data-key": "shared-counters" }, `${counters} `) : null,
      heart,
      report,
      author,
    ].filter(Boolean)
  );
}
