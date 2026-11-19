// What the gallery asks Firestore for (src/community/galleryQuery.js), and the indexes that go with it (firestore.indexes.json is
// generated from the same shapes: tools/make-indexes.mjs).
import {
  buildCaseQuery,
  normalizeSearch,
  indexesFor,
  indexesFile,
  allQueryShapes,
  PAGE_SIZE,
  SEARCH_MAX,
} from "../src/community/galleryQuery.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const text = (query) => JSON.stringify(query);

export const tests = [
  {
    name: "galleria: la query di default è «in galleria, dal più recente»; i filtri si aggiungono come uguaglianze",
    fn: () => {
      assertEqual(text(buildCaseQuery()), text({ where: [["inGallery", "==", true]], orderBy: ["createdAt", "desc"], limit: PAGE_SIZE }));
      const filtered = buildCaseQuery({ lang: "it", difficulty: "easy", sizeBand: "small", tag: "mistero" }, 5);
      assertEqual(filtered.limit, 5);
      assertEqual(
        text(filtered.where),
        text([
          ["inGallery", "==", true],
          ["lang", "==", "it"],
          ["difficulty", "==", "easy"],
          ["sizeBand", "==", "small"],
          ["tags", "array-contains", "mistero"],
        ])
      );
      assertEqual(text(buildCaseQuery({ sort: "title" }).orderBy), text(["titleLower", "asc"]));
      assertEqual(text(buildCaseQuery({ sort: "boh" }).orderBy), text(["createdAt", "desc"]), "un ordine sconosciuto si ignora");
    },
  },
  {
    name: "galleria: valori che la pagina non offre (lingua, difficoltà, tag inventati) non arrivano a Firestore",
    fn: () => {
      const query = buildCaseQuery({ lang: "xx", difficulty: "impossible", sizeBand: "huge", tag: "<script>", search: "   " });
      assertEqual(text(query.where), text([["inGallery", "==", true]]));
    },
  },
  {
    name: "galleria: la ricerca per titolo è un intervallo sul titolo in minuscolo, che diventa l'ordine; spazi e maiuscole non contano",
    fn: () => {
      assertEqual(normalizeSearch("  Il   FARO  "), "il faro");
      assertEqual(normalizeSearch(null), "");
      assertEqual(normalizeSearch("x".repeat(100)).length, SEARCH_MAX);
      const query = buildCaseQuery({ search: " Il Fa", lang: "it", sort: "new" });
      assertEqual(
        text(query.where),
        text([
          ["inGallery", "==", true],
          ["lang", "==", "it"],
          ["titleLower", ">=", "il fa"],
          ["titleLower", "<", "il fa"],
        ])
      );
      assertEqual(text(query.orderBy), text(["titleLower", "asc"]), "con la ricerca si ordina per titolo, qualunque sia l'ordine chiesto");
    },
  },
  {
    name: "galleria: i casi di un autore, «i miei» (anche fuori elenco) e «tutti» (amministratore) hanno la loro forma",
    fn: () => {
      const author = buildCaseQuery({ authorUid: "u1", lang: "it", search: "x" });
      assertEqual(
        text(author.where),
        text([
          ["inGallery", "==", true],
          ["authorUid", "==", "u1"],
        ]),
        "di un autore: solo l'autore, senza altri filtri"
      );
      assertEqual(text(author.orderBy), text(["createdAt", "desc"]));
      const mine = buildCaseQuery({ scope: "mine", uid: "me", lang: "it" });
      assertEqual(text(mine.where), text([["authorUid", "==", "me"]]), "i miei: non filtrano per inGallery");
      let threw = false;
      try {
        buildCaseQuery({ scope: "mine" });
      } catch {
        threw = true;
      }
      assert(threw, "«i miei» senza sapere chi sei non ha senso");
      assertEqual(text(buildCaseQuery({ scope: "all", lang: "it" }).where), text([]), "tutti: nessun filtro");
    },
  },
  {
    name: "indici: ogni forma di query possibile ha un indice (filtro, ordine) per ogni suo filtro di uguaglianza, e firestore.indexes.json è quello generato",
    fn: async () => {
      const generated = indexesFile();
      const onDisk = JSON.parse(await readRepoFile("firestore.indexes.json"));
      assertEqual(JSON.stringify(onDisk), JSON.stringify(generated), "rigenera con: npm run make:indexes");
      const have = new Set(onDisk.indexes.map((index) => index.fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig}`).join("|")));
      const label = ([name, how]) => `${name}:${how === "contains" ? "CONTAINS" : how === "desc" ? "DESCENDING" : "ASCENDING"}`;
      let checked = 0;
      for (const shape of allQueryShapes()) {
        for (const pair of indexesFor(shape)) {
          assert(have.has(pair.map(label).join("|")), `manca l'indice ${pair.map(label).join(" + ")}`);
          checked++;
        }
      }
      assert(checked > 1000, "le forme sono tutte controllate");
      assertEqual(onDisk.indexes.length, 26, "ventisei indici: 5 filtri x 5 ordini + i casi di un autore (e del feed)");
      assertEqual(
        onDisk.fieldOverrides
          .map((o) => o.collectionGroup)
          .sort()
          .join(),
        "likes,plays",
        "chi ha messo mi piace o giocato, per cancellare l'account"
      );
      // a few by hand, independent of the generator
      for (const wanted of [
        "inGallery:ASCENDING|createdAt:DESCENDING",
        "inGallery:ASCENDING|titleLower:ASCENDING",
        "lang:ASCENDING|createdAt:DESCENDING",
        "tags:CONTAINS|titleLower:ASCENDING",
        "authorUid:ASCENDING|createdAt:DESCENDING",
        "lang:ASCENDING|stats.likes:DESCENDING",
        "tags:CONTAINS|stats.opened:DESCENDING",
        "inGallery:ASCENDING|stats.solved:DESCENDING",
      ])
        assert(have.has(wanted), `manca ${wanted}`);
    },
  },
  {
    name: "galleria: ordini per più giocati, più apprezzati e più risolti; il feed degli autori seguiti (al massimo 30, in elenco, dal più recente)",
    fn: () => {
      assertEqual(text(buildCaseQuery({ sort: "played" }).orderBy), text(["stats.opened", "desc"]));
      assertEqual(text(buildCaseQuery({ sort: "liked" }).orderBy), text(["stats.likes", "desc"]));
      assertEqual(text(buildCaseQuery({ sort: "solved" }).orderBy), text(["stats.solved", "desc"]));
      const many = Array.from({ length: 40 }, (_, i) => `a${i}`);
      const feed = buildCaseQuery({ scope: "feed", authors: many, lang: "it" });
      assertEqual(text(feed.where[0]), text(["inGallery", "==", true]));
      assertEqual(feed.where[1][1], "in");
      assertEqual(feed.where[1][2].length, 30, "il tetto di Firestore per un `in`");
      assertEqual(text(feed.orderBy), text(["createdAt", "desc"]));
      assertEqual(feed.where.length, 2, "il feed non ha altri filtri");
      for (const bad of [undefined, [], [""], [null, 5]]) {
        let threw = false;
        try {
          buildCaseQuery({ scope: "feed", authors: bad });
        } catch {
          threw = true;
        }
        assert(threw, `senza autori non c'è un feed (${text(bad)})`);
      }
    },
  },
];
