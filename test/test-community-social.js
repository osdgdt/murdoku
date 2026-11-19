// Likes, who played, following, reports, the administrator's actions and deleting an account (functions/src/social.js and
// moderation.js), against the in-memory store: the same handlers that run on the Cloud Functions.
import { createHandlers, CaseError } from "../functions/src/handlers.js";
import * as policy from "../src/community/casePolicy.js";
import { createFakeStore } from "./helpers/fake-store.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const META = {
  title: "Il faro nella tempesta",
  blurb: "Un caso breve di mistero.",
  lang: "it",
  difficulty: "medium",
  license: "cc-by",
  tags: ["mistero"],
};
const OWNER = "say3jOf6WkaXDmjyn3kmAKNYbCh1";

// u1 is the author (nickname, has solved the case), u2..u5 are readers with a nickname, u6 has none, `adm` is in `admins`
async function environment(limits = null) {
  const base = JSON.parse(await readRepoFile("test/fixtures/faro.en.murdoku.json"));
  const docs = { "admins/adm": { since: 1 }, "profiles/u6x": { nickname: "" } };
  for (const [uid, nickname] of [
    ["u1", "Gianna"],
    ["u2", "Paolo"],
    ["u3", "Marta"],
    ["u4", "Luca"],
    ["u5", "Sara"],
    ["adm", "Capo"],
    [OWNER, "Titolare"],
  ])
    docs[`profiles/${uid}`] = { nickname, key: nickname.toLowerCase() };
  docs[`users/u1/achievements/summary`] = { solves: { [`puzzle:${base.id}`]: { firstSolvedAt: 1 } } };
  const store = createFakeStore(docs);
  let clock = new Date("2026-11-20T10:00:00Z");
  let draws = 0;
  const handlers = createHandlers({ store, policy, now: () => clock, randomInt: (n) => (draws++ * 7 + 3) % n, limitsOverride: limits });
  const published = await handlers.publishCase({ puzzle: base, puzzleId: base.id, meta: META }, { uid: "u1" });
  const as = (uid) => ({ uid });
  return {
    store,
    handlers,
    base,
    code: published.code,
    as,
    card: async () => (await store.get(`cases/${published.code}`)).data,
    setClock: (iso) => (clock = new Date(iso)),
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

export const tests = [
  {
    name: "mi piace: uno per persona e per caso (ripetere non cambia nulla), si toglie, non si mette al proprio caso né da anonimi o senza nickname",
    fn: async () => {
      const { handlers, code, as, card, store } = await environment();
      assertEqual((await handlers.setLike({ code, liked: true }, as("u2"))).likes, 1);
      assertEqual((await handlers.setLike({ code, liked: true }, as("u2"))).likes, 1, "ripetere non cambia nulla");
      assertEqual((await handlers.setLike({ code }, as("u3"))).likes, 2, "senza `liked` vale «mi piace»");
      assertEqual((await card()).stats.likes, 2);
      assertEqual((await store.get(`cases/${code}/likes/u2`)).data.uid, "u2");
      assertEqual((await handlers.setLike({ code, liked: false }, as("u2"))).likes, 1);
      assertEqual((await handlers.setLike({ code, liked: false }, as("u2"))).likes, 1, "togliere due volte non scende sotto");
      assertEqual((await store.get(`cases/${code}/likes/u2`)).exists, false);
      assertEqual((await rejected(handlers.setLike({ code, liked: true }, as("u1")))).reason, "own-case");
      assertEqual((await rejected(handlers.setLike({ code, liked: true }, null))).reason, "sign-in-required");
      assertEqual((await rejected(handlers.setLike({ code, liked: true }, as("nobody")))).reason, "no-nickname");
      assertEqual((await rejected(handlers.setLike({ code: "ACDEFGHJ", liked: true }, as("u2")))).reason, "no-such-case");
      assertEqual((await rejected(handlers.setLike({ code: "no" }, as("u2")))).reason, "bad-code");
      await handlers.withdrawCase({ code }, as("u1"));
      assertEqual(
        (await rejected(handlers.setLike({ code, liked: true }, as("u4")))).reason,
        "no-such-case",
        "un caso ritirato non si apprezza"
      );
    },
  },
  {
    name: "giocato e risolto: una persona conta una volta come aperto e una come risolto (risolto conta anche aperto); l'autore e i casi non pubblici no",
    fn: async () => {
      const { handlers, code, as, card, store } = await environment();
      assertEqual((await handlers.recordPlay({ code, event: "opened" }, as("u2"))).counted, true);
      assertEqual((await handlers.recordPlay({ code, event: "opened" }, as("u2"))).counted, false, "la seconda apertura non conta");
      let stats = (await card()).stats;
      assertEqual(`${stats.opened}/${stats.solved}`, "1/0");
      assertEqual((await handlers.recordPlay({ code, event: "solved" }, as("u2"))).counted, true);
      assertEqual((await handlers.recordPlay({ code, event: "solved" }, as("u2"))).counted, false);
      stats = (await card()).stats;
      assertEqual(`${stats.opened}/${stats.solved}`, "1/1", "aperto resta 1: la stessa persona");
      await handlers.recordPlay({ code, event: "solved" }, as("u3")); // solved without having been counted as opened
      stats = (await card()).stats;
      assertEqual(`${stats.opened}/${stats.solved}`, "2/2");
      assertEqual((await store.get(`cases/${code}/plays/u3`)).data.opened, true);
      assertEqual((await handlers.recordPlay({ code, event: "opened" }, as("u1"))).counted, false, "il suo stesso caso");
      assertEqual(
        (await handlers.recordPlay({ code: "ACDEFGHJ", event: "opened" }, as("u2"))).counted,
        false,
        "un caso che non c'è: niente errore"
      );
      assertEqual((await rejected(handlers.recordPlay({ code, event: "boh" }, as("u2")))).reason, "bad-event");
      assertEqual((await rejected(handlers.recordPlay({ code, event: "opened" }, null))).reason, "sign-in-required");
      await handlers.withdrawCase({ code }, as("u1"));
      assertEqual((await handlers.recordPlay({ code, event: "opened" }, as("u4"))).counted, false, "un caso ritirato non conta");
      assertEqual((await card()).stats.opened, 2);
    },
  },
  {
    name: "segui: un autore alla volta, ripetere non cambia i follower, si smette, non se stessi né un autore che non esiste, tetto di autori",
    fn: async () => {
      const { handlers, as, store } = await environment({ followMax: 2 });
      for (const [uid, nick] of [
        ["a2", "Due"],
        ["a3", "Tre"],
      ])
        store.docs.set(`authors/${uid}`, { nick, nickLower: nick.toLowerCase(), caseCount: 1 });
      assertEqual((await handlers.followAuthor({ authorUid: "u1", follow: true }, as("u2"))).followers, 1);
      assertEqual((await handlers.followAuthor({ authorUid: "u1" }, as("u2"))).followers, 1, "ripetere non cambia nulla");
      assertEqual((await handlers.followAuthor({ authorUid: "u1" }, as("u3"))).followers, 2);
      assertEqual((await store.get("users/u2/following/u1")).data.nick, "Gianna");
      assertEqual((await store.get("users/u2/social/summary")).data.following, 1);
      await handlers.followAuthor({ authorUid: "a2" }, as("u2"));
      assertEqual((await rejected(handlers.followAuthor({ authorUid: "a3" }, as("u2")))).reason, "follow-limit");
      assertEqual((await handlers.followAuthor({ authorUid: "u1", follow: false }, as("u2"))).followers, 1);
      assertEqual((await store.get("users/u2/following/u1")).exists, false);
      assertEqual((await store.get("users/u2/social/summary")).data.following, 1);
      assertEqual(
        (await handlers.followAuthor({ authorUid: "u1", follow: false }, as("u2"))).followers,
        1,
        "smettere due volte non scende sotto"
      );
      await handlers.followAuthor({ authorUid: "a3" }, as("u2")); // there is room again
      assertEqual((await rejected(handlers.followAuthor({ authorUid: "u2" }, as("u2")))).reason, "own-case");
      assertEqual((await rejected(handlers.followAuthor({ authorUid: "nessuno" }, as("u2")))).reason, "no-such-author");
      assertEqual((await rejected(handlers.followAuthor({ authorUid: "a/b" }, as("u2")))).reason, "bad-author");
      assertEqual((await rejected(handlers.followAuthor({ authorUid: "u1" }, null))).reason, "sign-in-required");
    },
  },
  {
    name: "pagina dell'autore: chi ha pubblicato scrive la sua presentazione (ripulita, al massimo {bioMax}); gli altri no",
    fn: async () => {
      const { handlers, as, store } = await environment();
      const out = await handlers.setAuthorProfile({ bio: "  Faccio   casi\u0007 di mare.\n\n\n\nE di montagna. " }, as("u1"));
      assertEqual(out.bio, "Faccio casi di mare.\n\nE di montagna.");
      assertEqual((await store.get("authors/u1")).data.bio, out.bio);
      assertEqual((await handlers.setAuthorProfile({ bio: "" }, as("u1"))).bio, "", "si può svuotare");
      assertEqual(
        (await rejected(handlers.setAuthorProfile({ bio: "x".repeat(policy.LIMITS.bioMax + 1) }, as("u1")))).reason,
        "invalid-bio"
      );
      assertEqual(
        (await rejected(handlers.setAuthorProfile({ bio: "ciao" }, as("u2")))).reason,
        "no-cases",
        "senza casi non c'è una pagina"
      );
      assertEqual((await rejected(handlers.setAuthorProfile({ bio: "ciao" }, null))).reason, "sign-in-required");
    },
  },
  {
    name: "segnala: una per persona, non al proprio caso, motivi validi; a tre persone diverse il caso si nasconde da solo",
    fn: async () => {
      const { handlers, code, as, card, store } = await environment({ reportsPerDay: 2 });
      assertEqual((await handlers.reportCase({ code, reason: "spam" }, as("u2"))).hidden, false);
      assertEqual((await store.get(`reports/${code}_u2`)).data.status, "open");
      assertEqual((await rejected(handlers.reportCase({ code, reason: "spam" }, as("u2")))).reason, "already-reported");
      assertEqual((await rejected(handlers.reportCase({ code, reason: "spam" }, as("u1")))).reason, "own-case");
      assertEqual((await rejected(handlers.reportCase({ code, reason: "boh" }, as("u3")))).reason, "invalid-report");
      assertEqual(
        (await rejected(handlers.reportCase({ code, reason: "other" }, as("u3")))).reason,
        "invalid-report",
        "«altro» vuole una nota"
      );
      assertEqual(
        (await rejected(handlers.reportCase({ code, reason: "spam", note: "x".repeat(policy.LIMITS.noteMax + 1) }, as("u3")))).reason,
        "invalid-report"
      );
      assertEqual((await rejected(handlers.reportCase({ code, reason: "spam" }, null))).reason, "sign-in-required");
      assertEqual((await rejected(handlers.reportCase({ code, reason: "spam" }, as("nobody")))).reason, "no-nickname");
      assertEqual((await card()).status, "active", "due segnalazioni non bastano");
      assertEqual((await handlers.reportCase({ code, reason: "other", note: "  copiato   da un libro " }, as("u3"))).hidden, false);
      assertEqual((await store.get(`reports/${code}_u3`)).data.note, "copiato da un libro");
      assertEqual((await card()).reportsOpen, 2);
      const third = await handlers.reportCase({ code, reason: "offensive" }, as("u4"));
      assertEqual(third.hidden, true);
      const hidden = await card();
      assertEqual(`${hidden.status}/${hidden.inGallery}/${hidden.hiddenBy}`, "hidden/false/reports");
      assertEqual((await store.get("authors/u1")).data.caseCount, 0, "non conta più tra i casi attivi");
      assertEqual(
        (await rejected(handlers.reportCase({ code, reason: "spam" }, as("u5")))).reason,
        "no-such-case",
        "un caso nascosto non si segnala più"
      );
      // the per-day limit
      const second = await environment({ reportsPerDay: 1 });
      await second.handlers.reportCase({ code: second.code, reason: "spam" }, second.as("u2"));
      const other = await second.handlers.publishCase(
        {
          puzzle: { ...second.base, characters: second.base.characters.map((c, i) => (i ? c : { ...c, name: `${c.name}x` })) },
          puzzleId: second.base.id,
          meta: META,
        },
        second.as("u1")
      );
      assertEqual(
        (await rejected(second.handlers.reportCase({ code: other.code, reason: "spam" }, second.as("u2")))).reason,
        "limit-per-day"
      );
    },
  },
  {
    name: "amministratore: solo chi è in `admins` (o il titolare) nasconde, ripristina, elimina; ripristinare chiude le segnalazioni",
    fn: async () => {
      const { handlers, code, as, card, store } = await environment();
      await handlers.reportCase({ code, reason: "spam" }, as("u2"));
      for (const who of ["u1", "u2", null])
        assertEqual(
          (await rejected(handlers.moderateCase({ code, action: "hide" }, who ? as(who) : null))).code,
          who ? "permission-denied" : "unauthenticated"
        );
      assertEqual((await rejected(handlers.moderateCase({ code, action: "boh" }, as("adm")))).reason, "bad-action");
      assertEqual((await rejected(handlers.moderateCase({ code: "ACDEFGHJ", action: "hide" }, as("adm")))).reason, "no-such-case");
      assertEqual((await handlers.moderateCase({ code, action: "hide" }, as("adm"))).status, "hidden");
      let now = await card();
      assertEqual(`${now.status}/${now.inGallery}/${now.hiddenBy}`, "hidden/false/admin");
      assertEqual((await store.get("authors/u1")).data.caseCount, 0);
      assertEqual(
        (await handlers.moderateCase({ code, action: "hide" }, as(OWNER))).status,
        "hidden",
        "nascondere due volte non cambia nulla"
      );
      assertEqual((await store.get("authors/u1")).data.caseCount, 0);
      assertEqual(
        (await rejected(handlers.withdrawCase({ code }, as("u1")))).reason,
        "hidden-by-moderation",
        "l'autore non lo ritira né lo rimette"
      );
      assertEqual((await handlers.moderateCase({ code, action: "restore" }, as("adm"))).status, "active");
      now = await card();
      assertEqual(`${now.status}/${now.inGallery}/${now.reportsOpen}/${now.hiddenBy}`, "active/true/0/null");
      assertEqual((await store.get("authors/u1")).data.caseCount, 1);
      assertEqual((await store.get(`reports/${code}_u2`)).data.status, "dismissed", "le segnalazioni sono chiuse");
      // delete: everything of the case is gone
      await handlers.recordPlay({ code, event: "opened" }, as("u3"));
      await handlers.setLike({ code }, as("u3"));
      const hash = (await card()).contentHash;
      assertEqual((await handlers.moderateCase({ code, action: "delete" }, as("adm"))).deleted, true);
      for (const path of [
        `cases/${code}`,
        `cases/${code}/revisions/1`,
        `cases/${code}/likes/u3`,
        `cases/${code}/plays/u3`,
        `caseHashes/${hash}`,
        `users/u1/published/${code}`,
        `reports/${code}_u2`,
      ])
        assertEqual((await store.get(path)).exists, false, path);
      assertEqual((await store.get("authors/u1")).data.caseCount, 0);
    },
  },
  {
    name: "segnalazioni respinte: il caso nascosto dalle segnalazioni torna, quello nascosto da un amministratore no",
    fn: async () => {
      const { handlers, code, as, card, store } = await environment();
      for (const uid of ["u2", "u3", "u4"]) await handlers.reportCase({ code, reason: "spam" }, as(uid));
      assertEqual((await card()).status, "hidden");
      assertEqual((await rejected(handlers.dismissReports({ code }, as("u2")))).code, "permission-denied");
      assertEqual((await handlers.dismissReports({ code }, as("adm"))).status, "active");
      const back = await card();
      assertEqual(`${back.status}/${back.inGallery}/${back.reportsOpen}`, "active/true/0");
      assertEqual((await store.get("authors/u1")).data.caseCount, 1);
      assertEqual((await store.get(`reports/${code}_u3`)).data.status, "dismissed");
      // hidden by an administrator: dismissing the reports does not undo that
      await handlers.moderateCase({ code, action: "hide" }, as("adm"));
      assertEqual((await handlers.dismissReports({ code }, as("adm"))).status, "hidden");
    },
  },
  {
    name: "cancellare l'account, lasciando i casi: «Account eliminato» in scheda e nel testo di ogni revisione, nessun legame con la persona, contatori rimessi a posto",
    fn: async () => {
      const { handlers, code, as, card, store, base } = await environment();
      await handlers.updateCase(
        { code, puzzle: { ...base, characters: base.characters.map((c, i) => (i ? c : { ...c, name: `${c.name}ter` })) }, meta: META },
        as("u1")
      );
      await handlers.followAuthor({ authorUid: "u1" }, as("u2"));
      await handlers.setLike({ code }, as("u2"));
      await handlers.recordPlay({ code, event: "solved" }, as("u2"));
      // the author deletes their account, keeping the cases
      const done = await handlers.prepareAccountDeletion({ keepCases: true }, as("u1"));
      assertEqual(`${done.casesKept}/${done.casesDeleted}`, "1/0");
      const kept = await card();
      assertEqual(kept.authorNick, "Account eliminato");
      assertEqual(kept.authorUid, "deleted");
      assertEqual(kept.authorDeleted, true);
      assertEqual(kept.status, "active");
      for (const n of [1, 2])
        assertEqual(JSON.parse((await store.get(`cases/${code}/revisions/${n}`)).data.json).author, "", `revisione ${n}`);
      assertEqual((await store.get(`caseHashes/${kept.contentHash}`)).data.authorUid, "deleted");
      for (const path of ["authors/u1", `users/u1/published/${code}`]) assertEqual((await store.get(path)).exists, false, path);
      assertEqual(kept.stats.likes, 1, "i mi piace degli altri restano");
      // a reader deletes their account: their like, play, follow and reports go, and the counters follow
      await handlers.prepareAccountDeletion({ keepCases: false }, as("u2"));
      assertEqual((await card()).stats.likes, 0);
      assertEqual((await store.get(`cases/${code}/likes/u2`)).exists, false);
      assertEqual((await store.get(`cases/${code}/plays/u2`)).exists, false);
      assertEqual((await store.get("users/u2/following/u1")).exists, false);
    },
  },
  {
    name: "cancellare l'account, eliminando i casi: via tutto (casi, revisioni, impronte, pagina dell'autore, chi segue, segnalazioni fatte)",
    fn: async () => {
      const { handlers, code, as, store } = await environment();
      await handlers.reportCase({ code, reason: "spam" }, as("u3"));
      await handlers.followAuthor({ authorUid: "u1" }, as("u3"));
      const hash = (await store.get(`cases/${code}`)).data.contentHash;
      const out = await handlers.prepareAccountDeletion({ keepCases: false }, as("u1"));
      assertEqual(out.casesDeleted, 1);
      for (const path of [
        `cases/${code}`,
        `cases/${code}/revisions/1`,
        `caseHashes/${hash}`,
        "authors/u1",
        `users/u1/published/${code}`,
        `reports/${code}_u3`,
      ])
        assertEqual((await store.get(path)).exists, false, path);
      assertEqual(
        [...store.docs.keys()].filter((k) => k.startsWith("users/u1/") && !k.includes("achievements")).length,
        0,
        "niente rimasto sotto l'utente"
      );
      // the person who reported and followed deletes theirs too: the report is theirs to delete (already gone with the case)
      const later = await handlers.prepareAccountDeletion({ keepCases: false }, as("u3"));
      assertEqual(later.follows, 1);
      assertEqual((await rejected(handlers.prepareAccountDeletion({ keepCases: false }, null))).reason, "sign-in-required");
    },
  },
];
