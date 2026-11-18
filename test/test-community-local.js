// What the browser remembers about shared cases (src/community/localRegistry.js), "Duplica" of a case that came from
// the database (src/community/remix.js), and the words of the refusals (src/community/messages.js).
import * as registry from "../src/community/localRegistry.js";
import { duplicateCase } from "../src/community/remix.js";
import { describeReason, describeMetaErrors, describePuzzleErrors } from "../src/community/messages.js";
import { sharedPuzzleId } from "../src/community/casePolicy.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const CODE = "ACDEFGHJ";
const faro = async () => JSON.parse(await readRepoFile("test/fixtures/faro.en.murdoku.json"));

export const tests = [
  {
    name: "archivio locale: il lato dell'autore (caso → codice, revisione) e quello del lettore (copie degli altri)",
    fn: () => {
      assertEqual(registry.getPublished("p1"), null);
      assert(registry.setPublished("p1", { code: CODE, revision: 1, license: "cc-by", title: "T", publishedAt: 5 }), "scrittura ok");
      assertEqual(registry.getPublished("p1").code, CODE);
      assertEqual(registry.getPublished("altro"), null);
      registry.removePublished("p1");
      assertEqual(registry.getPublished("p1"), null);

      assertEqual(registry.getShared(CODE), null);
      registry.setShared(CODE, { code: CODE, revision: 2, authorNick: "Maigret", license: "play-only", title: "T", savedAt: 1 });
      assertEqual(registry.getShared(CODE).revision, 2);
      assertEqual(registry.getShared("non un codice"), null, "un codice che non è un codice non cerca nulla");
      assertEqual(registry.listShared().length, 1);
      registry.removeShared(CODE);
      assertEqual(registry.listShared().length, 0);
    },
  },
  {
    name: "archivio locale: dati rovinati o di forma sbagliata non rompono nulla",
    fn: () => {
      localStorage.setItem("murdoku:community:published", "{non json");
      assertEqual(registry.getPublished("p1"), null);
      localStorage.setItem("murdoku:community:shared", JSON.stringify([1, 2, 3]));
      assertEqual(registry.getShared(CODE), null);
      assert(registry.setShared(CODE, { code: CODE, revision: 1 }), "si riparte da zero");
      assertEqual(registry.getShared(CODE).revision, 1);
    },
  },
  {
    name: "Duplica: un caso proprio si duplica come sempre; uno condiviso solo se l'autore consente il remix, e il remix ricorda l'origine",
    fn: async () => {
      const own = await faro();
      own.id = "mio";
      const plain = duplicateCase(own);
      assert(plain.ok && plain.copy.id !== "mio" && !plain.copy.community, "copia normale, senza traccia di remix");

      const shared = await faro();
      shared.id = sharedPuzzleId(CODE);
      // nessuna memoria della licenza (dati del browser cancellati): la risposta prudente
      assertEqual(duplicateCase(shared).ok, false);
      registry.setShared(CODE, { code: CODE, revision: 1, authorNick: "Maigret", license: "play-only" });
      assertEqual(duplicateCase(shared).ok, false, "solo da giocare: niente copia");
      registry.setShared(CODE, { code: CODE, revision: 1, authorNick: "Maigret", license: "cc-by" });
      const remix = duplicateCase(shared);
      assert(remix.ok, "remix consentito");
      assert(remix.copy.id !== shared.id && !remix.copy.id.startsWith("shared_"), "è un caso nuovo, non una copia condivisa");
      assertEqual(remix.copy.community.remixOf.code, CODE);
      assertEqual(remix.copy.community.remixOf.nick, "Maigret");
      // il remix di un remix tiene l'origine
      assertEqual(duplicateCase(remix.copy).copy.community.remixOf.code, CODE);
    },
  },
  {
    name: "messaggi: ogni motivo di rifiuto del server ha una frase sua (nessuno finisce nel «qualcosa è andato storto»)",
    fn: async () => {
      const source = await readRepoFile("functions/src/handlers.js");
      const reasons = new Set([...source.matchAll(/fail\(\s*"[a-z-]+",\s*"([a-z-]+)"/g)].map((m) => m[1]));
      for (const reason of ["network", "not-available", "no-such-case", "bad-body"]) reasons.add(reason);
      const generic = describeReason("???");
      assert(reasons.size >= 18, `trovati ${reasons.size} motivi`);
      for (const reason of reasons) {
        if (reason === "no-free-code") continue; // a freak: the generic sentence is the right one
        assert(describeReason(reason, { max: 5, code: "X" }) !== generic, `«${reason}» deve avere una frase`);
      }
      assert(describeReason("duplicate", { yours: true, code: "ACDEFGHJ" }).includes("ACDEFGHJ"), "il duplicato proprio dice il codice");
      assert(
        describeReason("duplicate", { yours: false }) !== describeReason("duplicate", { yours: true, code: "X" }),
        "due frasi diverse"
      );
    },
  },
  {
    name: "messaggi: errori dei campi e del caso, una frase per campo",
    fn: () => {
      const fields = describeMetaErrors([
        { field: "title", code: "too-short" },
        { field: "title", code: "too-long" },
        { field: "license", code: "invalid" },
      ]);
      assertEqual(fields.length, 2, "una frase per campo");
      assert(
        fields.every((f) => f.text.length > 10),
        "frasi vere"
      );
      const puzzle = describePuzzleErrors([
        { code: "no-clues" },
        { code: "incomplete-solution" },
        { code: "text-too-long", detail: "briefing" },
        { code: "boh" },
      ]);
      assertEqual(puzzle.length, 4);
      assert(puzzle[2].includes("briefing"), "dice quale testo");
    },
  },
];
