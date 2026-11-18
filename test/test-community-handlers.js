// The server side of the shared case database (functions/src/handlers.js) against an in-memory store: what is
// accepted, what is refused and why, what is written, and that a refused request writes nothing.
import { createHandlers, CaseError } from "../functions/src/handlers.js";
import * as policy from "../src/community/casePolicy.js";
import { createFakeStore } from "./helpers/fake-store.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const load = async (name) => JSON.parse(await readRepoFile(`test/fixtures/${name}.murdoku.json`));
const META = {
  title: "Il faro nella tempesta",
  blurb: "Un caso breve di mistero.",
  lang: "it",
  difficulty: "medium",
  license: "cc-by",
  tags: ["mistero"],
};

// an environment: a store with a signed-in author who has a nickname and has solved the case they publish
async function environment({ uid = "u1", nickname = "Gianna", solved = true, limits = null, policyOverride = null, store = null } = {}) {
  const base = await load("faro.en");
  const s =
    store ??
    createFakeStore({
      [`profiles/${uid}`]: { nickname, key: nickname.toLowerCase() },
      ...(solved ? { [`users/${uid}/achievements/summary`]: { solves: { [`puzzle:${base.id}`]: { firstSolvedAt: 1 } } } } : {}),
    });
  let clock = new Date("2026-11-20T10:00:00Z");
  let draws = 0;
  const handlers = createHandlers({
    store: s,
    policy: policyOverride ?? policy,
    now: () => clock,
    randomInt: (n) => (draws++ * 7 + 3) % n, // varied, deterministic
    limitsOverride: limits,
  });
  return {
    store: s,
    handlers,
    base,
    setClock: (iso) => (clock = new Date(iso)),
    asUser: (id) => ({ uid: id }),
    publish: (data = {}, id = uid) => handlers.publishCase({ puzzle: base, puzzleId: base.id, meta: META, ...data }, { uid: id }),
  };
}

const rejected = async (promise) => {
  try {
    await promise;
  } catch (error) {
    assert(error instanceof CaseError, `un errore del dominio, non ${error?.message}`);
    return error;
  }
  throw new Error("doveva essere rifiutato");
};
const variant = (puzzle, tag) => {
  const copy = JSON.parse(JSON.stringify(puzzle));
  copy.characters[0].name = `${copy.characters[0].name}${tag}`;
  return copy;
};

export const tests = [
  {
    name: "pubblicare: un caso valido riceve un codice e scrive scheda, revisione 1, impronta, elenco dell'autore, autore e contatore del giorno",
    fn: async () => {
      const env = await environment();
      const result = await env.publish();
      assertEqual(result.revision, 1);
      assert(policy.isCaseCode(result.code), `codice valido (${result.code})`);
      const card = (await env.store.get(`cases/${result.code}`)).data;
      assertEqual(card.title, "Il faro nella tempesta");
      assertEqual(card.titleLower, "il faro nella tempesta");
      assertEqual(card.authorUid, "u1");
      assertEqual(card.authorNick, "Gianna");
      assertEqual(card.license, "cc-by");
      assertEqual(card.status, "active");
      assertEqual(card.revision, 1);
      assertEqual(JSON.stringify(card.stats), JSON.stringify({ opened: 0, solved: 0, likes: 0 }));
      assertEqual(card.reportsOpen, 0);
      assertEqual(card.rows, env.base.grid.size.rows);
      assertEqual(card.characters, env.base.characters.length);
      assertEqual(card.clues, env.base.clues.length);
      assertEqual(card.lang, "it");
      assertEqual(card.difficulty, "medium");
      assertEqual(card.tags.join(), "mistero");
      assert(!("remixOf" in card), "nessun remix");
      assert(/^[0-9a-f]{64}$/.test(card.contentHash));
      assert(card.createdAt instanceof Date && card.updatedAt instanceof Date);

      const revision = (await env.store.get(`cases/${result.code}/revisions/1`)).data;
      const body = JSON.parse(revision.json);
      assertEqual(body.id, `shared_${result.code}`, "id uguale per tutti i lettori");
      assertEqual(body.author, "Gianna", "il nome pubblico è il nickname");
      assertEqual(body.title, "Il faro nella tempesta");
      assertEqual(body.completed, false);
      assertEqual(body.bestTimeSeconds, null);
      assertEqual(revision.bytes, new TextEncoder().encode(revision.json).length);

      assertEqual((await env.store.get(`caseHashes/${card.contentHash}`)).data.code, result.code, "l'impronta è prenotata");
      const mine = (await env.store.get(`users/u1/published/${result.code}`)).data;
      assertEqual(mine.puzzleId, env.base.id, "l'elenco privato ricorda il caso locale");
      const author = (await env.store.get("authors/u1")).data;
      assertEqual(author.caseCount, 1);
      assertEqual(author.nick, "Gianna");
      assertEqual(author.nickLower, "gianna");
      assertEqual((await env.store.get("users/u1/publishLog/2026-11-20")).data.publishes, 1);
    },
  },
  {
    name: "pubblicare: senza login, senza nickname, senza aver risolto il caso, con metadati o caso non validi, o troppo grande si rifiuta e non si scrive niente",
    fn: async () => {
      const env = await environment();
      const untouched = () => env.store.docs.size;
      const start = untouched();
      assertEqual(
        (await rejected(env.handlers.publishCase({ puzzle: env.base, puzzleId: env.base.id, meta: META }, null))).code,
        "unauthenticated"
      );
      assertEqual(
        (await rejected(env.handlers.publishCase({ puzzle: env.base, puzzleId: env.base.id, meta: META }, {}))).code,
        "unauthenticated"
      );

      const noNick = await environment({ store: createFakeStore({}) });
      assertEqual((await rejected(noNick.publish())).reason, "no-nickname");
      const blankNick = await environment({ store: createFakeStore({ "profiles/u1": { nickname: "", key: "" } }) });
      assertEqual((await rejected(blankNick.publish())).reason, "no-nickname");

      const unsolved = await environment({ solved: false });
      assertEqual((await rejected(unsolved.publish())).reason, "not-solved", "nessun riepilogo delle risoluzioni");
      assertEqual((await rejected(env.publish({ puzzleId: "puzzle_altro" }))).reason, "not-solved", "ha risolto un altro caso, non questo");
      assertEqual((await rejected(env.publish({ puzzleId: undefined }))).reason, "not-solved");
      const emptySolves = await environment({
        store: createFakeStore({ "profiles/u1": { nickname: "G", key: "g" }, "users/u1/achievements/summary": { solves: {} } }),
      });
      assertEqual((await rejected(emptySolves.publish())).reason, "not-solved");

      const badMeta = await rejected(env.publish({ meta: { ...META, title: "x", lang: "fr" } }));
      assertEqual(badMeta.code, "invalid-argument");
      assertEqual(badMeta.reason, "invalid-meta");
      assertEqual(
        badMeta.details.errors
          .map((e) => `${e.field}:${e.code}`)
          .sort()
          .join(),
        "lang:invalid,title:too-short"
      );
      assertEqual((await rejected(env.publish({ puzzle: { ...env.base, clues: [] } }))).reason, "invalid-puzzle");
      assertEqual((await rejected(env.publish({ puzzle: null }))).reason, "invalid-puzzle");

      const tight = await environment({ policyOverride: { ...policy, LIMITS: { ...policy.LIMITS, bodyMaxBytes: 500 } } });
      const big = await rejected(tight.publish());
      assertEqual(big.reason, "too-big");
      assertEqual(big.details.max, 500);

      assertEqual(untouched(), start, "nessun documento scritto dai rifiuti");
      assertEqual(noNick.store.docs.size, 0);
    },
  },
  {
    name: "impronta: lo stesso caso non si pubblica due volte (nemmeno con altri id, titolo e testi), neanche da un altro utente; il rifiuto dice quale codice è già in uso",
    fn: async () => {
      const env = await environment();
      const first = await env.publish();
      const again = await rejected(env.publish());
      assertEqual(again.code, "already-exists");
      assertEqual(again.reason, "duplicate");
      assertEqual(again.details.code, first.code);
      assertEqual(again.details.yours, true);

      // a copy: other ids, other title and texts
      let text = JSON.stringify(env.base);
      for (const id of [
        ...env.base.characters.map((c) => c.id),
        ...env.base.grid.zones.map((z) => z.id),
        ...env.base.clues.map((c) => c.id),
      ])
        text = text.split(`"${id}"`).join(`"${id}x"`);
      const copy = JSON.parse(text);
      copy.title = "Un'altra intestazione";
      copy.briefing = "Altro testo";
      const viaCopy = await rejected(env.publish({ puzzle: copy, meta: { ...META, title: "Un altro titolo" } }));
      assertEqual(viaCopy.reason, "duplicate");

      // someone else with the same content
      env.store.docs.set("profiles/u2", { nickname: "Paolo", key: "paolo" });
      env.store.docs.set("users/u2/achievements/summary", { solves: { [`puzzle:${env.base.id}`]: {} } });
      const other = await rejected(env.publish({}, "u2"));
      assertEqual(other.reason, "duplicate");
      assertEqual(other.details.yours, false, "non è suo");
      assertEqual(other.details.code, first.code);

      const changed = await env.publish({ puzzle: variant(env.base, "!") });
      assert(changed.code !== first.code, "un caso diverso è un'altra pubblicazione");
    },
  },
  {
    name: "limiti: pubblicazioni al giorno (si riparte il giorno dopo) e casi attivi; il rifiuto non consuma niente",
    fn: async () => {
      const env = await environment({ limits: { publishPerDay: 2, activeCasesMax: 3 } });
      await env.publish({ puzzle: variant(env.base, "1") });
      await env.publish({ puzzle: variant(env.base, "2") });
      const third = await rejected(env.publish({ puzzle: variant(env.base, "3") }));
      assertEqual(third.code, "resource-exhausted");
      assertEqual(third.reason, "limit-per-day");
      assertEqual(third.details.max, 2);
      assertEqual((await env.store.get("users/u1/publishLog/2026-11-20")).data.publishes, 2, "il rifiuto non conta");
      env.setClock("2026-11-21T00:00:05Z");
      await env.publish({ puzzle: variant(env.base, "3") });
      env.setClock("2026-11-22T09:00:00Z");
      const active = await rejected(env.publish({ puzzle: variant(env.base, "4") }));
      assertEqual(active.reason, "limit-active", "tre casi attivi è il massimo");
      assertEqual((await env.store.get("authors/u1")).data.caseCount, 3);
    },
  },
  {
    name: "codice: se il codice estratto è già di un altro caso se ne estrae un altro; il codice non si riusa mai",
    fn: async () => {
      const env = await environment();
      let draws = 0;
      const collide = createHandlers({
        store: env.store,
        policy,
        now: () => new Date("2026-11-20T10:00:00Z"),
        // the first code drawn twice is the one of the case that is already there
        randomInt: (n) => (draws++ % 16 < 8 ? 5 : (draws * 3) % n),
      });
      const first = await collide.publishCase({ puzzle: env.base, puzzleId: env.base.id, meta: META }, { uid: "u1" });
      draws = 0; // the same draws again: the first code comes up again, and it is taken
      const second = await collide.publishCase({ puzzle: variant(env.base, "!"), puzzleId: env.base.id, meta: META }, { uid: "u1" });
      assert(first.code !== second.code, `due codici diversi (${first.code} / ${second.code})`);
      assertEqual(first.code, policy.CODE_SYMBOLS[5].repeat(8));
      assert((await env.store.get(`cases/${first.code}`)).exists && (await env.store.get(`cases/${second.code}`)).exists);

      // when every draw collides, it gives up with an internal error instead of overwriting anything
      const stuck = createHandlers({ store: env.store, policy, now: () => new Date("2026-11-20T10:00:00Z"), randomInt: () => 5 });
      let error = null;
      try {
        await stuck.publishCase({ puzzle: variant(env.base, "?"), puzzleId: env.base.id, meta: META }, { uid: "u1" });
      } catch (e) {
        error = e;
      }
      assertEqual(error?.code, "internal");
      assertEqual((await env.store.get(`cases/${first.code}`)).data.title, "Il faro nella tempesta", "il caso esistente non è toccato");
    },
  },
  {
    name: "remix: solo di un caso attivo con licenza che lo consente; la scheda ricorda da quale caso e di chi",
    fn: async () => {
      const env = await environment();
      const open = await env.publish();
      env.store.docs.set("profiles/u2", { nickname: "Paolo", key: "paolo" });
      const own = variant(env.base, "!");
      env.store.docs.set("users/u2/achievements/summary", { solves: { [`puzzle:${own.id}`]: {} } });
      const remix = await env.handlers.publishCase({ puzzle: own, puzzleId: own.id, meta: META, remixOf: open.code }, { uid: "u2" });
      const card = (await env.store.get(`cases/${remix.code}`)).data;
      assertEqual(card.remixOf.code, open.code);
      assertEqual(card.remixOf.nick, "Gianna");

      // a case that is play-only cannot be remixed
      const closed = await env.handlers.publishCase(
        { puzzle: variant(env.base, "?"), puzzleId: env.base.id, meta: { ...META, license: "play-only" } },
        { uid: "u1" }
      );
      const sourceNote = async (code) =>
        rejected(
          env.handlers.publishCase({ puzzle: variant(env.base, "#"), puzzleId: env.base.id, meta: META, remixOf: code }, { uid: "u1" })
        );
      assertEqual((await sourceNote(closed.code)).reason, "remix-not-allowed");
      assertEqual((await sourceNote("ACDEFGHJ")).reason, "remix-not-allowed", "un caso che non esiste");
      assertEqual((await sourceNote("non-un-codice")).reason, "remix-not-allowed");
      // withdrawn: not offered any more
      await env.handlers.withdrawCase({ code: open.code }, { uid: "u1" });
      assertEqual((await sourceNote(open.code)).reason, "remix-not-allowed");
    },
  },
  {
    name: "nuova revisione: solo l'autore, scheda e numero aggiornati, vecchia revisione conservata, impronta vecchia liberata; contenuto uguale, duplicato, licenza cambiata o caso nascosto si rifiutano",
    fn: async () => {
      const env = await environment();
      const { code } = await env.publish();
      const oldHash = (await env.store.get(`cases/${code}`)).data.contentHash;
      const edited = variant(env.base, "ter");
      env.setClock("2026-11-20T12:00:00Z");
      const updated = await env.handlers.updateCase(
        { code, puzzle: edited, meta: { ...META, title: "Il faro, seconda versione", blurb: "Migliorato." } },
        { uid: "u1" }
      );
      assertEqual(updated.revision, 2);
      const card = (await env.store.get(`cases/${code}`)).data;
      assertEqual(card.revision, 2);
      assertEqual(card.title, "Il faro, seconda versione");
      assertEqual(card.blurb, "Migliorato.");
      assertEqual(card.updatedAt.toISOString(), "2026-11-20T12:00:00.000Z");
      assertEqual(card.createdAt.toISOString(), "2026-11-20T10:00:00.000Z", "la data di creazione resta");
      assertEqual(card.stats.opened, 0, "i contatori restano");
      assert(card.contentHash !== oldHash);
      assertEqual(
        JSON.parse((await env.store.get(`cases/${code}/revisions/1`)).data.json).title,
        "Il faro nella tempesta",
        "la revisione 1 è com'era"
      );
      const second = JSON.parse((await env.store.get(`cases/${code}/revisions/2`)).data.json);
      assertEqual(second.title, "Il faro, seconda versione");
      assertEqual(second.id, `shared_${code}`, "l'id non cambia mai: i progressi di chi gioca restano agganciati");
      assert(second.characters[0].name.endsWith("ter"));
      assertEqual((await env.store.get(`caseHashes/${oldHash}`)).exists, false, "l'impronta vecchia è libera");
      assertEqual((await env.store.get(`caseHashes/${card.contentHash}`)).data.code, code);
      assertEqual((await env.store.get("users/u1/publishLog/2026-11-20")).data.updates, 1);

      const same = await rejected(env.handlers.updateCase({ code, puzzle: edited, meta: META }, { uid: "u1" }));
      assertEqual(same.reason, "unchanged");
      assertEqual(
        (
          await rejected(
            env.handlers.updateCase({ code, puzzle: variant(env.base, "ter"), meta: { ...META, license: "play-only" } }, { uid: "u1" })
          )
        ).reason,
        "license-immutable"
      );
      // the fingerprint of the first revision was freed: going back to it is a new revision, not a duplicate
      const back = await env.handlers.updateCase({ code, puzzle: env.base, meta: META }, { uid: "u1" });
      assertEqual(back.revision, 3);
      assertEqual((await env.store.get(`caseHashes/${card.contentHash}`)).exists, false, "e l'impronta della seconda ora è libera");
      // someone else's case, a case that does not exist, a bad code, no login
      env.store.docs.set("profiles/u2", { nickname: "Paolo", key: "paolo" });
      assertEqual(
        (await rejected(env.handlers.updateCase({ code, puzzle: variant(env.base, "x"), meta: META }, { uid: "u2" }))).code,
        "permission-denied"
      );
      assertEqual(
        (await rejected(env.handlers.updateCase({ code: "ACDEFGHJ", puzzle: variant(env.base, "x"), meta: META }, { uid: "u1" }))).code,
        "not-found"
      );
      assertEqual(
        (await rejected(env.handlers.updateCase({ code: "no", puzzle: variant(env.base, "x"), meta: META }, { uid: "u1" }))).reason,
        "bad-code"
      );
      assertEqual(
        (await rejected(env.handlers.updateCase({ code, puzzle: variant(env.base, "x"), meta: META }, null))).code,
        "unauthenticated"
      );
      // hidden by moderation: the author cannot bring it back by editing
      env.store.docs.set(`cases/${code}`, { ...(await env.store.get(`cases/${code}`)).data, status: "hidden" });
      assertEqual(
        (await rejected(env.handlers.updateCase({ code, puzzle: variant(env.base, "x"), meta: META }, { uid: "u1" }))).reason,
        "hidden-by-moderation"
      );
    },
  },
  {
    name: "revisioni e aggiornamenti: tetto per caso e per giorno; un caso ritirato che si aggiorna torna attivo e ricontato",
    fn: async () => {
      const perDayEnv = await environment({ limits: { updatePerDay: 2 } });
      const { code } = await perDayEnv.publish();
      await perDayEnv.handlers.updateCase({ code, puzzle: variant(perDayEnv.base, "1"), meta: META }, { uid: "u1" });
      await perDayEnv.handlers.updateCase({ code, puzzle: variant(perDayEnv.base, "2"), meta: META }, { uid: "u1" });
      const perDay = await rejected(
        perDayEnv.handlers.updateCase({ code, puzzle: variant(perDayEnv.base, "3"), meta: META }, { uid: "u1" })
      );
      assertEqual(perDay.reason, "limit-per-day");
      assertEqual(perDay.details.max, 2);
      perDayEnv.setClock("2026-11-21T10:00:00Z");
      assertEqual(
        (await perDayEnv.handlers.updateCase({ code, puzzle: variant(perDayEnv.base, "3"), meta: META }, { uid: "u1" })).revision,
        4,
        "il giorno dopo si riparte"
      );

      const perCaseEnv = await environment({ limits: { revisionsMax: 3 } });
      const published0 = await perCaseEnv.publish();
      await perCaseEnv.handlers.updateCase({ code: published0.code, puzzle: variant(perCaseEnv.base, "1"), meta: META }, { uid: "u1" });
      await perCaseEnv.handlers.updateCase({ code: published0.code, puzzle: variant(perCaseEnv.base, "2"), meta: META }, { uid: "u1" });
      const perCase = await rejected(
        perCaseEnv.handlers.updateCase({ code: published0.code, puzzle: variant(perCaseEnv.base, "3"), meta: META }, { uid: "u1" })
      );
      assertEqual(perCase.reason, "limit-revisions", "3 revisioni è il massimo del caso");
      assertEqual((await perCaseEnv.store.get(`cases/${published0.code}`)).data.revision, 3);

      const env2 = await environment();
      const published = await env2.publish();
      await env2.handlers.withdrawCase({ code: published.code }, { uid: "u1" });
      assertEqual((await env2.store.get("authors/u1")).data.caseCount, 0);
      await env2.handlers.updateCase({ code: published.code, puzzle: variant(env2.base, "9"), meta: META }, { uid: "u1" });
      assertEqual((await env2.store.get(`cases/${published.code}`)).data.status, "active");
      assertEqual((await env2.store.get("authors/u1")).data.caseCount, 1);
    },
  },
  {
    name: "ritirare e ripristinare: solo l'autore, il contatore dei casi attivi segue, un caso nascosto dalla moderazione non si ripristina; ripetere non cambia niente",
    fn: async () => {
      const env = await environment({ limits: { activeCasesMax: 1 } });
      const { code } = await env.publish();
      assertEqual((await env.handlers.withdrawCase({ code }, { uid: "u1" })).status, "withdrawn");
      assertEqual((await env.store.get(`cases/${code}`)).data.status, "withdrawn");
      assertEqual((await env.store.get("authors/u1")).data.caseCount, 0);
      await env.handlers.withdrawCase({ code }, { uid: "u1" });
      assertEqual((await env.store.get("authors/u1")).data.caseCount, 0, "ritirare due volte non scende sotto zero");
      assertEqual((await rejected(env.handlers.withdrawCase({ code }, { uid: "u2" }))).code, "permission-denied");
      assertEqual((await rejected(env.handlers.withdrawCase({ code: "ACDEFGHJ" }, { uid: "u1" }))).code, "not-found");
      assertEqual((await rejected(env.handlers.withdrawCase({ code }, null))).code, "unauthenticated");

      // while it is withdrawn the author fills the place with another case: no room to bring the first back
      await env.publish({ puzzle: variant(env.base, "!") });
      const full = await rejected(env.handlers.withdrawCase({ code, withdrawn: false }, { uid: "u1" }));
      assertEqual(full.reason, "limit-active");

      const env2 = await environment();
      const published = await env2.publish();
      await env2.handlers.withdrawCase({ code: published.code }, { uid: "u1" });
      assertEqual((await env2.handlers.withdrawCase({ code: published.code, withdrawn: false }, { uid: "u1" })).status, "active");
      assertEqual((await env2.store.get("authors/u1")).data.caseCount, 1);
      await env2.handlers.withdrawCase({ code: published.code, withdrawn: false }, { uid: "u1" });
      assertEqual((await env2.store.get("authors/u1")).data.caseCount, 1, "ripristinare due volte non conta due volte");
      env2.store.docs.set(`cases/${published.code}`, { ...(await env2.store.get(`cases/${published.code}`)).data, status: "hidden" });
      assertEqual(
        (await rejected(env2.handlers.withdrawCase({ code: published.code, withdrawn: false }, { uid: "u1" }))).reason,
        "hidden-by-moderation"
      );
    },
  },
  {
    name: "cancellare: scompaiono scheda, revisioni, impronta ed elenco dell'autore; il contatore scende solo se era attivo; il contenuto si può ripubblicare",
    fn: async () => {
      const env = await environment();
      const { code } = await env.publish();
      await env.handlers.updateCase({ code, puzzle: variant(env.base, "v2"), meta: META }, { uid: "u1" });
      assertEqual((await rejected(env.handlers.deleteCase({ code }, { uid: "u2" }))).code, "permission-denied");
      assert((await env.store.get(`cases/${code}`)).exists, "un altro utente non cancella");
      assertEqual((await env.handlers.deleteCase({ code }, { uid: "u1" })).deleted, true);
      for (const path of [`cases/${code}`, `cases/${code}/revisions/1`, `cases/${code}/revisions/2`, `users/u1/published/${code}`])
        assertEqual((await env.store.get(path)).exists, false, `${path} cancellato`);
      assertEqual([...env.store.docs.keys()].filter((p) => p.startsWith("caseHashes/")).length, 0, "nessuna impronta orfana");
      assertEqual((await env.store.get("authors/u1")).data.caseCount, 0);
      assertEqual((await rejected(env.handlers.deleteCase({ code }, { uid: "u1" }))).code, "not-found");
      const again = await env.publish();
      assert(again.code, "lo stesso contenuto si può ripubblicare dopo la cancellazione");

      // deleting a withdrawn case does not take the counter below what it is
      const withdrawn = await env.publish({ puzzle: variant(env.base, "w") });
      await env.handlers.withdrawCase({ code: withdrawn.code }, { uid: "u1" });
      const before = (await env.store.get("authors/u1")).data.caseCount;
      await env.handlers.deleteCase({ code: withdrawn.code }, { uid: "u1" });
      assertEqual((await env.store.get("authors/u1")).data.caseCount, before, "era già ritirato: già non contava");
      assertEqual((await rejected(env.handlers.deleteCase({ code }, null))).code, "unauthenticated");
    },
  },
];
