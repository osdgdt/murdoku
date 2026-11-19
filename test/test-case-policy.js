// The rules of the shared case database (src/community/casePolicy.js): codes, metadata, what may be published, the
// fingerprint of a case.
import {
  LIMITS,
  CODE_SYMBOLS,
  CODE_LENGTH,
  isCaseCode,
  normalizeCode,
  generateCode,
  formatCode,
  sharedPuzzleId,
  isSharedPuzzleId,
  validatePublishMeta,
  validatePuzzleForPublish,
  preparePuzzleForPublish,
  contentHash,
  serializeBody,
  summarizePuzzle,
  buildPreview,
  inGallery,
  caseLink,
} from "../src/community/casePolicy.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const load = async (name) => JSON.parse(await readRepoFile(`test/fixtures/${name}.murdoku.json`));
const goodMeta = {
  title: "  Il faro  nella tempesta ",
  blurb: "Un caso breve.",
  lang: "it",
  difficulty: "medium",
  license: "cc-by",
  tags: ["mistero"],
};
const codes = (result) =>
  result.errors
    .map((e) => `${e.field}:${e.code}`)
    .sort()
    .join();

export const tests = [
  {
    name: "codice: 8 caratteri da un alfabeto senza simboli che si confondono; generato, riconosciuto, ripulito e mostrato",
    fn: () => {
      for (const ambiguous of "01258BIOLSZ") assert(!CODE_SYMBOLS.includes(ambiguous), `«${ambiguous}» non deve esserci`);
      assertEqual(CODE_SYMBOLS.length, 23);
      assertEqual(CODE_LENGTH, 8);
      const code = generateCode((n) => n - 1); // the last symbol every time
      assertEqual(code, CODE_SYMBOLS[22].repeat(8));
      assertEqual(
        generateCode(() => 0),
        CODE_SYMBOLS[0].repeat(8)
      );
      let seen = 0;
      const mixed = generateCode(() => seen++ % 23);
      assert(isCaseCode(mixed), "un codice generato è valido");
      assert(isCaseCode("ACDE-FGHJ".replace("-", "")), "valido");
      for (const bad of ["ACDEFGH", "ACDEFGHJK", "acdefghj", "ACDEFGH0", "ACDEFGHO", "ACDE FGH", "", null, undefined, 12345678])
        assert(!isCaseCode(bad), `«${bad}» non è un codice`);
      assertEqual(normalizeCode(" acde-fghj "), "ACDEFGHJ");
      assertEqual(normalizeCode("acde fghj"), "ACDEFGHJ");
      assertEqual(normalizeCode(null), "");
      assertEqual(formatCode("ACDEFGHJ"), "ACDE-FGHJ");
      assertEqual(sharedPuzzleId("ACDEFGHJ"), "shared_ACDEFGHJ");
      assert(isSharedPuzzleId("shared_ACDEFGHJ") && !isSharedPuzzleId("puzzle_x") && !isSharedPuzzleId(null));
    },
  },
  {
    name: "metadati: titolo e descrizione ripuliti, lingua/difficoltà/licenza/tag controllati; ogni errore ha il suo codice",
    fn: () => {
      const ok = validatePublishMeta(goodMeta);
      assertEqual(ok.ok, true);
      assertEqual(ok.meta.title, "Il faro nella tempesta", "spazi ridotti");
      assertEqual(ok.meta.titleLower, "il faro nella tempesta");
      assertEqual(ok.meta.tags.join(), "mistero");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, title: "ab" })), "title:too-short");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, title: "x".repeat(LIMITS.titleMax + 1) })), "title:too-long");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, blurb: "   " })), "blurb:too-short");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, blurb: "x".repeat(LIMITS.blurbMax + 1) })), "blurb:too-long");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, lang: "fr" })), "lang:invalid");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, difficulty: "" })), "difficulty:invalid");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, difficulty: "impossible" })), "difficulty:invalid");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, license: "all-rights" })), "license:invalid");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, tags: ["mistero", "horror", "storico", "moderno"] })), "tags:too-many");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, tags: ["inventato"] })), "tags:invalid");
      assertEqual(validatePublishMeta({ ...goodMeta, tags: ["mistero", "mistero"] }).meta.tags.length, 1, "doppioni tolti");
      assertEqual(validatePublishMeta({ ...goodMeta, tags: undefined }).meta.tags.length, 0, "i tag sono facoltativi");
      assertEqual(validatePublishMeta(null).ok, false);
      const control = validatePublishMeta({ ...goodMeta, title: "Ti\u0000tolo\u0007 valido" });
      assertEqual(control.meta.title, "Titolo valido", "caratteri di controllo tolti");
    },
  },
  {
    name: "pubblicabilità: un caso completo passa; senza indizi, senza soluzione completa, con testi troppo lunghi o forma errata no",
    fn: async () => {
      for (const name of ["faro.en", "tutorial.en", "monastero.en"]) {
        const result = validatePuzzleForPublish(await load(name));
        assert(result.ok, `${name} deve poter essere pubblicato: ${JSON.stringify(result.errors)}`);
      }
      const base = await load("faro.en");
      const noClues = { ...base, clues: [] };
      assertEqual(codes({ errors: validatePuzzleForPublish(noClues).errors.map((e) => ({ field: "x", code: e.code })) }), "x:no-clues");
      const half = JSON.parse(JSON.stringify(base));
      half.solution.placements = half.solution.placements.slice(1);
      assertEqual(validatePuzzleForPublish(half).errors[0].code, "incomplete-solution");
      const wordy = JSON.parse(JSON.stringify(base));
      wordy.briefing = "x".repeat(LIMITS.textMax + 1);
      wordy.characters[0].bio = "y".repeat(LIMITS.bioMax + 1);
      wordy.characters[1].name = "z".repeat(LIMITS.nameMax + 1);
      wordy.grid.zones[0].name = "w".repeat(LIMITS.nameMax + 1);
      const details = validatePuzzleForPublish(wordy)
        .errors.map((e) => e.detail)
        .sort()
        .join();
      assertEqual(details, "briefing,character bio,character name,room name");
      const broken = JSON.parse(JSON.stringify(base));
      broken.grid.size.rows = 40;
      assertEqual(validatePuzzleForPublish(broken).errors[0].code, "shape");
      const hostile = JSON.parse(JSON.stringify(base));
      hostile.characters[0].color = "red;background:url(x)";
      assertEqual(validatePuzzleForPublish(hostile).errors[0].code, "shape", "i controlli di sicurezza dell'app valgono anche qui");
      assertEqual(validatePuzzleForPublish(null).errors[0].code, "not-an-object");
      assertEqual(validatePuzzleForPublish("testo").errors[0].code, "not-an-object");
      const untouched = JSON.stringify(base);
      validatePuzzleForPublish(base);
      assertEqual(JSON.stringify(base), untouched, "il caso dell'autore non viene toccato");
    },
  },
  {
    name: "preparazione: toglie lo stato di chi l'ha scritto (tempo, risolto), dà l'id comune a tutti e mette titolo, autore e difficoltà scelti",
    fn: async () => {
      const own = await load("faro.en");
      own.completed = true;
      own.bestTimeSeconds = 123;
      own.community = { code: "ACDEFGHJ" };
      const before = JSON.stringify(own);
      const out = preparePuzzleForPublish(own, "ACDEFGHJ", { author: "Gianna", title: "Titolo nuovo", difficulty: "hard" });
      assertEqual(JSON.stringify(own), before, "l'originale non cambia");
      assertEqual(out.id, "shared_ACDEFGHJ");
      assertEqual(out.author, "Gianna");
      assertEqual(out.title, "Titolo nuovo");
      assertEqual(out.difficulty, "hard");
      assertEqual(out.completed, false);
      assertEqual(out.bestTimeSeconds, null);
      assert(!("community" in out), "nessun riferimento locale alla pubblicazione");
      assertEqual(out.clues.length, own.clues.length, "il contenuto resta");
      const plain = preparePuzzleForPublish(own, "ACDEFGHJ");
      assertEqual(plain.title, own.title, "senza titolo scelto resta quello del caso");
    },
  },
  {
    name: "impronta: uguale per lo stesso caso con id, titolo, autore e testi diversi; diversa se cambiano mappa, personaggi, indizi o soluzione",
    fn: async () => {
      const a = await load("faro.en");
      const hash = await contentHash(a);
      assert(/^[0-9a-f]{64}$/.test(hash), "SHA-256 in esadecimale");
      assertEqual(await contentHash(a), hash, "stabile");

      // the same case saved by someone else: other ids, other title, other texts
      const b = JSON.parse(JSON.stringify(a));
      const renames = new Map();
      const rename = (id) => {
        if (!renames.has(id)) renames.set(id, `${id}_copia`);
        return renames.get(id);
      };
      let text = JSON.stringify(b);
      const ids = [
        ...b.characters.map((c) => c.id),
        ...b.grid.zones.map((z) => z.id),
        ...b.grid.objects.map((o) => o.id),
        ...b.clues.map((c) => c.id),
      ];
      for (const id of ids) text = text.split(`"${id}"`).join(`"${rename(id)}"`);
      const c = JSON.parse(text);
      c.id = "puzzle_altro";
      c.title = "Un altro titolo";
      c.author = "Chiunque";
      c.briefing = "Un'altra introduzione";
      c.characters[0].bio = "Un'altra biografia";
      c.createdAt = 1;
      c.completed = true;
      assertEqual(await contentHash(c), hash, "stesso caso, id e testi diversi");

      const moved = JSON.parse(JSON.stringify(a));
      moved.solution.placements[0].row = (moved.solution.placements[0].row + 1) % moved.grid.size.rows;
      assert((await contentHash(moved)) !== hash, "un'altra soluzione è un altro caso");
      const fewer = JSON.parse(JSON.stringify(a));
      fewer.clues.pop();
      assert((await contentHash(fewer)) !== hash, "un indizio in meno è un altro caso");
      const renamedCharacter = JSON.parse(JSON.stringify(a));
      renamedCharacter.characters[0].name += "x";
      assert((await contentHash(renamedCharacter)) !== hash, "un altro nome di personaggio è un altro caso");
      const otherRoom = JSON.parse(JSON.stringify(a));
      otherRoom.grid.zones[0].name += "x";
      assert((await contentHash(otherRoom)) !== hash, "un'altra stanza è un altro caso");
      assert((await contentHash(await load("tutorial.en"))) !== hash, "casi diversi, impronte diverse");
    },
  },
  {
    name: "corpo e riepilogo: dimensione in byte del testo pubblicato, fascia di dimensione per la galleria, link da condividere",
    fn: async () => {
      const puzzle = await load("faro.en");
      const body = serializeBody(puzzle);
      assertEqual(body.json, JSON.stringify(puzzle));
      assertEqual(body.bytes, new TextEncoder().encode(body.json).length);
      assert(body.bytes < LIMITS.bodyMaxBytes, "un caso vero sta nel tetto");
      assertEqual(serializeBody({ t: "è" }).bytes, 10, "i byte, non i caratteri");
      const summary = summarizePuzzle(puzzle);
      assertEqual(summary.rows, puzzle.grid.size.rows);
      assertEqual(summary.characters, puzzle.characters.length);
      assertEqual(summary.clues, puzzle.clues.length);
      const sized = (n) => summarizePuzzle({ grid: { size: { rows: n, cols: n } }, characters: [], clues: [] }).sizeBand;
      assertEqual(sized(4), "small");
      assertEqual(sized(5), "small");
      assertEqual(sized(6), "medium");
      assertEqual(sized(8), "medium");
      assertEqual(sized(9), "large");
      assertEqual(
        caseLink("ACDEFGHJ", "https://esempio.github.io/murdoku/editor.html"),
        "https://esempio.github.io/murdoku/player.html?c=ACDEFGHJ"
      );
    },
  },
  {
    name: "visibilità: di default un caso è in elenco; `listed` deve essere vero o falso; in galleria solo un caso attivo e in elenco",
    fn: () => {
      assertEqual(validatePublishMeta(goodMeta).meta.listed, true);
      assertEqual(validatePublishMeta({ ...goodMeta, listed: false }).meta.listed, false);
      assertEqual(validatePublishMeta({ ...goodMeta, listed: true }).meta.listed, true);
      assertEqual(codes(validatePublishMeta({ ...goodMeta, listed: "no" })), "listed:invalid");
      assertEqual(codes(validatePublishMeta({ ...goodMeta, listed: 0 })), "listed:invalid");
      assertEqual(inGallery("active", true), true);
      assertEqual(inGallery("active", undefined), true, "una scheda di prima della galleria è in elenco");
      assertEqual(inGallery("active", false), false);
      for (const status of ["withdrawn", "hidden"]) assertEqual(inGallery(status, true), false, status);
    },
  },
  {
    name: "mini-mappa: una lettera per casella (stanza in base 36, «-» senza stanza, «#» bloccata) e i colori delle stanze; niente altro",
    fn: async () => {
      const puzzle = await load("faro.en");
      const preview = buildPreview(puzzle);
      const { rows, cols } = puzzle.grid.size;
      assertEqual(preview.cells.length, rows * cols);
      assertEqual(preview.colors.length, puzzle.grid.zones.length);
      assert(preview.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)));
      assertEqual(summarizePuzzle(puzzle).preview.cells, preview.cells, "la scheda la porta");
      // the first cell's room is the room it says
      const first = puzzle.grid.cells[0][0];
      assertEqual(
        preview.cells[0],
        first.zoneId ? "0123456789abcdefghijklmnopqrstuvwxyz"[puzzle.grid.zones.findIndex((z) => z.id === first.zoneId)] : "-"
      );
      // blocked cells, cells with no room, an unsafe colour
      const odd = JSON.parse(JSON.stringify(puzzle));
      odd.grid.cells[0][0] = { zoneId: null, objectId: null, blocked: true };
      odd.grid.cells[0][1] = { zoneId: null, objectId: null, blocked: false };
      odd.grid.zones[0].color = "red; background:url(x)";
      const out = buildPreview(odd);
      assertEqual(out.cells.slice(0, 2), "#-");
      assertEqual(out.colors[0], "#c9c0b0", "un colore strano diventa un grigio");
      // no rooms at all, or too many: no preview
      const none = JSON.parse(JSON.stringify(puzzle));
      none.grid.zones = [];
      assertEqual(buildPreview(none), null);
      const many = JSON.parse(JSON.stringify(puzzle));
      many.grid.zones = Array.from({ length: 37 }, (_, i) => ({ id: `z${i}`, name: `z${i}`, color: "#aabbcc" }));
      assertEqual(buildPreview(many), null);
      assertEqual(buildPreview(null), null);
    },
  },
];
