import { createEffectiveSolution, murdererName } from "../src/player/effectiveSolution.js";
import { buildManualHintChain, chainDisclosesSomething, extendChainWithOracleStep } from "../src/player/hintLogic.js";
import { createPuzzle, addCharacter, setSolutionPlacement, addManualHintStep, updateManualHintStep } from "../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone } from "../src/model/grid.js";
import { assert, assertEqual } from "./assert.js";

// 3x3; zone "Sala" = column 0 and 1 (all rows), zone "Studio" = column 2.
function build() {
  const p = createPuzzle("Game logic");
  p.grid = resizeGrid(p.grid, 3, 3);
  const sala = addZone(p.grid, "Sala", "#eee");
  const studio = addZone(p.grid, "Studio", "#ddd");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) paintCellZone(p.grid, r, c, c < 2 ? sala.id : studio.id);
  const victim = addCharacter(p, "Vic", "person1", true);
  const killer = addCharacter(p, "Kil", "person2");
  const bystander = addCharacter(p, "Bys", "person3");
  setSolutionPlacement(p, victim.id, 0, 0);
  setSolutionPlacement(p, killer.id, 1, 1);
  setSolutionPlacement(p, bystander.id, 2, 2);
  return { p, victim, killer, bystander };
}

function deps(overrides = {}) {
  const calls = { derive: 0, unique: 0 };
  return {
    calls,
    deps: {
      validateSolution: () => ({ valid: true }),
      checkUniquenessAsync: async () => { calls.unique++; return { solutionCount: 1, truncated: false }; },
      deriveSolutionAsync: async () => { calls.derive++; return { status: "unique", placements: [] }; },
      ...overrides,
    },
  };
}

export const tests = [
  {
    name: "effectiveSolution: una soluzione dichiarata valida e provata unica viene usata così com'è",
    fn: async () => {
      const { p } = build();
      const { deps: d, calls } = deps();
      const result = await createEffectiveSolution(p, d).get();
      assertEqual(result.status, "unique");
      assertEqual(result.placements, p.solution.placements);
      assertEqual(calls.derive, 0, "nessuna derivazione necessaria");
    },
  },
  {
    name: "effectiveSolution: una soluzione dichiarata ma ambigua NON viene considerata la risposta",
    fn: async () => {
      const { p } = build();
      const { deps: d } = deps({ checkUniquenessAsync: async () => ({ solutionCount: 2, truncated: true }) });
      assertEqual((await createEffectiveSolution(p, d).get()).status, "ambiguous");
    },
  },
  {
    name: "effectiveSolution: se l'unicità non si decide col budget ridotto, passa alla derivazione completa",
    fn: async () => {
      const { p } = build();
      const { deps: d, calls } = deps({ checkUniquenessAsync: async () => ({ solutionCount: 1, truncated: true }) });
      await createEffectiveSolution(p, d).get();
      assertEqual(calls.derive, 1);
    },
  },
  {
    name: "effectiveSolution: una soluzione dichiarata non valida si deriva dagli indizi, senza fidarsi del file",
    fn: async () => {
      const { p } = build();
      const { deps: d, calls } = deps({ validateSolution: () => ({ valid: false }) });
      await createEffectiveSolution(p, d).get();
      assertEqual(calls.derive, 1);
      assertEqual(calls.unique, 0);
    },
  },
  {
    name: "effectiveSolution: due richieste ravvicinate condividono un solo calcolo",
    fn: async () => {
      const { p } = build();
      const { deps: d, calls } = deps();
      const eff = createEffectiveSolution(p, d);
      await Promise.all([eff.get(), eff.get()]);
      assertEqual(calls.unique, 1);
    },
  },
  {
    name: "effectiveSolution: un errore transitorio non resta memorizzato, il tentativo successivo riprova",
    fn: async () => {
      const { p } = build();
      let fail = true;
      const { deps: d } = deps({ checkUniquenessAsync: async () => { if (fail) throw new Error("worker"); return { solutionCount: 1, truncated: false }; } });
      const eff = createEffectiveSolution(p, d);
      let threw = false;
      try { await eff.get(); } catch { threw = true; }
      assert(threw, "il primo tentativo deve fallire");
      fail = false;
      assertEqual((await eff.get()).status, "unique");
    },
  },
  {
    name: "murdererName: nomina l'unico altro personaggio nella stanza della vittima, altrimenti null",
    fn: () => {
      const { p, killer } = build();
      const unique = { status: "unique", placements: p.solution.placements };
      assertEqual(murdererName(p, unique), "Kil");
      assertEqual(murdererName(p, { status: "ambiguous", placements: null }), null);
      // Bystander moved into the victim's room too -> two companions -> no single murderer.
      const crowded = { status: "unique", placements: p.solution.placements.map((pl) => (pl.characterId === killer.id ? pl : { ...pl, col: 1 })) };
      assertEqual(murdererName(p, crowded), null);
    },
  },
  {
    name: "hintLogic: una catena manuale sostituisce il motore; solo i passi evidenziati contano come suggerimento",
    fn: () => {
      const { p, victim } = build();
      assertEqual(buildManualHintChain(p), null, "senza passi manuali non c'è catena manuale");
      const note = addManualHintStep(p, "Solo testo");
      const hl = addManualHintStep(p, "Qui");
      updateManualHintStep(p, hl.id, { characterId: victim.id, row: 0, col: 0 });
      const chain = buildManualHintChain(p);
      assertEqual(chain[0].type, "manualNote");
      assertEqual(chain[1].type, "forcedPlacement");
      assert(chainDisclosesSomething(chain));
      assert(!chainDisclosesSomething([chain[0]]), "il solo testo è gratuito");
      assert(note.id !== hl.id);
    },
  },
  {
    name: "hintLogic: la catena 'troppo complessa' viene estesa di UN solo passo, mai con una soluzione non provata",
    fn: async () => {
      const { p } = build();
      const effective = { status: "unique", placements: p.solution.placements };
      const chain = [{ type: "tooComplex", variant: "warning", message: "x" }];
      await extendChainWithOracleStep(chain, { puzzle: p, placements: new Map(), getEffectiveSolution: async () => effective });
      assertEqual(chain.length, 2);
      assertEqual(chain[1].type, "forcedPlacement");
      assert(chain[1].viaDerivedSolution);
      assert(!p.characters.find((c) => c.id === chain[1].characterId).isVictim, "la vittima si rivela per ultima");

      const ambiguous = [{ type: "tooComplex", variant: "warning", message: "x" }];
      await extendChainWithOracleStep(ambiguous, { puzzle: p, placements: new Map(), getEffectiveSolution: async () => ({ status: "ambiguous", placements: null }) });
      assertEqual(ambiguous.length, 1, "nessuna rivelazione senza una risposta provata");

      const notStuck = [{ type: "forcedPlacement", variant: "success", characterId: "x", row: 0, col: 0, message: "" }];
      await extendChainWithOracleStep(notStuck, { puzzle: p, placements: new Map(), getEffectiveSolution: async () => effective });
      assertEqual(notStuck.length, 1, "si estende solo il caso 'bloccato'");
    },
  },
];
