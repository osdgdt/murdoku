// The Cloud Functions for real, against the Firebase emulators (Auth + Functions + Firestore), called the way the browser
// calls them (the HTTPS protocol of callable functions). `npm run test:functions` from the repository root starts the
// emulators and runs this file. What the unit tests (test/test-community-handlers.js) cannot show: the Firestore
// adapter (transactions, create, recursive delete), the wiring of errors into callable errors, and the shared copy
// of casePolicy.js that is deployed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT = process.env.GCLOUD_PROJECT || "demo-murdoku";
const REGION = "europe-west1";
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;
const AUTH = "http://127.0.0.1:9099";
const fixture = JSON.parse(readFileSync(new URL("../../test/fixtures/faro.en.murdoku.json", import.meta.url), "utf8"));
const META = {
  title: "Il faro nella tempesta",
  blurb: "Un caso breve di mistero.",
  lang: "it",
  difficulty: "medium",
  license: "cc-by",
  tags: ["mistero"],
};

let db;
before(() => {
  if (!getApps().length) initializeApp({ projectId: PROJECT });
  db = getFirestore();
});
after(async () => {
  await db?.terminate();
});

async function signUp(email) {
  const response = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password-di-prova", returnSecureToken: true }),
  });
  const body = await response.json();
  assert.ok(body.idToken, `registrazione nell'emulatore: ${JSON.stringify(body)}`);
  return { uid: body.localId, token: body.idToken };
}
// the protocol of a callable: POST { data } with the user's token, answer { result } or { error: { status, message, details } }
async function call(name, data, user) {
  const response = await fetch(`${FUNCTIONS}/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(user ? { authorization: `Bearer ${user.token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  return { status: response.status, ...body };
}
const setup = async (user, nickname = "Gianna") => {
  await db.doc(`profiles/${user.uid}`).set({ nickname, key: nickname.toLowerCase() });
  await db.doc(`users/${user.uid}/achievements/summary`).set({ solves: { [`puzzle:${fixture.id}`]: { firstSolvedAt: 1 } } });
};
const variant = (tag) => {
  const copy = JSON.parse(JSON.stringify(fixture));
  copy.characters[0].name += tag;
  return copy;
};

test("pubblicare: senza login si rifiuta; con login, nickname e caso risolto nasce un caso con il suo codice", async () => {
  const anonymous = await call("publishCase", { puzzle: fixture, puzzleId: fixture.id, meta: META }, null);
  assert.equal(anonymous.error?.status, "UNAUTHENTICATED");

  const gianna = await signUp("gianna@esempio.it");
  const noNick = await call("publishCase", { puzzle: fixture, puzzleId: fixture.id, meta: META }, gianna);
  assert.equal(noNick.error?.status, "FAILED_PRECONDITION");
  assert.equal(noNick.error?.details?.reason, "no-nickname", "il motivo arriva alla pagina");

  await setup(gianna);
  const published = await call("publishCase", { puzzle: fixture, puzzleId: fixture.id, meta: META }, gianna);
  assert.ok(published.result, JSON.stringify(published));
  assert.match(published.result.code, /^[ACDEFGHJKMNPQRTUVWXY346]{8}$/);
  assert.equal(published.result.revision, 1);

  const code = published.result.code;
  const card = (await db.doc(`cases/${code}`).get()).data();
  assert.equal(card.title, META.title);
  assert.equal(card.authorUid, gianna.uid);
  assert.equal(card.authorNick, "Gianna");
  assert.equal(card.status, "active");
  assert.equal(card.createdAt.toDate().getFullYear() >= 2026, true, "date vere (Timestamp)");
  const body = JSON.parse((await db.doc(`cases/${code}/revisions/1`).get()).data().json);
  assert.equal(body.id, `shared_${code}`);
  assert.equal(body.author, "Gianna");
  assert.equal((await db.doc(`authors/${gianna.uid}`).get()).data().caseCount, 1);
  assert.equal((await db.doc(`users/${gianna.uid}/published/${code}`).get()).exists, true);

  const duplicate = await call("publishCase", { puzzle: fixture, puzzleId: fixture.id, meta: META }, gianna);
  assert.equal(duplicate.error?.status, "ALREADY_EXISTS");
  assert.equal(duplicate.error?.details?.code, code, "il rifiuto indica il codice già in uso");
});

test("pubblicare: metadati o caso non validi e caso non risolto dall'autore si rifiutano con il motivo", async () => {
  const paolo = await signUp("paolo@esempio.it");
  await setup(paolo, "Paolo");
  const badMeta = await call("publishCase", { puzzle: fixture, puzzleId: fixture.id, meta: { ...META, title: "x" } }, paolo);
  assert.equal(badMeta.error?.status, "INVALID_ARGUMENT");
  assert.equal(badMeta.error?.details?.reason, "invalid-meta");
  const noClues = await call("publishCase", { puzzle: { ...fixture, clues: [] }, puzzleId: fixture.id, meta: META }, paolo);
  assert.equal(noClues.error?.details?.reason, "invalid-puzzle");
  const unsolved = await call("publishCase", { puzzle: fixture, puzzleId: "puzzle_mai_risolto", meta: META }, paolo);
  assert.equal(unsolved.error?.details?.reason, "not-solved");
});

test("revisione, ritiro e cancellazione: solo l'autore; cancellare toglie scheda, revisioni e impronta", async () => {
  const marta = await signUp("marta@esempio.it");
  const intruso = await signUp("intruso@esempio.it");
  await setup(marta, "Marta");
  await setup(intruso, "Intruso");
  const { result } = await call("publishCase", { puzzle: variant("m"), puzzleId: fixture.id, meta: META }, marta);
  const code = result.code;

  const updated = await call("updateCase", { code, puzzle: variant("m2"), meta: { ...META, title: "Il faro, di nuovo" } }, marta);
  assert.equal(updated.result?.revision, 2, JSON.stringify(updated));
  assert.equal((await db.doc(`cases/${code}`).get()).data().revision, 2);
  assert.equal((await db.doc(`cases/${code}/revisions/1`).get()).exists, true, "la revisione 1 resta");
  const stranger = await call("updateCase", { code, puzzle: variant("m3"), meta: META }, intruso);
  assert.equal(stranger.error?.status, "PERMISSION_DENIED");
  assert.equal((await call("deleteCase", { code }, intruso)).error?.status, "PERMISSION_DENIED");
  assert.equal((await call("withdrawCase", { code }, intruso)).error?.status, "PERMISSION_DENIED");

  assert.equal((await call("withdrawCase", { code }, marta)).result?.status, "withdrawn");
  assert.equal((await db.doc(`cases/${code}`).get()).data().status, "withdrawn");
  assert.equal((await db.doc(`authors/${marta.uid}`).get()).data().caseCount, 0);
  assert.equal((await call("withdrawCase", { code, withdrawn: false }, marta)).result?.status, "active");

  const hash = (await db.doc(`cases/${code}`).get()).data().contentHash;
  assert.equal((await db.doc(`caseHashes/${hash}`).get()).exists, true);
  assert.equal((await call("deleteCase", { code }, marta)).result?.deleted, true);
  assert.equal((await db.doc(`cases/${code}`).get()).exists, false);
  assert.equal((await db.doc(`cases/${code}/revisions/1`).get()).exists, false, "anche le revisioni (cancellazione ricorsiva)");
  assert.equal((await db.doc(`cases/${code}/revisions/2`).get()).exists, false);
  assert.equal((await db.doc(`caseHashes/${hash}`).get()).exists, false, "nessuna impronta orfana");
  assert.equal((await call("deleteCase", { code }, marta)).error?.status, "NOT_FOUND");
});

test("limiti: oltre le pubblicazioni del giorno si rifiuta (letti da config/limits)", async () => {
  const luca = await signUp("luca@esempio.it");
  await setup(luca, "Luca");
  await db.doc("config/limits").set({ publishPerDay: 2 });
  assert.ok((await call("publishCase", { puzzle: variant("l1"), puzzleId: fixture.id, meta: META }, luca)).result);
  assert.ok((await call("publishCase", { puzzle: variant("l2"), puzzleId: fixture.id, meta: META }, luca)).result);
  const third = await call("publishCase", { puzzle: variant("l3"), puzzleId: fixture.id, meta: META }, luca);
  assert.equal(third.error?.status, "RESOURCE_EXHAUSTED");
  assert.equal(third.error?.details?.reason, "limit-per-day");
  await db.doc("config/limits").delete();
});
