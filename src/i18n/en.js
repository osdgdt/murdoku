// English dictionary: Italian source text -> English. Split by area only to
// keep the files reviewable; merged here. Missing entries fall back to the
// Italian text — `npm run i18n` lists them.
import campaign from "./en/campaign.js";
import clues from "./en/clues.js";
import ui from "./en/ui.js";

export default { ...campaign, ...clues, ...ui };
