// Shared SVG filter the paper-cut artwork refers to (soft drop shadows under
// every paper layer). Injected once per page; icons are plain strings that
// reference it by id, so they work wherever they are inserted.
export const SHADOW_FILTER_ID = "paper-soft";

export function ensureSkinDefs() {
  if (typeof document === "undefined" || document.getElementById("paper-skin-defs")) return;
  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  host.setAttribute("id", "paper-skin-defs");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.innerHTML = `<defs><filter id="${SHADOW_FILTER_ID}" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.3"/></filter></defs>`;
  (document.body || document.documentElement).prepend(host);
}

if (typeof document !== "undefined") {
  if (document.body) ensureSkinDefs();
  else document.addEventListener("DOMContentLoaded", ensureSkinDefs, { once: true });
}
