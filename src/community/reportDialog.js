// The window to report a case: a reason (a short list), a note, "Segnala". `submit({ reason, note })` sends it (and throws a
// CommunityError when it is refused); `onSent()` is called when it went through. Shared by the list and the player.
import { el } from "../util/dom.js";
import { t } from "../i18n/i18n.js";
import { announce } from "../util/announcer.js";
import { REPORT_REASONS, LIMITS } from "./casePolicy.js";
import { describeReason, reportReasonLabel } from "./messages.js";

export function openReportDialog({ submit, onSent = () => {} }) {
  const reasons = el("select", { "data-key": "report-reason", "aria-label": t("Motivo") }, [
    el("option", { value: "" }, t("Scegli un motivo…")),
    ...REPORT_REASONS.map((r) => el("option", { value: r }, reportReasonLabel(r))),
  ]);
  const note = el("textarea", {
    rows: "3",
    maxlength: String(LIMITS.noteMax),
    "aria-label": t("Nota (facoltativa)"),
    "data-key": "report-note",
  });
  const notice = el("p", { role: "alert", class: "violation" });
  notice.hidden = true;
  const dialog = el("dialog", { class: "publish-dialog", "aria-labelledby": "report-title" });
  const close = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove());
  const go = el(
    "button",
    {
      type: "button",
      class: "primary",
      "data-key": "report-go",
      onClick: async () => {
        notice.hidden = true;
        if (!reasons.value) {
          notice.textContent = describeReason("invalid-report");
          notice.hidden = false;
          return;
        }
        go.disabled = true;
        try {
          await submit({ reason: reasons.value, note: note.value });
          close();
          announce(t("Segnalazione inviata."));
          onSent();
        } catch (error) {
          notice.textContent = describeReason(error?.reason ?? "network", error?.details);
          notice.hidden = false;
          go.disabled = false;
        }
      },
    },
    t("Segnala")
  );
  dialog.append(
    el("h2", { id: "report-title" }, t("Segnala questo caso")),
    el(
      "p",
      { class: "muted" },
      t(
        "Dimmi cosa non va. La segnalazione la leggono solo gli amministratori; se tre persone diverse segnalano lo stesso caso, viene nascosto finché non lo controllano."
      )
    ),
    el("div", { class: "publish-field" }, [el("label", {}, [el("span", { class: "publish-label" }, t("Motivo")), reasons])]),
    el("div", { class: "publish-field" }, [el("label", {}, [el("span", { class: "publish-label" }, t("Nota (facoltativa)")), note])]),
    notice,
    el("div", { class: "publish-actions" }, [el("button", { type: "button", onClick: close }, t("Annulla")), go])
  );
  document.body.appendChild(dialog);
  dialog.showModal();
  reasons.focus();
  return dialog;
}
