// Tells a person who switched to another tab that something they were waiting for is ready, by putting it in
// the tab's title ("✓ Suggerimento pronto — Gioca a Murdoku"); the title goes back to normal when they return.
// Nothing happens while the page is visible (they can see it), and no permission is asked.
let original = null;
let listening = false;

function restore() {
  if (original !== null && document.visibilityState !== "hidden") {
    document.title = original;
    original = null;
  }
}

export function notifyInTitle(text) {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") return;
  if (original === null) original = document.title;
  document.title = `✓ ${text} — ${original}`;
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", restore);
  }
}
