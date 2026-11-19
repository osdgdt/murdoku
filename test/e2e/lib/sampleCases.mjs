// A few cards of the shared case database as the server stores them (functions/src/handlers.js), for the browser tests that
// show the list without publishing anything first: the fake Firestore's documents, by path (see fakeFirebase.mjs).
const COLORS = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2", "#c2f4e8", "#e8e8e8"];

// A rooms map of rows x cols: horizontal bands, split in two columns, as the cards' mini-maps show it.
function preview(rows, cols, rooms) {
  const symbols = "0123456789abcdefghijklmnopqrstuvwxyz";
  let cells = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells += symbols[(Math.floor((r * Math.ceil(rooms / 2)) / rows) * 2 + (c < cols / 2 ? 0 : 1)) % rooms];
  return { cells, colors: COLORS.slice(0, rooms) };
}

const card = (code, over) => ({
  titleLower: over.title.toLowerCase(),
  blurb: "",
  lang: "it",
  tags: [],
  license: "cc-by",
  revision: 1,
  authorUid: "uid-author",
  status: "active",
  listed: true,
  inGallery: true,
  createdAt: "2026-11-19T10:00:00.000Z",
  updatedAt: "2026-11-19T10:00:00.000Z",
  ...over,
  code,
});

export function sampleCases() {
  const cards = [
    card("ACDEFGHJ", {
      title: "Il faro nella tempesta",
      blurb: "Una notte di tempesta al faro: chi ha spento la luce?",
      difficulty: "easy",
      tags: ["mistero", "moderno"],
      rows: 5,
      cols: 5,
      characters: 5,
      clues: 6,
      sizeBand: "small",
      authorNick: "Maigret",
      preview: preview(5, 5, 4),
      createdAt: "2026-11-19T12:00:00.000Z",
    }),
    card("KMNPQRTU", {
      title: "The Orient Mystery",
      blurb: "A night train, a locked compartment and eight passengers who all had a reason.",
      lang: "en",
      difficulty: "medium",
      license: "play-only",
      tags: ["storico"],
      rows: 7,
      cols: 7,
      characters: 7,
      clues: 12,
      sizeBand: "medium",
      authorNick: "Poirot",
      authorUid: "uid-other",
      preview: preview(7, 7, 6),
      createdAt: "2026-11-19T11:00:00.000Z",
    }),
    card("VWXY3466", {
      title: "Cena al castello",
      blurb: "Il re è morto, la cena è servita e nessuno ricorda di essere uscito dalla sala del trono.",
      difficulty: "hard",
      tags: ["medievale", "mistero", "horror"],
      rows: 9,
      cols: 9,
      characters: 9,
      clues: 21,
      sizeBand: "large",
      authorNick: "Il Re Mago",
      authorUid: "uid-third",
      preview: preview(9, 9, 8),
      createdAt: "2026-11-19T10:30:00.000Z",
    }),
    card("CDEFGHJK", {
      title: "Un caso con un titolo lunghissimo che deve andare a capo senza rompere la scheda né la pagina intera",
      blurb: "Senza anteprima della mappa (più di trentasei stanze non ci stanno).",
      difficulty: "expert",
      rows: 6,
      cols: 6,
      characters: 6,
      clues: 1,
      sizeBand: "medium",
      authorNick: "Anonimo",
      authorUid: "uid-fourth",
      preview: null,
      createdAt: "2026-11-19T09:00:00.000Z",
    }),
  ];
  return Object.fromEntries(cards.map(({ code, ...rest }) => [`cases/${code}`, rest]));
}
