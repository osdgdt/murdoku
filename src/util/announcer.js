// Spoken feedback for screen-reader users: two visually hidden live regions (polite for what just
// happened, assertive for errors) that the page writes into. A live region announces CHANGES, so the
// text is cleared first and set a moment later — that is what makes the same sentence said twice be
// read twice. Not for sighted users: nothing here is visible.
let polite = null;
let assertive = null;
let pending = null;

function region(role, live) {
  if (typeof document === "undefined") return null;
  const node = document.createElement("div");
  node.className = "visually-hidden";
  node.setAttribute("role", role);
  node.setAttribute("aria-live", live);
  node.setAttribute("aria-atomic", "true");
  node.dataset.announcer = live;
  document.body.appendChild(node);
  return node;
}

function ensure() {
  if (!polite || !polite.isConnected) polite = region("status", "polite");
  if (!assertive || !assertive.isConnected) assertive = region("alert", "assertive");
}

// Says `text`. `priority`: "polite" (waits for what is being read) or "assertive" (interrupts: errors).
// Several calls in quick succession (a drag marking ten cells) are folded into the last one.
export function announce(text, priority = "polite") {
  const message = String(text ?? "").trim();
  if (!message || typeof document === "undefined") return;
  ensure();
  const target = priority === "assertive" ? assertive : polite;
  if (!target) return;
  target.textContent = "";
  clearTimeout(pending?.timer);
  pending = {
    target,
    timer: setTimeout(() => {
      target.textContent = message;
      pending = null;
    }, 60),
  };
}

// Empties both regions (e.g. when leaving the screen), so nothing stale is read later.
export function clearAnnouncements() {
  clearTimeout(pending?.timer);
  pending = null;
  if (polite) polite.textContent = "";
  if (assertive) assertive.textContent = "";
}
