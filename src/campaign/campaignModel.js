import { makeId } from "../util/id.js";
import { t } from "../i18n/i18n.js";

export const CAMPAIGN_SCHEMA_VERSION = 1;

export function createCampaign(title = t("Nuova campagna"), description = "") {
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
  // Clues that were waiting for the removed case would stay hidden for good: free them.
  for (const c of campaign.cases) {
    for (const [clueId, byCaseId] of Object.entries(c.clueUnlocks || {})) {
      if (byCaseId === caseId) setClueUnlock(campaign, c.id, clueId, null);
    }
  }
  touch(campaign);
}

export function reorderCases(campaign, fromIndex, toIndex) {
  const { cases } = campaign;
  if (fromIndex < 0 || fromIndex >= cases.length || toIndex < 0 || toIndex >= cases.length) return;
  const [moved] = cases.splice(fromIndex, 1);
  cases.splice(toIndex, 0, moved);
  touch(campaign);
}

// --- hidden clues ---------------------------------------------------------------
// A case entry may carry `clueUnlocks: { [clueId]: caseId }`: the clue with that id
// (a clue of THAT case's puzzle file) stays hidden until the player completes the
// case `caseId`. This is how a story campaign hands out "evidence": the finale
// shows an earlier case's discovery as one of its own clues. The mapping lives in
// the campaign (not in the puzzle file), so the file keeps working on its own.
//
// A mapping only counts when the unlocking case exists and comes EARLIER in the
// campaign: anything else could never be satisfied, so the clue is simply shown
// (fail open — a mistake while reordering must never make a case unsolvable).
export function setClueUnlock(campaign, caseId, clueId, byCaseId) {
  const entry = campaign.cases.find((c) => c.id === caseId);
  if (!entry) return;
  const next = { ...(entry.clueUnlocks || {}) };
  if (byCaseId) next[clueId] = byCaseId;
  else delete next[clueId];
  // Firestore refuses `undefined` and an empty map is just noise: drop the field.
  if (Object.keys(next).length > 0) entry.clueUnlocks = next;
  else delete entry.clueUnlocks;
  touch(campaign);
}

// { byCaseId, valid } for one clue of one case, or null when it is always visible.
export function clueUnlockOf(campaign, caseId, clueId) {
  const index = campaign.cases.findIndex((c) => c.id === caseId);
  const byCaseId = index === -1 ? undefined : campaign.cases[index].clueUnlocks?.[clueId];
  if (!byCaseId) return null;
  const byIndex = campaign.cases.findIndex((c) => c.id === byCaseId);
  return { byCaseId, valid: byIndex !== -1 && byIndex < index };
}

// Ids of the clues of case `caseId` still hidden for a player who has completed `completedCaseIds`.
export function lockedClueIds(campaign, caseId, completedCaseIds = []) {
  const entry = campaign.cases.find((c) => c.id === caseId);
  const locked = new Set();
  for (const clueId of Object.keys(entry?.clueUnlocks || {})) {
    const unlock = clueUnlockOf(campaign, caseId, clueId);
    if (unlock?.valid && !completedCaseIds.includes(unlock.byCaseId)) locked.add(clueId);
  }
  return locked;
}

// What the player sees and what the game checks against:
//  - `puzzle`: the same case without the hidden clues, plus `lockedClues` — a
//    placeholder per hidden clue (who it is about and which case reveals it,
//    never its text) so the clue cards can show a padlock;
//  - `answerPuzzle`: the complete case. The "answer key" (win check, murderer
//    reveal) must be worked out from ALL the clues: without the hidden ones the
//    solution is not unique any more.
export function applyClueLocks(puzzle, campaign, caseId, completedCaseIds = []) {
  const locked = lockedClueIds(campaign, caseId, completedCaseIds);
  if (locked.size === 0) return { puzzle, answerPuzzle: puzzle };
  const labelOf = (id) => {
    const c = campaign.cases.find((x) => x.id === id);
    return c ? c.label || c.puzzleId : "";
  };
  const lockedClues = puzzle.clues
    .filter((clue) => locked.has(clue.id))
    .map((clue) => ({
      id: clue.id,
      characterId: clue.characterId ?? null,
      byLabel: labelOf(clueUnlockOf(campaign, caseId, clue.id).byCaseId),
    }));
  return { puzzle: { ...puzzle, clues: puzzle.clues.filter((clue) => !locked.has(clue.id)), lockedClues }, answerPuzzle: puzzle };
}

// The cases that hold clues revealed by completing `byCaseId`: [{ caseEntry, count }].
export function unlocksProvidedBy(campaign, byCaseId) {
  const out = [];
  for (const caseEntry of campaign.cases) {
    const count = Object.keys(caseEntry.clueUnlocks || {}).filter((clueId) => {
      const unlock = clueUnlockOf(campaign, caseEntry.id, clueId);
      return unlock?.valid && unlock.byCaseId === byCaseId;
    }).length;
    if (count > 0) out.push({ caseEntry, count });
  }
  return out;
}

export function validateCampaignShape(campaign) {
  const errors = [];
  if (!campaign || typeof campaign !== "object") return { valid: false, errors: [t("La campagna non è un oggetto valido.")] };
  if (typeof campaign.title !== "string" || !campaign.title.trim()) errors.push(t("Manca il titolo della campagna."));
  if (!Array.isArray(campaign.cases)) {
    errors.push(t("Manca l'elenco dei casi."));
  } else {
    const ids = new Set();
    campaign.cases.forEach((c, i) => {
      if (!c || typeof c !== "object") {
        errors.push(t("Caso {v} non valido.", { v: i + 1 }));
        return;
      }
      if (ids.has(c.id)) errors.push(t("ID caso duplicato: {id}", { id: c.id }));
      ids.add(c.id);
      if (!c.puzzleUrl) errors.push(t("Caso {v}: manca l'URL del file .murdoku.json.", { v: i + 1 }));
      if (c.clueUnlocks !== undefined) {
        const map = c.clueUnlocks;
        const ok = map && typeof map === "object" && !Array.isArray(map) && Object.values(map).every((v) => typeof v === "string" && v);
        if (!ok) errors.push(t("Caso {v}: gli indizi nascosti non sono validi.", { v: i + 1 }));
      }
      if (!c.puzzleId) errors.push(t("Caso {v}: manca l'id del puzzle.", { v: i + 1 }));
    });
  }
  return { valid: errors.length === 0, errors };
}
