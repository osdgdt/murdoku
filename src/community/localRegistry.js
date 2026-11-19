// What this browser remembers about shared cases, with no Firebase (so the player and the editor can use it without
// loading anything from the network):
//   published   the author's side: which of MY cases is published, under which code, at which revision
//   shared      the reader's side: the copies of other people's cases this browser holds (author, licence, revision)
// The cases themselves stay in puzzleStore (a copy of someone else's case is the puzzle `shared_<CODE>`).
import { readJson, tryWriteJson } from "../storage/storage.js";
import { isCaseCode } from "./casePolicy.js";

const PUBLISHED_KEY = "murdoku:community:published";
const SHARED_KEY = "murdoku:community:shared";

const readMap = (key) => {
  const value = readJson(key, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

// ---- the author's side ----------------------------------------------------------------------------------------------
// entry: { code, revision, license, title, publishedAt }
export const getPublished = (puzzleId) => readMap(PUBLISHED_KEY)[puzzleId] ?? null;

export function setPublished(puzzleId, entry) {
  const map = readMap(PUBLISHED_KEY);
  map[puzzleId] = entry;
  return tryWriteJson(PUBLISHED_KEY, map);
}

// The local case published under `code` (if this browser is where it was made): its id, or null.
export function findPublishedByCode(code) {
  return Object.entries(readMap(PUBLISHED_KEY)).find(([, entry]) => entry?.code === code)?.[0] ?? null;
}

export function removePublished(puzzleId) {
  const map = readMap(PUBLISHED_KEY);
  delete map[puzzleId];
  return tryWriteJson(PUBLISHED_KEY, map);
}

// ---- the reader's side -----------------------------------------------------------------------------------------------
// entry: { code, revision, authorNick, license, title, savedAt, remixOf? }
export const getShared = (code) => (isCaseCode(code) ? (readMap(SHARED_KEY)[code] ?? null) : null);

export function setShared(code, entry) {
  const map = readMap(SHARED_KEY);
  map[code] = entry;
  return tryWriteJson(SHARED_KEY, map);
}

export function removeShared(code) {
  const map = readMap(SHARED_KEY);
  delete map[code];
  return tryWriteJson(SHARED_KEY, map);
}

export const listShared = () => Object.values(readMap(SHARED_KEY));

// ---- whether this browser has seen a signed-in person --------------------------------------------------------------------
// The player does not load Firebase for somebody who never signed in; once a page has seen a signed-in account it says so here,
// and then the player counts the plays (and shows the heart as theirs). Only a hint: the server decides who is who.
const SIGNED_IN_KEY = "murdoku:community:signedIn";
export const wasSignedIn = () => readJson(SIGNED_IN_KEY, false) === true;
export const setSignedIn = (value) => tryWriteJson(SIGNED_IN_KEY, Boolean(value));
