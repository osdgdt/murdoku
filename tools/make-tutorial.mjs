// Builds the bundled tutorial cases (examples/tutorial.{it,en}.murdoku.json)
// through the real model API, and refuses to write them unless the solver
// confirms each has exactly one solution and the declared one satisfies it.
//   node tools/make-tutorial.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
globalThis.__MURDOKU_LANG__ = "it";
const { createPuzzle, addCharacter, addClue, setSolutionPlacement, addManualHintStep, updateManualHintStep } = await import("../src/model/puzzle.js");
const { resizeGrid, addZone, paintCellZone } = await import("../src/model/grid.js");
const { checkUniqueness, validateSolution } = await import("../src/solver/validator.js");

const TEXTS = {
  it: {
    title: "Tutorial: il primo caso", author: "Murdoku", kitchen: "Cucina", hall: "Salone",
    names: ["Anna", "Bruno", "Carla"],
    briefing: "Anna è stata trovata senza vita. Su una griglia ogni persona occupa una casella: mai due nella stessa riga o colonna. La vittima si trova sempre in una stanza con esattamente un'altra persona — ed è l'assassino. Leggi gli indizi, tocca una casella per segnare una nota e tieni premuto per piazzare il personaggio.",
    resolution: "Bruno era l'unico nella Cucina insieme ad Anna: è lui l'assassino. Ottimo lavoro, detective!",
    hints: [
      "Parti da Anna: è nella riga 1 e nella colonna 1. Una sola casella soddisfa entrambi gli indizi.",
      "Bruno è in Cucina ed è in diagonale rispetto ad Anna. La diagonale di (R1, C1) dentro la Cucina è una sola casella.",
      "Carla è nel Salone, nella colonna 4 e nella riga 3: ormai è l'ultima casella rimasta. Verifica la soluzione!",
    ],
  },
  en: {
    title: "Tutorial: your first case", author: "Murdoku", kitchen: "Kitchen", hall: "Hall",
    names: ["Alice", "Ben", "Clara"],
    briefing: "Alice has been found dead. On the grid every person takes one cell: never two in the same row or column. The victim is always in a room with exactly one other person — and that person is the murderer. Read the clues, tap a cell to jot a note, and press and hold to place the character.",
    resolution: "Ben was the only one in the Kitchen with Alice: he is the murderer. Well done, detective!",
    hints: [
      "Start with Alice: she is in row 1 and in column 1. Only one cell satisfies both clues.",
      "Ben is in the Kitchen and diagonal to Alice. The diagonal of (R1, C1) inside the Kitchen is a single cell.",
      "Clara is in the Hall, in column 4 and in row 3: it is the last cell left. Check your solution!",
    ],
  },
};

function build(lang) {
  const T = TEXTS[lang];
  const p = createPuzzle(T.title);
  p.id = `tutorial_${lang}`;
  p.author = T.author;
  p.difficulty = "very-easy";
  p.briefing = T.briefing;
  p.resolutionNote = T.resolution;
  p.createdAt = p.updatedAt = Date.UTC(2026, 0, 1);
  p.grid = resizeGrid(p.grid, 4, 4);
  const kitchen = addZone(p.grid, T.kitchen, "#f4c2c2");
  const hall = addZone(p.grid, T.hall, "#c2e0f4");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(p.grid, r, c, c < 2 ? kitchen.id : hall.id);
  const [anna, bruno, carla] = [
    addCharacter(p, T.names[0], "person1", true),
    addCharacter(p, T.names[1], "butler", false),
    addCharacter(p, T.names[2], "maid", false),
  ];
  addClue(p, anna.id, "inRowOrCol", { axis: "row", index: 1 });
  addClue(p, anna.id, "inRowOrCol", { axis: "col", index: 1 });
  addClue(p, bruno.id, "inRoom", { zoneId: kitchen.id });
  addClue(p, bruno.id, "diagonal", { targetId: anna.id });
  addClue(p, carla.id, "inRoom", { zoneId: hall.id });
  addClue(p, carla.id, "inRowOrCol", { axis: "col", index: 4 });
  addClue(p, carla.id, "inRowOrCol", { axis: "row", index: 3 });
  setSolutionPlacement(p, anna.id, 0, 0);
  setSolutionPlacement(p, bruno.id, 1, 1);
  setSolutionPlacement(p, carla.id, 2, 3);
  const highlights = [[anna, 0, 0], [bruno, 1, 1], [carla, 2, 3]];
  T.hints.forEach((message, i) => {
    const step = addManualHintStep(p, message);
    updateManualHintStep(p, step.id, { characterId: highlights[i][0].id, row: highlights[i][1], col: highlights[i][2] });
  });
  const report = checkUniqueness(p, { maxSolutions: 3 });
  if (report.solutionCount !== 1) throw new Error(`${lang}: expected a unique solution, found ${report.solutionCount}`);
  const check = validateSolution(p);
  if (!check.valid) throw new Error(`${lang}: declared solution invalid: ${check.violations.map((v) => v.message).join("; ")}`);
  return p;
}

for (const lang of ["it", "en"]) {
  const file = path.resolve(import.meta.dirname, `../examples/tutorial.${lang}.murdoku.json`);
  writeFileSync(file, JSON.stringify(build(lang), null, 2) + "\n");
  console.log("scritto", path.relative(process.cwd(), file));
}
