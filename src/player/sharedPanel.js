// What the player shows above the board when the case comes from the shared database: whose it is, its code, a link to pass
// it on, "Remix" when the author allows it, and the "Aggiornato" banner when the author has published a newer revision.
import { el, clear } from "../util/dom.js";
import { t } from "../i18n/i18n.js";
import { announce } from "../util/announcer.js";
import * as store from "../storage/puzzleStore.js";
import { SHARED_PREFIX, formatCode, caseLink } from "../community/casePolicy.js";
import * as registry from "../community/localRegistry.js";
import { duplicateCase } from "../community/remix.js";
import { newerRevision, applyNewerRevision } from "./sharedCase.js";

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
  container.append(
    el("div", { class: "shared-row" }, [
      el("span", { class: "shared-who" }, who),
      el("button", { type: "button", "data-key": "shared-copy", onClick: copy }, t("Copia il link")),
      info?.license === "cc-by" ? el("button", { type: "button", "data-key": "shared-remix", onClick: remix }, t("🧬 Rielabora")) : null,
      status,
    ]),
    updateSlot
  );

  // Has the author published a new revision since this copy was saved? (best effort: nothing is shown when it cannot be known)
  newerRevision(code).then((card) => {
    if (!card || !updateSlot.isConnected) return;
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
