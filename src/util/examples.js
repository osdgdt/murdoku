// Bundled example cases (examples/), one per UI language.
import { getLanguage } from "../i18n/i18n.js";

export function tutorialPlayerUrl() {
  return `player.html?import=${encodeURIComponent(`examples/tutorial.${getLanguage()}.murdoku.json`)}`;
}
