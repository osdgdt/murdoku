// The daily challenge's rules and arithmetic, with no page and no Firebase: which day it is, what a nickname
// may look like, what an entry holds, and how the day's entries are ranked. The Firestore rules
// (firestore.rules, "daily") enforce the same bounds: keep the two in step.

// The day's key, "YYYY-MM-DD" in UTC: the same for everybody, and what the case of the day is chosen by
// (src/player/libraryPanel.js caseOfTheDay uses the UTC day number too).
export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function previousDateKey(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateKey(d);
}

export const isDateKey = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

// What one run may report (a minimum of seconds too: no real solve takes less, and it keeps out 0-second entries).
export const LIMITS = { minSeconds: 20, maxSeconds: 86400, maxChecks: 200 };

// ---- nickname -----------------------------------------------------------------------------

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;
// letters (any alphabet), digits, space, dot, dash, underscore, apostrophe
const NICKNAME_CHARS = /^[\p{L}\p{N} ._'-]+$/u;

// The nickname as typed -> { ok: true, nickname } (tidied: trimmed, spaces collapsed) or { ok: false, error }.
export function validateNickname(raw) {
  const nickname = String(raw ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
  if (nickname.length < NICKNAME_MIN) return { ok: false, error: "too-short" };
  if (nickname.length > NICKNAME_MAX) return { ok: false, error: "too-long" };
  if (!NICKNAME_CHARS.test(nickname)) return { ok: false, error: "characters" };
  if (!/[\p{L}\p{N}]/u.test(nickname)) return { ok: false, error: "characters" };
  return { ok: true, nickname };
}

// Two nicknames that differ only by case count as the same one (the reservation document is named after this).
export const nicknameKey = (nickname) => nickname.normalize("NFKC").toLowerCase();

// ---- an entry --------------------------------------------------------------------------------

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

// What a finished run reports (forced inside the bounds); no hints: the challenge does not allow them.
export function entryFromRun({ nickname, seconds, checks, caseId }) {
  return {
    nickname,
    seconds: clampInt(seconds, LIMITS.minSeconds, LIMITS.maxSeconds),
    checks: clampInt(checks, 0, LIMITS.maxChecks),
    caseId: String(caseId ?? "").slice(0, 100),
  };
}

// ---- ranking -----------------------------------------------------------------------------------

// Fastest first; the same time, fewer wrong checks first; still tied, whoever finished first. Returns the entries
// with their `rank` (1-based; entries that tie on time and checks share a rank, the next rank skips: 1, 1, 3).
export function rankEntries(entries) {
  const time = (e) => (typeof e.createdAt === "number" ? e.createdAt : (e.createdAt?.seconds ?? 0));
  const sorted = [...entries].sort((a, b) => a.seconds - b.seconds || a.checks - b.checks || time(a) - time(b));
  let rank = 0;
  return sorted.map((entry, i) => {
    const previous = sorted[i - 1];
    if (!previous || previous.seconds !== entry.seconds || previous.checks !== entry.checks) rank = i + 1;
    return { ...entry, rank };
  });
}

// "You are 3rd of 12": where `uid` stands among the entries, or null when absent.
export function positionOf(entries, uid) {
  const ranked = rankEntries(entries);
  const mine = ranked.find((e) => e.uid === uid);
  return mine ? { rank: mine.rank, of: ranked.length } : null;
}
