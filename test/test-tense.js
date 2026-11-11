import { setLanguageForSession } from "../src/i18n/i18n.js";
import { conjugate, TENSES } from "../src/i18n/tense.js";
import { CLUE_TYPES, describeClue } from "../src/model/clueTypes.js";
import { createPuzzle, addCharacter, addClue, setTense, validatePuzzleShape, clonePuzzle } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid } from "../src/model/grid.js";
import { migratePuzzle, CURRENT_SCHEMA_VERSION } from "../src/model/migrations.js";
import { assert, assertEqual } from "./assert.js";

// A present-tense verb left over in a sentence that should be past/future.
const ITALIAN_PRESENT = /(^|[^\p{L}])(è|sono|hanno|condivide|verifica|si trova|si trovano|c'è)(?![\p{L}])/iu;
const ENGLISH_PRESENT = /\b(is|are|has|stands|sits|shares|satisfies|holds|do not|does not)\b|(?<!(will|did) (not )?)\bhave\b/i;

function sampleParams(def, ids) {
  const params = {};
  for (const p of def.params || []) {
    switch (p.kind) {
      case "characterOrObject": case "character": params[p.name] = ids.other; break;
      case "characterOrObjectMulti": params[p.name] = [ids.other, ids.obj]; break;
      case "zone": params[p.name] = ids.zone; break;
      case "number": params[p.name] = 2; break;
      case "enum": params[p.name] = p.values.find((v) => v !== "") ?? ""; break;
      case "clueRef": params[p.name] = { type: "inCorner", params: {} }; break;
      default: break;
    }
  }
  return params;
}

function samplePuzzle() {
  const puzzle = createPuzzle("Sample");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const a = addCharacter(puzzle, "Anna", "person1", true);
  const b = addCharacter(puzzle, "Bruno", "person2");
  const zone = addZone(puzzle.grid, "Kitchen", "#fff");
  const obj = placeObject(puzzle.grid, "chair", 0, 0);
  return { puzzle, ids: { owner: a.id, other: b.id, zone: zone.id, obj: obj.id } };
}

function everyClue(ids) {
  const clues = [];
  for (const [type, def] of Object.entries(CLUE_TYPES)) {
    if (def.internal) continue;
    const clue = { id: "c", type, characterId: def.scope === "generic" ? null : ids.owner, params: sampleParams(def, ids), negate: false };
    if (type === "orClue") clue.params = { a: { type: "inCorner", params: {} }, b: { type: "adjacent", params: { targetId: ids.other } } };
    for (const negate of [false, true]) clues.push({ ...clue, negate });
  }
  return clues;
}

export const tests = [
  {
    name: "tense: conjugate() porta le frasi italiane al passato (imperfetto) e al futuro, mantenendo le maiuscole",
    fn: () => {
      assertEqual(conjugate("È accanto a {v}.", "it", "past"), "Era accanto a {v}.");
      assertEqual(conjugate("È accanto a {v}.", "it", "future"), "Sarà accanto a {v}.");
      assertEqual(conjugate("Si trova nella stanza {v}.", "it", "past"), "Si trovava nella stanza {v}.");
      assertEqual(conjugate("{v} e {v2} si trovano nella stessa stanza.", "it", "future"), "{v} e {v2} si troveranno nella stessa stanza.");
      assertEqual(conjugate("C'è qualcuno a nord.", "it", "past"), "C'era qualcuno a nord.");
      assertEqual(conjugate("C'è qualcuno a nord.", "it", "future"), "Ci sarà qualcuno a nord.");
      assertEqual(conjugate("Condivide la riga con {t}.", "it", "past"), "Condivideva la riga con {t}.");
      assertEqual(conjugate("È accanto a {v}.", "it", "present"), "È accanto a {v}.");
    },
  },
  {
    name: "tense: conjugate() porta le frasi inglesi al passato e al futuro in un solo passaggio",
    fn: () => {
      assertEqual(conjugate("Is next to {v}.", "en", "past"), "Was next to {v}.");
      assertEqual(conjugate("Is next to {v}.", "en", "future"), "Will be next to {v}.");
      assertEqual(conjugate("Stands on {v}.", "en", "past"), "Stood on {v}.");
      assertEqual(conjugate("Shares the row with {t}.", "en", "future"), "Will share the row with {t}.");
      assertEqual(conjugate("{a} and {b} are not in the same room.", "en", "past"), "{a} and {b} were not in the same room.");
      assertEqual(conjugate("Has the same size.", "en", "future"), "Will have the same size.", "'has' -> 'will have' non deve diventare 'will will have'");
      assertEqual(conjugate("Exactly one person is next to {v}.", "en", "past"), "Exactly one person was next to {v}.");
    },
  },
  {
    name: "tense: nomi e numeri scritti dall'autore non vengono mai coniugati",
    fn: () => {
      const { puzzle, ids } = samplePuzzle();
      puzzle.characters[1].name = "È sono hanno";
      puzzle.tense = "past";
      const clue = { id: "c", type: "adjacent", characterId: ids.owner, params: { targetId: ids.other } };
      assertEqual(describeClue(clue, puzzle), "Era accanto a È sono hanno.");
    },
  },
  {
    name: "tense: un caso senza tempo (o con tempo sconosciuto) parla al presente",
    fn: () => {
      const { puzzle, ids } = samplePuzzle();
      const clue = { id: "c", type: "adjacent", characterId: ids.owner, params: { targetId: ids.other } };
      assertEqual(describeClue(clue, puzzle), "È accanto a Bruno.");
      delete puzzle.tense;
      assertEqual(describeClue(clue, puzzle), "È accanto a Bruno.");
      puzzle.tense = "boh";
      assertEqual(describeClue(clue, puzzle), "È accanto a Bruno.");
    },
  },
  {
    name: "tense: la negazione segue il tempo (Non era…, Non sarà…) e il tempo non resta 'attaccato' alle altre stringhe",
    fn: () => {
      const { puzzle, ids } = samplePuzzle();
      const clue = { id: "c", type: "adjacent", characterId: ids.owner, params: { targetId: ids.other }, negate: true };
      setTense(puzzle, "past");
      assertEqual(describeClue(clue, puzzle), "Non era accanto a Bruno.");
      setTense(puzzle, "future");
      assertEqual(describeClue(clue, puzzle), "Non sarà accanto a Bruno.");
      setTense(puzzle, "present");
      assertEqual(describeClue(clue, puzzle), "Non è accanto a Bruno.");
    },
  },
  {
    name: "tense: ogni tipo di indizio, negato e non, esce senza verbi al presente se il caso è al passato o al futuro (italiano)",
    fn: () => {
      const { puzzle, ids } = samplePuzzle();
      const leaks = [];
      for (const tense of ["past", "future"]) {
        puzzle.tense = tense;
        for (const clue of everyClue(ids)) {
          const text = describeClue(clue, puzzle);
          if (ITALIAN_PRESENT.test(text)) leaks.push(`${tense} ${clue.type}${clue.negate ? " (no)" : ""}: ${text}`);
        }
      }
      assertEqual(leaks.length, 0, "verbi al presente:\n" + leaks.join("\n"));
    },
  },
  {
    name: "tense: ogni tipo di indizio cambia davvero frase al passato e al futuro (italiano)",
    fn: () => {
      const { puzzle, ids } = samplePuzzle();
      const same = [];
      for (const clue of everyClue(ids)) {
        puzzle.tense = "present";
        const present = describeClue(clue, puzzle);
        for (const tense of ["past", "future"]) {
          puzzle.tense = tense;
          if (describeClue(clue, puzzle) === present) same.push(`${tense} ${clue.type}: ${present}`);
        }
      }
      assertEqual(same.length, 0, "frasi che non cambiano:\n" + same.join("\n"));
    },
  },
  {
    name: "tense: lo stesso vale in inglese, senza verbi al presente né frammenti rimasti",
    fn: async () => {
      const { puzzle, ids } = samplePuzzle();
      await setLanguageForSession("en");
      try {
        const leaks = [];
        for (const tense of ["past", "future"]) {
          puzzle.tense = tense;
          for (const clue of everyClue(ids)) {
            const text = describeClue(clue, puzzle);
            // "It is not true that…" fallback must follow the tense too.
            if (ENGLISH_PRESENT.test(text)) leaks.push(`${tense} ${clue.type}${clue.negate ? " (no)" : ""}: ${text}`);
          }
        }
        assertEqual(leaks.length, 0, "verbi al presente:\n" + leaks.join("\n"));
        puzzle.tense = "past";
        const adjacent = { id: "c", type: "adjacent", characterId: ids.owner, params: { targetId: ids.other } };
        assertEqual(describeClue(adjacent, puzzle), "Was next to Bruno.");
        assertEqual(describeClue({ ...adjacent, negate: true }, puzzle), "Was not next to Bruno.");
        puzzle.tense = "future";
        assertEqual(describeClue(adjacent, puzzle), "Will be next to Bruno.");
        assertEqual(describeClue({ ...adjacent, negate: true }, puzzle), "Will not be next to Bruno.");
      } finally {
        await setLanguageForSession("it");
      }
    },
  },
  {
    name: "tense: il lessico non usa mai «vicino» per la vicinanza (sempre «accanto»)",
    fn: () => {
      const { puzzle, ids } = samplePuzzle();
      const bad = [];
      for (const [type, def] of Object.entries(CLUE_TYPES)) {
        if (def.internal || type === "closerTo") continue; // «più vicino a… che a…» confronta due distanze
        const label = String(def.label);
        const sentences = everyClue(ids).filter((c) => c.type === type).map((c) => describeClue(c, puzzle));
        for (const text of [label, ...sentences]) if (/\bvicin[oaie]\b/i.test(text)) bad.push(`${type}: ${text}`);
      }
      assertEqual(bad.length, 0, "«vicino» nel testo:\n" + bad.join("\n"));
    },
  },
  {
    name: "tense: createPuzzle parte dal presente; setTense accetta solo i tre tempi; la forma del caso rifiuta un tempo inventato",
    fn: () => {
      const puzzle = createPuzzle("T");
      assertEqual(puzzle.tense, "present");
      for (const tense of TENSES) { setTense(puzzle, tense); assertEqual(puzzle.tense, tense); }
      setTense(puzzle, "boh");
      assertEqual(puzzle.tense, "present");
      puzzle.tense = "boh";
      assert(!validatePuzzleShape(clonePuzzle(puzzle)).valid, "un tempo sconosciuto non è valido");
      puzzle.tense = "past";
      assert(validatePuzzleShape(clonePuzzle(puzzle)).valid, "un tempo valido passa");
    },
  },
  {
    name: "migrazione 3→4: i vecchi indizi diventano la forma unificata (stesso significato), il tempo parte dal presente",
    fn: () => {
      const puzzle = createPuzzle("Vecchio");
      puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
      const victim = addCharacter(puzzle, "Vittima", "person1", true);
      const a = addCharacter(puzzle, "Anna", "person2");
      const b = addCharacter(puzzle, "Bruno", "person1");
      const zone = addZone(puzzle.grid, "Cucina", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      const shelf = placeObject(puzzle.grid, "shelf", 2, 2);
      const lamp = placeObject(puzzle.grid, "lamp", 3, 3);
      const old = [
        addClue(puzzle, a.id, "notAdjacent", { targetId: shelf.id }),
        addClue(puzzle, a.id, "notInRoom", { zoneId: zone.id }),
        addClue(puzzle, a.id, "notSameRoomAs", { targetId: b.id }),
        addClue(puzzle, a.id, "direction", { direction: "north", targetId: b.id }),
        addClue(puzzle, a.id, "onlyPersonInRoom", { zoneId: zone.id }),
        addClue(puzzle, a.id, "aloneWithVictim", {}),
        addClue(puzzle, a.id, "eitherAdjacent", { targetAId: shelf.id, targetBId: lamp.id }),
        addClue(puzzle, null, "emptyRoomsCount", { count: 2 }),
        addClue(puzzle, a.id, "orClue", { a: { type: "notInRoom", params: { zoneId: zone.id } }, b: { type: "inCorner", params: {} } }),
      ];
      old[0].negate = true; // "no" sopra "non è accanto" = è accanto
      puzzle.schemaVersion = 3;
      delete puzzle.tense;

      migratePuzzle(puzzle);
      assertEqual(puzzle.schemaVersion, CURRENT_SCHEMA_VERSION);
      assertEqual(puzzle.tense, "present");
      const byId = Object.fromEntries(puzzle.clues.map((c) => [c.id, c]));
      assertEqual(byId[old[0].id].type, "adjacent");
      assert(!byId[old[0].id].negate, "non è accanto + «no» = è accanto");
      assertEqual(byId[old[1].id].type, "inRoom");
      assert(byId[old[1].id].negate === true);
      assertEqual(byId[old[2].id].type, "sameRoomAs");
      assert(byId[old[2].id].negate === true);
      assertEqual(byId[old[3].id].type, "directionDistance");
      assertEqual(byId[old[3].id].params.distance, null);
      assertEqual(byId[old[4].id].type, "aloneInRoom");
      assertEqual(byId[old[5].id].type, "aloneWithPerson");
      assertEqual(byId[old[5].id].params.targetId, victim.id);
      assertEqual(byId[old[6].id].type, "orClue");
      assertEqual(byId[old[6].id].params.a.params.targetId, shelf.id);
      assertEqual(byId[old[6].id].params.b.params.targetId, lamp.id);
      assertEqual(byId[old[7].id].type, "roomsWithStateCount");
      assertEqual(byId[old[7].id].params.state, "empty");
      assertEqual(byId[old[8].id].params.a.type, "inRoom", "anche dentro un indizio composto");
      assert(byId[old[8].id].params.a.negate === true);
      for (const clue of puzzle.clues) assert(clue.type in CLUE_TYPES, `${clue.type} deve esistere ancora`);
    },
  },
  {
    name: "migrazione 3→4: «sola con la vittima» senza vittima non ha equivalente e viene tolta; rieseguirla non cambia nulla",
    fn: () => {
      const puzzle = createPuzzle("Senza vittima");
      const a = addCharacter(puzzle, "Anna", "person1");
      addClue(puzzle, a.id, "aloneWithVictim", {});
      addClue(puzzle, a.id, "inCorner", {});
      puzzle.schemaVersion = 3;
      migratePuzzle(puzzle);
      assertEqual(puzzle.clues.length, 1);
      assertEqual(puzzle.clues[0].type, "inCorner");
      const once = JSON.stringify(puzzle);
      migratePuzzle(puzzle);
      assertEqual(JSON.stringify(puzzle), once);
    },
  },
];
