import { findRedundantClues } from "../src/solver/redundancy.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { assert, assertEqual } from "./assert.js";

// 3x3, victim A + B. Zone "Studio" is the single cell (0,0); zone "Sala" the
// whole rest. Victim must share a room with exactly one person.
function build() {
  const p = createPuzzle("Redundancy");
  p.grid = resizeGrid(p.grid, 3, 3);
  const a = addCharacter(p, "A", "person1", true);
  const b = addCharacter(p, "B", "person2");
  const sala = addZone(p.grid, "Sala", "#eee");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) paintCellZone(p.grid, r, c, sala.id);
  return { p, a, b };
}

export const tests = [
  {
    name: "findRedundantClues: segnala un indizio duplicato come superfluo e uno essenziale no",
    fn: async () => {
      const { p, a, b } = build();
      const c1 = addClue(p, a.id, "inRowOrCol", { axis: "row", index: 1 });
      const c2 = addClue(p, a.id, "inRowOrCol", { axis: "row", index: 1 }); // duplicate of c1
      const c3 = addClue(p, b.id, "inRowOrCol", { axis: "col", index: 3 });
      const c4 = addClue(p, a.id, "inRowOrCol", { axis: "col", index: 1 });
      const c5 = addClue(p, b.id, "inRowOrCol", { axis: "row", index: 2 });
      const unique = checkUniqueness(p, { maxSolutions: 3 });
      assertEqual(unique.solutionCount, 1, "premessa del test: il caso deve avere soluzione unica");
      const result = await findRedundantClues(p, async (puzzle) => checkUniqueness(puzzle, { maxSolutions: 3 }));
      assert(result.ok);
      // c1/c2 are mutually redundant (either one alone is enough); the others constrain the grid.
      assert(result.redundant.includes(c1.id) && result.redundant.includes(c2.id), "i due duplicati sono ciascuno superfluo");
      assert(!result.redundant.includes(c3.id), "c3 è essenziale");
      assert(!result.redundant.includes(c4.id), "c4 è essenziale");
      assert(!result.redundant.includes(c5.id), "c5 è essenziale");
    },
  },
  {
    name: "findRedundantClues: con più controlli insieme il risultato è lo stesso di uno alla volta, anche se finiscono in ordine inverso",
    fn: async () => {
      const { p, a, b } = build();
      addClue(p, a.id, "inRowOrCol", { axis: "row", index: 1 });
      addClue(p, a.id, "inRowOrCol", { axis: "row", index: 1 }); // duplicate
      addClue(p, b.id, "inRowOrCol", { axis: "col", index: 3 });
      addClue(p, a.id, "inRowOrCol", { axis: "col", index: 1 });
      addClue(p, b.id, "inRowOrCol", { axis: "row", index: 2 });
      const check = async (puzzle) => checkUniqueness(puzzle, { maxSolutions: 3 });
      const one = await findRedundantClues(p, check);
      // the earlier the clue, the later its check ends: a result that followed the finishing order would come out reversed
      const slow = async (puzzle) => {
        const missing = p.clues.findIndex((c) => !puzzle.clues.some((x) => x.id === c.id));
        await new Promise((resolve) => setTimeout(resolve, missing < 0 ? 0 : (p.clues.length - missing) * 5));
        return check(puzzle);
      };
      for (const concurrency of [2, 3, 50]) {
        const many = await findRedundantClues(p, slow, { concurrency });
        assertEqual(
          many.redundant.join(),
          one.redundant.join(),
          `concurrency ${concurrency}: stessi indizi superflui, nello stesso ordine`
        );
        assertEqual(many.unchecked, one.unchecked);
      }
      assertEqual(one.redundant.length, 2, "premessa: i due duplicati");
    },
  },
  {
    name: "findRedundantClues: non fa più controlli insieme di `concurrency`, ognuno ha la sua corsia (mai due insieme sulla stessa) e l'avanzamento arriva al totale",
    fn: async () => {
      const { p } = build();
      p.clues = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, characterId: null, type: "x", params: {} }));
      let inFlight = 0;
      let peak = 0;
      const busy = new Set();
      let sharedLane = false;
      const check = async (_puzzle, { lane } = {}) => {
        if (lane !== undefined) {
          if (busy.has(lane)) sharedLane = true;
          busy.add(lane);
        }
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 8));
        inFlight--;
        busy.delete(lane);
        return { solutionCount: 1, truncated: false, exhausted: true };
      };
      for (const [concurrency, expectedPeak] of [
        [1, 1],
        [3, 3],
        [20, 7],
      ]) {
        peak = 0;
        const seen = [];
        const result = await findRedundantClues(p, check, { concurrency, onProgress: (done, total) => seen.push([done, total]) });
        assertEqual(peak, expectedPeak, `concurrency ${concurrency}: al massimo ${expectedPeak} insieme`);
        assertEqual(result.redundant.length, 7, "ogni controllo riuscito vale");
        assertEqual(JSON.stringify(seen[seen.length - 1]), "[7,7]", "l'avanzamento arriva al totale");
        assert(
          seen.every(([done], i) => i === 0 || done >= seen[i - 1][0]),
          "l'avanzamento non torna indietro"
        );
      }
      assertEqual(sharedLane, false, "due controlli insieme mai sulla stessa corsia");
    },
  },
  {
    name: "findRedundantClues: se un controllo fallisce (annullamento) non ne parte nessun altro e l'errore arriva a chi ha chiesto",
    fn: async () => {
      const { p } = build();
      p.clues = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, characterId: null, type: "x", params: {} }));
      let started = 0;
      const check = async () => {
        const n = ++started;
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (n === 4) throw new Error("annullato");
        return { solutionCount: 1, truncated: false, exhausted: true };
      };
      let error = null;
      try {
        await findRedundantClues(p, check, { concurrency: 3 });
      } catch (e) {
        error = e;
      }
      assertEqual(error?.message, "annullato");
      const atFailure = started;
      await new Promise((resolve) => setTimeout(resolve, 60));
      assertEqual(started, atFailure, "dopo il fallimento non parte nessun controllo nuovo");
      assert(started < 13, "e non si arriva in fondo alla lista");
    },
  },
  {
    name: "findRedundantClues: l'avanzamento tiene conto del controllo iniziale e di quanto è arrivato ogni controllo in corso, non torna indietro e finisce a 1",
    fn: async () => {
      const { p } = build();
      p.clues = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, characterId: null, type: "x", params: {} }));
      for (const concurrency of [1, 3]) {
        const seen = [];
        let inChecks = 0;
        const check = async (_puzzle, { onProgress: tell } = {}) => {
          tell?.(0.5); // half way through its own search
          await new Promise((resolve) => setTimeout(resolve, 6));
          tell?.(0.9);
          inChecks++;
          return { solutionCount: 1, truncated: false, exhausted: true };
        };
        await findRedundantClues(p, check, { concurrency, onProgress: (done, total, fraction) => seen.push({ done, total, fraction }) });
        const fractions = seen.map((s) => s.fraction);
        assert(
          fractions.every((f, i) => f >= 0 && f <= 1 && (i === 0 || f >= fractions[i - 1])),
          `concurrency ${concurrency}: tra 0 e 1 e mai all'indietro (${fractions.map((f) => f.toFixed(2))})`
        );
        assertEqual(fractions[fractions.length - 1], 1, "finisce a 1");
        assert(
          seen.some((s) => s.done === 2 && s.fraction > 2 / 7 && s.fraction < 1),
          "tra un controllo finito e l'altro la barra si muove da sola"
        );
        assertEqual(seen[seen.length - 1].done, 6);
        assertEqual(seen[seen.length - 1].total, 6);
        assertEqual(inChecks, 7, "il controllo iniziale e uno per indizio");
      }
    },
  },
  {
    name: "findRedundantClues: su un caso non univoco non analizza e spiega perché",
    fn: async () => {
      const { p } = build();
      const result = await findRedundantClues(p, async (puzzle) => checkUniqueness(puzzle, { maxSolutions: 3 }));
      assertEqual(result.ok, false);
      assertEqual(result.reason, "not-unique");
    },
  },
];
