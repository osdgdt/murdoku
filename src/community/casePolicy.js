// The rules of the shared case database, in ONE place used by the page (the "Pubblica" dialog, the player) and by
// the Cloud Functions (functions/, which get a copy of this module and what it imports: tools/build-functions.mjs).
// Pure: no DOM, no Firebase, no clock of its own. Whatever the page checks is only a courtesy to the author: the
// server checks it again with this same code, and the Firestore rules (firestore.rules, "Shared cases") hold the
// bounds that cannot be checked here.
import { migratePuzzle } from "../model/migrations.js";
import { validatePuzzleShape, DIFFICULTY_LEVELS } from "../model/puzzle.js";

// ---- limits -------------------------------------------------------------------------------------------------------
// Keep the numbers that firestore.rules repeats (title, blurb, tags) in step with this table.
export const LIMITS = {
  titleMin: 3,
  titleMax: 80,
  blurbMax: 280,
  textMax: 4000, // briefing, resolution note
  nameMax: 40, // a character or a room
  bioMax: 600,
  tagsMax: 3,
  bodyMaxBytes: 256 * 1024, // the case as published (the file limit of the app is 1 MiB; real cases are 7-22 KB)
  clueMax: 200,
  noteMax: 280, // the note of a report
};

export const LANGS = ["it", "en"];
export const LICENSES = ["cc-by", "play-only"];
// What an author can tag a case with (a fixed list: the gallery filters on it).
export const TAGS = ["medievale", "moderno", "mistero", "horror", "umorismo", "famiglia", "storico", "fantasy-senza-magia"];
const DIFFICULTIES = DIFFICULTY_LEVELS.map((d) => d.value).filter(Boolean);

// The original owner of the project is an administrator even without a document in `admins` (the same uid as isOwner() in
// firestore.rules and as OWNER_UIDS in functions/src/common.js: a test keeps the three alike).
export const OWNER_UIDS = ["say3jOf6WkaXDmjyn3kmAKNYbCh1"];

// What a report of a case can say (the reasons are codes: the page words them), and what the author's page can say.
export const REPORT_REASONS = ["spoiler", "offensive", "spam", "broken", "copyright", "other"];

// -> { ok: true, report: { reason, note } } or { ok: false, errors: [{ field, code }] }
export function validateReport(raw) {
  const errors = [];
  if (!REPORT_REASONS.includes(raw?.reason)) errors.push({ field: "reason", code: "invalid" });
  const note = raw?.note === undefined || raw?.note === null ? "" : String(raw.note).replace(/\s+/g, " ").trim();
  if (note.length > LIMITS.noteMax) errors.push({ field: "note", code: "too-long" });
  if (raw?.reason === "other" && note.length === 0) errors.push({ field: "note", code: "too-short" });
  if (errors.length) return { ok: false, errors };
  return { ok: true, report: { reason: raw.reason, note } };
}

// -> { ok: true, bio } (cleaned; may be empty) or { ok: false }
export function validateBio(raw) {
  const bio = String(raw ?? "")
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return bio.length > LIMITS.bioMax ? { ok: false } : { ok: true, bio };
}

// ---- the code -----------------------------------------------------------------------------------------------------
// 8 characters from an alphabet without the look-alikes (no 0/O, 1/I/L, 5/S, 2/Z, 8/B) so that it can be read out
// loud or copied by eye. 23 symbols ^ 8 = 7.8e10 codes: enough that guessing one is hopeless.
export const CODE_SYMBOLS = "ACDEFGHJKMNPQRTUVWXY346"; // 23 symbols
export const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${CODE_SYMBOLS}]{${CODE_LENGTH}}$`);

export const isCaseCode = (value) => typeof value === "string" && CODE_PATTERN.test(value);

// What a person types, forgiven: case, spaces, dashes ("abcd-2345" -> "ABCD2345"); look-alikes are NOT guessed.
export function normalizeCode(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

// A new code. `randomInt(n)` returns an integer in [0, n): crypto-strong on the server, injectable in tests.
export function generateCode(randomInt) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_SYMBOLS[randomInt(CODE_SYMBOLS.length)];
  return code;
}

// ABCD2345 -> ABCD-2345, for showing.
export const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

// The id the case gets in every browser that saves it, whatever it was called in the author's.
export const SHARED_PREFIX = "shared_";
export const sharedPuzzleId = (code) => `${SHARED_PREFIX}${code}`;
export const isSharedPuzzleId = (id) => typeof id === "string" && id.startsWith(SHARED_PREFIX);

// ---- the metadata the author fills in -------------------------------------------------------------------------------
const clean = (value) =>
  String(value ?? "")
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Returns { ok: true, meta } with the cleaned values, or { ok: false, errors: [{ field, code }] } (codes, not texts:
// the page words them in the language of the person, the server just refuses).
export function validatePublishMeta(raw) {
  const errors = [];
  const fail = (field, code) => errors.push({ field, code });
  const title = clean(raw?.title);
  const blurb = clean(raw?.blurb);
  if (title.length < LIMITS.titleMin) fail("title", "too-short");
  if (title.length > LIMITS.titleMax) fail("title", "too-long");
  if (blurb.length < 1) fail("blurb", "too-short");
  if (blurb.length > LIMITS.blurbMax) fail("blurb", "too-long");
  if (!LANGS.includes(raw?.lang)) fail("lang", "invalid");
  if (!DIFFICULTIES.includes(raw?.difficulty)) fail("difficulty", "invalid");
  if (!LICENSES.includes(raw?.license)) fail("license", "invalid");
  const tags = Array.isArray(raw?.tags) ? [...new Set(raw.tags)] : [];
  if (tags.length > LIMITS.tagsMax) fail("tags", "too-many");
  if (tags.some((tag) => !TAGS.includes(tag))) fail("tags", "invalid");
  // in the public list of cases, or only reachable with its code or link (absent = in the list)
  if (raw?.listed !== undefined && typeof raw.listed !== "boolean") fail("listed", "invalid");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    meta: {
      title,
      titleLower: title.toLowerCase(),
      blurb,
      lang: raw.lang,
      difficulty: raw.difficulty,
      license: raw.license,
      tags,
      listed: raw.listed !== false,
    },
  };
}

// Is a case in the public gallery? Only an active case its author wants listed. The gallery asks Firestore for
// `inGallery == true` (one field to filter on, one index per sort), so it is kept in step with `status` and `listed`
// by whoever changes either of them: the functions, always through this.
export const inGallery = (status, listed) => status === "active" && listed !== false;

// ---- the case itself ----------------------------------------------------------------------------------------------
// Checks a case before it is published: the app's own shape check (grid, characters, ids, colours...) plus the limits
// that only matter for something everybody can read. `puzzle` is not changed. Returns { ok: true, puzzle } (migrated,
// a copy) or { ok: false, errors: [{ code, detail? }] }.
export function validatePuzzleForPublish(puzzle) {
  const errors = [];
  if (!puzzle || typeof puzzle !== "object") return { ok: false, errors: [{ code: "not-an-object" }] };
  const copy = JSON.parse(JSON.stringify(puzzle));
  migratePuzzle(copy);
  const shape = validatePuzzleShape(copy);
  if (!shape.valid) errors.push({ code: "shape", detail: shape.errors });
  const tooLong = (field, value, max) =>
    typeof value === "string" && value.length > max && errors.push({ code: "text-too-long", detail: field });
  tooLong("title", copy.title, LIMITS.titleMax);
  tooLong("briefing", copy.briefing, LIMITS.textMax);
  tooLong("resolutionNote", copy.resolutionNote, LIMITS.textMax);
  for (const c of Array.isArray(copy.characters) ? copy.characters : []) {
    tooLong("character name", c?.name, LIMITS.nameMax);
    tooLong("character bio", c?.bio, LIMITS.bioMax);
  }
  for (const z of Array.isArray(copy.grid?.zones) ? copy.grid.zones : []) tooLong("room name", z?.name, LIMITS.nameMax);
  if (Array.isArray(copy.clues) && copy.clues.length > LIMITS.clueMax) errors.push({ code: "too-many-clues" });
  if (Array.isArray(copy.clues) && copy.clues.length === 0) errors.push({ code: "no-clues" });
  const solution = copy.solution?.placements;
  if (!Array.isArray(solution) || solution.length !== (copy.characters?.length ?? -1)) errors.push({ code: "incomplete-solution" });
  if (errors.length) return { ok: false, errors };
  return { ok: true, puzzle: copy };
}

// The text that is published: everything that belongs to the CASE, nothing that belongs to the person who made it
// (their progress, their clock, their save time). The id is the same for every revision and every reader.
export function preparePuzzleForPublish(puzzle, code, { author = "", title, difficulty } = {}) {
  const copy = JSON.parse(JSON.stringify(puzzle));
  copy.id = sharedPuzzleId(code);
  copy.author = author;
  if (title !== undefined) copy.title = title;
  if (difficulty !== undefined) copy.difficulty = difficulty;
  copy.completed = false;
  copy.bestTimeSeconds = null;
  delete copy.community;
  return copy;
}

// Canonical text of a case: object keys sorted, so that the same case always gives the same bytes.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

// The fingerprint that tells two copies of the same case apart from two different cases: hash of what makes the
// case (map, cast, clues, solution), not of what the author renamed (ids, title, texts, timestamps).
export async function contentHash(puzzle) {
  const { grid, characters, clues, solution } = puzzle;
  // ids differ between copies made in different browsers (and in different versions of the editor): every id is replaced
  // by its position in its own list, wherever it appears (cells, clue parameters, the solution)
  const placeholder = new Map();
  (characters || []).forEach((c, i) => placeholder.set(c.id, `c${i}`));
  (grid?.zones || []).forEach((z, i) => placeholder.set(z.id, `z${i}`));
  (grid?.objects || []).forEach((o, i) => placeholder.set(o.id, `o${i}`));
  const swap = (value) =>
    JSON.stringify(value).replace(/"([^"\\]*)"/g, (whole, text) => (placeholder.has(text) ? `"${placeholder.get(text)}"` : whole));
  const body = {
    size: grid?.size,
    cells: swap(grid?.cells),
    zones: (grid?.zones || []).map((z) => z.name),
    objects: swap((grid?.objects || []).map(({ id, ...rest }) => rest)),
    characters: swap((characters || []).map(({ id, name, iconId, isVictim, gender }) => ({ id, name, iconId, isVictim, gender }))),
    clues: swap((clues || []).map(({ id, ...rest }) => rest)),
    solution: swap(solution?.placements),
  };
  const bytes = new TextEncoder().encode(canonical(body));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A case as stored: the text of the case, and how big it is.
export function serializeBody(puzzle) {
  const json = JSON.stringify(puzzle);
  return { json, bytes: new TextEncoder().encode(json).length };
}

// The summary the gallery and the cards need, taken from a (validated) case. Never reads the clues' text.
export function summarizePuzzle(puzzle) {
  const { rows, cols } = puzzle.grid.size;
  return {
    rows,
    cols,
    characters: puzzle.characters.length,
    clues: puzzle.clues.length,
    sizeBand: Math.max(rows, cols) <= 5 ? "small" : Math.max(rows, cols) <= 8 ? "medium" : "large",
    preview: buildPreview(puzzle),
  };
}

// The little map on the card of a case: which room every cell belongs to and what colour each room is, nothing else (no
// objects, no names, nothing about the solution). `cells` has one character per cell, row after row: the index of the
// room in base 36, "-" for a cell with no room, "#" for a blocked one. null when the map does not fit (more than 36 rooms).
const ROOM_SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyz";
export function buildPreview(puzzle) {
  const grid = puzzle?.grid;
  const zones = Array.isArray(grid?.zones) ? grid.zones : [];
  if (!zones.length || zones.length > ROOM_SYMBOLS.length) return null;
  const index = new Map(zones.map((zone, i) => [zone.id, i]));
  let cells = "";
  for (const row of grid.cells)
    for (const cell of row) cells += cell.blocked ? "#" : index.has(cell.zoneId) ? ROOM_SYMBOLS[index.get(cell.zoneId)] : "-";
  const colors = zones.map((zone) => (/^#[0-9a-fA-F]{6}$/.test(zone.color) ? zone.color.toLowerCase() : "#c9c0b0"));
  return { cells, colors };
}

// The text of the link a person shares: what they paste in a chat.
export function caseLink(code, base) {
  const url = new URL("player.html", base);
  url.search = `?c=${code}`;
  return url.href;
}
