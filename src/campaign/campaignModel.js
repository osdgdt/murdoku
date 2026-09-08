import { makeId } from "../util/id.js";

export const CAMPAIGN_SCHEMA_VERSION = 1;

export function createCampaign(title = "Nuova campagna", description = "") {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    id: makeId("campaign"),
    title,
    description,
    cases: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function touch(campaign) {
  campaign.updatedAt = Date.now();
  return campaign;
}

// `puzzleUrl` is the deployed .murdoku.json this case loads from (relative or
// absolute — same fetch+validate path as player.html's `?import=`);
// `puzzleId` is that file's own embedded id, used to key per-user progress.
export function addCase(campaign, { puzzleId, puzzleUrl, label }) {
  const c = { id: makeId("case"), puzzleId, puzzleUrl, label };
  campaign.cases.push(c);
  touch(campaign);
  return c;
}

export function removeCase(campaign, caseId) {
  campaign.cases = campaign.cases.filter((c) => c.id !== caseId);
  touch(campaign);
}

export function reorderCases(campaign, fromIndex, toIndex) {
  const { cases } = campaign;
  if (fromIndex < 0 || fromIndex >= cases.length || toIndex < 0 || toIndex >= cases.length) return;
  const [moved] = cases.splice(fromIndex, 1);
  cases.splice(toIndex, 0, moved);
  touch(campaign);
}

export function validateCampaignShape(campaign) {
  const errors = [];
  if (!campaign || typeof campaign !== "object") return { valid: false, errors: ["La campagna non è un oggetto valido."] };
  if (typeof campaign.title !== "string" || !campaign.title.trim()) errors.push("Manca il titolo della campagna.");
  if (!Array.isArray(campaign.cases)) {
    errors.push("Manca l'elenco dei casi.");
  } else {
    const ids = new Set();
    campaign.cases.forEach((c, i) => {
      if (!c || typeof c !== "object") {
        errors.push(`Caso ${i + 1} non valido.`);
        return;
      }
      if (ids.has(c.id)) errors.push(`ID caso duplicato: ${c.id}`);
      ids.add(c.id);
      if (!c.puzzleUrl) errors.push(`Caso ${i + 1}: manca l'URL del file .murdoku.json.`);
      if (!c.puzzleId) errors.push(`Caso ${i + 1}: manca l'id del puzzle.`);
    });
  }
  return { valid: errors.length === 0, errors };
}
