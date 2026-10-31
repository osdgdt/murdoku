// Dresses the static page markup in the paper skin: the logo in the top bar,
// the illustrated icons on the landing cards and the hero scene. Pages work
// without it (the markup carries plain-text fallbacks); this only upgrades them.
import "./defs.js";
import { logoMark } from "./logo.js";
import { UI_ICONS, heroArt } from "./ui-icons.js";

function dress() {
  for (const brand of document.querySelectorAll(".topbar .brand")) {
    brand.innerHTML = `<span class="brand-mark">${logoMark()}</span><span>Murdoku</span>`;
  }
  for (const node of document.querySelectorAll("[data-icon]")) {
    const art = UI_ICONS[node.dataset.icon];
    if (art) node.innerHTML = art;
  }
  const hero = document.getElementById("hero-art");
  if (hero) hero.innerHTML = heroArt();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dress, { once: true });
else dress();
