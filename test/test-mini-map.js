// The little map on a gallery card (src/community/miniMap.js): drawn from what the server stored, which is checked first.
import { miniMapModel } from "../src/community/miniMap.js";
import { buildPreview } from "../src/community/casePolicy.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

const preview = { cells: "001" + "021" + "2-#", colors: ["#f4c2c2", "#c2e0f4", "#c9f4c2"] };

export const tests = [
  {
    name: "mini-mappa: una casella per posto, colori della pelle «carta», muri solo tra stanze diverse, grigi per vuote e bloccate",
    fn: () => {
      const model = miniMapModel(preview, 3, 3);
      assertEqual(model.cells.length, 9);
      assertEqual(model.cells[0].fill, "#d9715e", "la prima stanza rosa diventa terracotta come sul tavolo");
      assertEqual(model.cells[2].fill, "#8fa9c9");
      assertEqual(model.cells[7].fill, "#e6dfd0", "senza stanza");
      assertEqual(model.cells[8].fill, "#6b6358", "bloccata");
      // walls: between (0,1)-(0,2) and (0,0)-(1,0)? (0,0)=0 and (1,0)=0: no wall; (0,1)=0 and (1,1)=2: wall
      const has = (wall) => model.walls.some((w) => w.join() === wall.join());
      assert(has([2, 0, 2, 1]), "tra le caselle 0 e 1 della prima riga (stanze 0 e 1)");
      assert(has([1, 1, 2, 1]), "sotto la casella (0,1)");
      assert(!has([1, 0, 1, 1]), "stessa stanza: niente muro");
    },
  },
  {
    name: "mini-mappa: un'anteprima che non torna con la scheda (misure, lettere, colori, numero di stanze) non si disegna",
    fn: () => {
      assertEqual(miniMapModel(null, 3, 3), null);
      assertEqual(miniMapModel(preview, 3, 4), null, "misure diverse");
      assertEqual(miniMapModel({ ...preview, cells: "001021" }, 3, 3), null, "troppo corta");
      assertEqual(miniMapModel({ ...preview, cells: "009021" + "2-#" }, 3, 3), null, "una stanza che non esiste");
      assertEqual(miniMapModel({ ...preview, colors: ["red"] }, 3, 3), null, "un colore che non è un colore");
      assertEqual(miniMapModel({ ...preview, colors: ["#fff; background:url(x)", "#c2e0f4", "#c9f4c2"] }, 3, 3), null);
      assertEqual(miniMapModel({ cells: "0", colors: [] }, 1, 1), null);
      assertEqual(miniMapModel(preview, 0, 3), null);
      assertEqual(miniMapModel(preview, 3.5, 3), null);
      assertEqual(miniMapModel({ cells: "0".repeat(17 * 17), colors: ["#aabbcc"] }, 17, 17), null, "oltre 16x16");
      assertEqual(miniMapModel({ cells: 12345, colors: ["#aabbcc"] }, 1, 1), null);
    },
  },
  {
    name: "mini-mappa: quella che il server ricava da un caso vero si disegna tale e quale",
    fn: async () => {
      const puzzle = JSON.parse(await readRepoFile("test/fixtures/faro.en.murdoku.json"));
      const { rows, cols } = puzzle.grid.size;
      const model = miniMapModel(buildPreview(puzzle), rows, cols);
      assert(model, "si disegna");
      assertEqual(model.cells.length, rows * cols);
      assert(model.walls.length > 0, "ci sono stanze diverse, quindi muri");
    },
  },
];
