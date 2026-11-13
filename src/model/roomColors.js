// The colours an author can give a room (the editor's "Colore" row). Each one is
// stored as a pastel hex, like the rooms' default colours; on the board the paper
// skin turns it into the matching sheet of coloured paper (skin/paper/rooms.js
// roomColor), so the chips of the picker, the room list, the board and the legend
// all show the same colour. The first eight are the defaults new rooms get, in
// this order (ZONE_COLORS in editor/mapEditor.js), so a default room always shows
// one of these as selected.
import { t } from "../i18n/i18n.js";

export const ROOM_PALETTE = [
  { color: "#f4c2c2", name: t("Terracotta") },
  { color: "#c2e0f4", name: t("Blu polvere") },
  { color: "#c9f4c2", name: t("Salvia") },
  { color: "#f4ecc2", name: t("Senape") },
  { color: "#e0c2f4", name: t("Lavanda") },
  { color: "#f4d3c2", name: t("Arancio") },
  { color: "#c2f4e8", name: t("Verde acqua") },
  { color: "#e8e8e8", name: t("Grigio caldo") },
  { color: "#f4a8a8", name: t("Rosso") },
  { color: "#d7f4c2", name: t("Lime") },
  { color: "#f4c2e2", name: t("Rosa") },
  { color: "#c2f1f4", name: t("Ciano") },
  { color: "#b8c2f4", name: t("Blu") },
  { color: "#e6d9bf", name: t("Sabbia") },
  { color: "#d7bba0", name: t("Marrone") },
  { color: "#b9c6d3", name: t("Ardesia") },
];
