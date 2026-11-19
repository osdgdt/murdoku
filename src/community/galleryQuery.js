// What the gallery asks Firestore for, as plain data (galleryStore.js turns it into the real query): pure, so that it can be
// tested, and so that firestore.indexes.json is GENERATED from it (tools/make-indexes.mjs) and can never miss an index a query
// needs. Firestore wants an index for every combination of "equal to" filters and a sort, but it merges the indexes of
// several equality filters on its own, so one index per (filter, sort) is enough (see requiredIndexes).
import { TAGS, LANGS } from "./casePolicy.js";

export const PAGE_SIZE = 12;
export const SIZE_BANDS = ["small", "medium", "large"];
export const SORTS = ["new", "title"];
export const SEARCH_MAX = 40;
const DIFFICULTIES = ["very-easy", "easy", "medium", "hard", "expert"];

// What a title search looks like to Firestore: lower case, spaces collapsed.
export const normalizeSearch = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX);

const ORDERS = {
  new: ["createdAt", "desc"],
  title: ["titleLower", "asc"],
};

// filters: { scope, uid, authorUid, lang, difficulty, sizeBand, tag, search, sort }
//   scope "gallery" (default): what is in the public list, narrowed by the filters; `authorUid` shows one author's cases
//   scope "mine": all the cases of the signed-in author (`uid`), in the list or not, withdrawn too: newest first
//   scope "all": every case, for an administrator: newest first
// -> { where: [[field, op, value], ...], orderBy: [field, direction], limit }
// A filter with a value the page does not offer is ignored (nothing reaches Firestore that the rules would refuse).
export function buildCaseQuery(filters = {}, limit = PAGE_SIZE) {
  const { scope = "gallery" } = filters;
  if (scope === "mine") {
    if (!filters.uid) throw new Error("scope mine needs the uid");
    return { where: [["authorUid", "==", filters.uid]], orderBy: ORDERS.new, limit };
  }
  if (scope === "all") return { where: [], orderBy: ORDERS.new, limit };

  const where = [["inGallery", "==", true]];
  if (filters.authorUid) {
    // one author's cases, newest first (no other filter: it is a short list)
    where.push(["authorUid", "==", String(filters.authorUid)]);
    return { where, orderBy: ORDERS.new, limit };
  }
  if (LANGS.includes(filters.lang)) where.push(["lang", "==", filters.lang]);
  if (DIFFICULTIES.includes(filters.difficulty)) where.push(["difficulty", "==", filters.difficulty]);
  if (SIZE_BANDS.includes(filters.sizeBand)) where.push(["sizeBand", "==", filters.sizeBand]);
  if (TAGS.includes(filters.tag)) where.push(["tags", "array-contains", filters.tag]);
  const search = normalizeSearch(filters.search);
  if (search) {
    // a title that starts with what was typed: a range on the lower-case title, which is also the sort
    where.push(["titleLower", ">=", search], ["titleLower", "<", `${search}`]);
    return { where, orderBy: ORDERS.title, limit };
  }
  return { where, orderBy: ORDERS[SORTS.includes(filters.sort) ? filters.sort : "new"], limit };
}

// ---- the indexes ------------------------------------------------------------------------------------------------------
const EQUALITY = (op) => op === "==" || op === "array-contains";

// The composite indexes a query needs: for each "equal to" filter, an index on that field followed by the sort field.
// Returns [{ fields: [[field, "asc"|"desc"|"contains"], [orderField, direction]] }].
export function indexesFor(query) {
  const [orderField, direction] = query.orderBy;
  const seen = new Set();
  const out = [];
  for (const [field, op] of query.where) {
    if (!EQUALITY(op) || field === orderField) continue;
    const first = op === "array-contains" ? [field, "contains"] : [field, "asc"];
    const key = `${first.join(":")}|${orderField}:${direction}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([first, [orderField, direction]]);
    }
  }
  return out;
}

// Every query shape the page can make (with all the filters it offers, each one on and off), as queries.
export function allQueryShapes() {
  const shapes = [];
  const pick = (values) => [undefined, ...values];
  for (const lang of pick(LANGS))
    for (const difficulty of pick(DIFFICULTIES))
      for (const sizeBand of pick(SIZE_BANDS))
        for (const tag of pick(TAGS))
          for (const search of ["", "il"])
            for (const sort of SORTS) shapes.push(buildCaseQuery({ lang, difficulty, sizeBand, tag, search, sort }));
  shapes.push(buildCaseQuery({ authorUid: "someone" }));
  shapes.push(buildCaseQuery({ scope: "mine", uid: "me" }));
  shapes.push(buildCaseQuery({ scope: "all" }));
  return shapes;
}

// The content of firestore.indexes.json: exactly the indexes that the shapes above need, sorted, nothing more.
export function indexesFile() {
  const wanted = new Map();
  for (const shape of allQueryShapes()) for (const pair of indexesFor(shape)) wanted.set(JSON.stringify(pair), pair);
  const field = ([name, how]) =>
    how === "contains"
      ? { fieldPath: name, arrayConfig: "CONTAINS" }
      : { fieldPath: name, order: how === "desc" ? "DESCENDING" : "ASCENDING" };
  const indexes = [...wanted.values()]
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    .map((pair) => ({ collectionGroup: "cases", queryScope: "COLLECTION", fields: pair.map(field) }));
  return { indexes, fieldOverrides: [] };
}
