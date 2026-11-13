// Registers the service worker (installable + offline). Failures are silent:
// the app works exactly the same without it.
//
// When a newer version takes over while a page is open, that page keeps running
// the old scripts until it is reloaded: a small banner offers the reload.
import { el } from "./dom.js";
import { t } from "../i18n/i18n.js";

function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  document.body.appendChild(
    el("div", { id: "update-banner", class: "update-banner", role: "status" }, [
      el("span", {}, t("È disponibile una nuova versione del sito.")),
      el("button", { type: "button", onClick: () => location.reload() }, t("Ricarica")),
    ])
  );
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
  // The first controller is just the install, not an update.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) showUpdateBanner();
    hadController = true;
  });
}
