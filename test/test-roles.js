// I ruoli nascosti (Medioevo: nobili/villici/cavalieri; Far West: fuorilegge; Preistoria: mansioni): il dato (ruoli, aree nobili,
// caselle riservate, ruoli della soluzione), la regola sempre attiva, i tre indizi, la ricerca con le assegnazioni di ruoli
// (contro la forza bruta) e i controlli dell'editor.
import { createPuzzle, addCharacter, addClue, validatePuzzleShape, removeCharacter } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid, setBlocked } from "../src/model/grid.js";
import {
  addRole,
  renameRole,
  removeRole,
  setRoleRule,
  setRoleCount,
  setEveryoneHasRole,
  setZoneNoble,
  setRoleCell,
  roleCellOf,
  roleAllowsCell,
  hasRoles,
  clearRoles,
  applyRolePreset,
  setSolutionRole,
  declaredRoleMap,
  declaredRoleProblems,
  withRoles,
  withDeclaredRoles,
  roleProblems,
} from "../src/model/roles.js";
import { describeClue, CLUE_TYPES } from "../src/model/clueTypes.js";
import { migratePuzzle, CURRENT_SCHEMA_VERSION } from "../src/model/migrations.js";
import { buildPredicate, buildPredicates } from "../src/solver/predicates/index.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { roleAssignments } from "../src/solver/roles.js";
import { checkUniqueness, validateSolution } from "../src/solver/validator.js";
import { suggestClues, enumerateParams } from "../src/solver/suggestions.js";
import { defaultParams, typeIdsFor, convertParams, missingParams, roleChoices } from "../src/editor/clueDraft.js";
import { assert, assertEqual } from "./assert.js";

// 4×4: la stanza «Sala» (righe 0-1, area nobile) e la stanza «Piazza» (righe 2-3). Tre persone: la vittima V, A e B.
function scene({ roles = ["noble", "villager", "knight"], everyone = true, counts = null } = {}) {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const hall = addZone(puzzle.grid, "Sala", "#cfe");
  const square = addZone(puzzle.grid, "Piazza", "#fec");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, (r < 2 ? hall : square).id);
  setZoneNoble(puzzle.grid, hall.id, true);
  const defs = {};
  const rules = {
    noble: ["Nobile", "inNoble"],
    villager: ["Villico", "notInNoble"],
    knight: ["Cavaliere", "none"],
    outlaw: ["Fuorilegge", "none"],
  };
  for (const key of roles) defs[key] = addRole(puzzle, rules[key][0], rules[key][1]);
  setEveryoneHasRole(puzzle, everyone);
  for (const [key, n] of Object.entries(counts || {})) setRoleCount(puzzle, defs[key].id, n);
  const people = [addCharacter(puzzle, "V", "person1", true), addCharacter(puzzle, "A", "person2"), addCharacter(puzzle, "B", "person3")];
  return { puzzle, people, defs, hall, square };
}
const at = (entries) => new Map(entries.map(([c, row, col]) => [c.id, { row, col }]));
const roleMap = (entries) => new Map(entries.map(([c, role]) => [c.id, role]));

// Forza bruta, con le regole scritte a mano: le posizioni distinte (una per riga e colonna) per cui ESISTE un'assegnazione di
// ruoli che rispetta numeri, aree nobili, caselle riservate e gli indizi dati come funzioni `ok(roles, cells)`.
function bruteForce(puzzle, defs, ok = () => true) {
  const people = puzzle.characters;
  const ids = puzzle.roles.defs.map((d) => d.id);
  const choices = puzzle.roles.everyone ? ids : [...ids, null];
  const counts = puzzle.roles.counts || {};
  const zoneOf = ([r]) => puzzle.grid.cells[r][0].zoneId;
  const inNoble = (cell) => puzzle.grid.zones.find((z) => z.id === zoneOf(cell))?.kind === "noble";
  const found = new Set();
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push([r, c]);
  const placements = [];
  (function place(i, chosen) {
    if (i === people.length) {
      placements.push(chosen);
      return;
    }
    for (const cell of cells) if (!chosen.some(([r, c]) => r === cell[0] || c === cell[1])) place(i + 1, [...chosen, cell]);
  })(0, []);
  for (const chosen of placements) {
    const victim = people.findIndex((p) => p.isVictim);
    const mates = chosen.filter((cell, j) => j !== victim && zoneOf(cell) === zoneOf(chosen[victim])).length;
    if (mates !== 1) continue;
    const tryRoles = (i, assigned) => {
      if (i === people.length) {
        for (const id of ids) if (Number.isInteger(counts[id]) && assigned.filter((r) => r === id).length !== counts[id]) return false;
        return ok(assigned, chosen);
      }
      for (const role of choices) {
        const rule = puzzle.roles.defs.find((d) => d.id === role)?.rule;
        if (rule === "inNoble" && !inNoble(chosen[i])) continue;
        if (rule === "notInNoble" && inNoble(chosen[i])) continue;
        if (tryRoles(i + 1, [...assigned, role])) return true;
      }
      return false;
    };
    if (tryRoles(0, [])) found.add(chosen.map((cell) => cell.join(",")).join("|"));
  }
  return found.size;
}

export const tests = [
  {
    name: "ruoli: si creano (nome unico, al massimo 8), si rinominano, cambiano regola e numero; i preset danno i ruoli del libro",
    fn: () => {
      const puzzle = createPuzzle("Prova");
      assert(!hasRoles(puzzle));
      const knight = addRole(puzzle, "  Cavaliere ", "none");
      assert(knight && knight.name === "Cavaliere" && hasRoles(puzzle));
      assertEqual(addRole(puzzle, "cavaliere"), null, "stesso nome (senza badare alle maiuscole)");
      assertEqual(addRole(puzzle, "   "), null, "nome vuoto");
      assert(renameRole(puzzle, knight.id, "Soldato") && puzzle.roles.defs[0].name === "Soldato");
      assert(!renameRole(puzzle, knight.id, ""));
      assert(setRoleRule(puzzle, knight.id, "inNoble") && !setRoleRule(puzzle, knight.id, "boh"));
      assert(setRoleCount(puzzle, knight.id, 2) && puzzle.roles.counts[knight.id] === 2);
      assert(setRoleCount(puzzle, knight.id, null) && !(knight.id in puzzle.roles.counts), "vuoto = non dichiarato");
      for (let i = 0; i < 10; i++) addRole(puzzle, `Ruolo ${i}`);
      assertEqual(puzzle.roles.defs.length, 8, "al massimo 8 ruoli");

      const medieval = createPuzzle("Medioevo");
      applyRolePreset(medieval, "medieval");
      assertEqual(medieval.roles.defs.map((d) => d.rule).join(), "inNoble,notInNoble,none");
      assert(medieval.roles.everyone);
      const tasks = createPuzzle("Preistoria");
      applyRolePreset(tasks, "tasks");
      assertEqual(tasks.roles.defs.length, 5);
      assert(!tasks.roles.everyone);
    },
  },
  {
    name: "ruoli: togliere un ruolo libera le sue caselle, lo toglie dalla soluzione e cancella gli indizi che lo nominano (anche annidati)",
    fn: () => {
      const { puzzle, people, defs, square } = scene();
      setRoleCell(puzzle.grid, 3, 3, defs.knight.id);
      setSolutionRole(puzzle, people[1].id, defs.knight.id);
      addClue(puzzle, people[1].id, "hasRole", { roleId: defs.knight.id });
      addClue(puzzle, people[1].id, "hasRole", { roleId: defs.noble.id });
      addClue(puzzle, null, "roleAllInRoom", { roleId: defs.knight.id, zoneId: square.id });
      addClue(puzzle, people[2].id, "orClue", {
        a: { type: "hasRole", params: { roleId: defs.knight.id } },
        b: { type: "inCorner", params: {} },
      });
      assert(removeRole(puzzle, defs.knight.id));
      assertEqual(roleCellOf(puzzle.grid, 3, 3), null);
      assertEqual(puzzle.solution.roles[people[1].id], null);
      assertEqual(puzzle.clues.length, 1, "resta solo l'indizio sul nobile");
      assertEqual(puzzle.roles.defs.length, 2);
    },
  },
  {
    name: "ruoli: «togli tutti i ruoli» riporta il caso com'era (niente ruoli, aree nobili, ruoli della soluzione)",
    fn: () => {
      const { puzzle, people, defs } = scene();
      setSolutionRole(puzzle, people[1].id, defs.noble.id);
      addClue(puzzle, people[1].id, "hasRole", { roleId: defs.noble.id });
      clearRoles(puzzle);
      assert(!("roles" in puzzle) && !("roles" in puzzle.solution));
      assertEqual(puzzle.clues.length, 0);
      assert(puzzle.grid.zones.every((z) => !("kind" in z)));
      assert(validatePuzzleShape(puzzle).valid || !JSON.stringify(validatePuzzleShape(puzzle).errors).includes("ruol"));
    },
  },
  {
    name: "ruoli: una casella riservata vuole un posto dove stare; bloccarla o metterci un mobile alto la libera; un ruolo diverso non ci può stare",
    fn: () => {
      const { puzzle, defs } = scene();
      const grid = puzzle.grid;
      assert(setRoleCell(grid, 1, 1, defs.knight.id) && roleCellOf(grid, 1, 1) === defs.knight.id);
      placeObject(grid, "table", 2, 2);
      assert(!setRoleCell(grid, 2, 2, defs.knight.id), "un tavolo non si occupa");
      setRoleCell(grid, 0, 3, defs.knight.id);
      placeObject(grid, "shelf", 0, 3);
      assertEqual(roleCellOf(grid, 0, 3), null, "un mobile alto la libera");
      setBlocked(grid, 1, 1, true);
      assertEqual(roleCellOf(grid, 1, 1), null, "una cella bloccata non è riservata");
      setBlocked(grid, 1, 1, false);
      setRoleCell(grid, 1, 1, defs.knight.id);
      assert(roleAllowsCell(puzzle, defs.knight.id, 1, 1));
      assert(
        !roleAllowsCell(puzzle, defs.noble.id, 1, 1),
        "il nobile non può stare su una casella da cavaliere, anche se è nell'area nobile"
      );
      assert(!roleAllowsCell(puzzle, null, 1, 1), "chi non ha ruolo nemmeno");
      assert(roleAllowsCell(puzzle, defs.noble.id, 0, 0) && !roleAllowsCell(puzzle, defs.villager.id, 0, 0));
      assert(roleAllowsCell(puzzle, defs.villager.id, 3, 3) && !roleAllowsCell(puzzle, defs.noble.id, 3, 3));
      assert(roleAllowsCell(puzzle, defs.knight.id, 3, 3) && roleAllowsCell(puzzle, defs.knight.id, 0, 0), "il cavaliere va ovunque");
    },
  },
  {
    name: "ruoli: la forma del caso — ruoli, numeri, caselle e soluzione non validi sono respinti; un caso senza ruoli resta valido",
    fn: () => {
      const { puzzle, people, defs } = scene({ counts: { noble: 1, villager: 1, knight: 1 } });
      assertEqual(validatePuzzleShape(puzzle).errors.filter((e) => /ruol|riservat/i.test(e)).length, 0, "caso a posto");
      const broken = JSON.parse(JSON.stringify(puzzle));
      broken.roles.counts[defs.noble.id] = 5;
      assert(roleProblems(broken).length >= 1, "più ruoli dichiarati delle persone");
      const wrongRule = JSON.parse(JSON.stringify(puzzle));
      wrongRule.roles.defs[0].rule = "ovunque";
      assert(roleProblems(wrongRule).length >= 1);
      const wrongCell = JSON.parse(JSON.stringify(puzzle));
      wrongCell.grid.cells[0][0].roleCell = "role_inesistente";
      assert(roleProblems(wrongCell).length >= 1);
      const wrongSolution = JSON.parse(JSON.stringify(puzzle));
      wrongSolution.solution.roles = { [people[1].id]: "role_inesistente" };
      assert(roleProblems(wrongSolution).length >= 1);
      const wrongZone = JSON.parse(JSON.stringify(puzzle));
      wrongZone.grid.zones[0].kind = "regale";
      assert(validatePuzzleShape(wrongZone).errors.length >= 1);
      const plain = createPuzzle("Senza ruoli");
      assert(validatePuzzleShape(plain).valid);
      assertEqual(roleProblems(plain).length, 0);
    },
  },
  {
    name: "ruoli: un caso salvato prima (schema 4, senza ruoli) si apre com'è; togliere un personaggio toglie anche il suo ruolo dalla soluzione",
    fn: () => {
      const old = createPuzzle("Vecchio");
      old.schemaVersion = 4;
      migratePuzzle(old);
      assertEqual(old.schemaVersion, CURRENT_SCHEMA_VERSION);
      assert(!("roles" in old) && validatePuzzleShape(old).valid);
      const { puzzle, people, defs } = scene();
      setSolutionRole(puzzle, people[2].id, defs.noble.id);
      removeCharacter(puzzle, people[2].id);
      assert(!(people[2].id in puzzle.solution.roles));
    },
  },
  {
    name: "ruoli: la regola sempre attiva — il villico non sta nell'area nobile, il nobile ci sta per forza, la casella riservata è di chi ha il ruolo",
    fn: () => {
      const { puzzle, people, defs } = scene();
      const [v, a, b] = people;
      const rule = (roles) => buildPredicates(withRoles(puzzle, roles)).find(({ clue }) => clue.type === "roleRule").predicate;
      const roles = roleMap([
        [v, defs.knight.id],
        [a, defs.villager.id],
        [b, defs.noble.id],
      ]);
      assertEqual(rule(roles)(at([[a, 0, 0]]), false), false, "un villico nella Sala");
      assertEqual(rule(roles)(at([[a, 2, 2]]), false), undefined, "un villico in piazza: nulla da dire per ora");
      assertEqual(rule(roles)(at([[b, 3, 3]]), false), false, "un nobile in piazza");
      assertEqual(
        rule(roles)(
          at([
            [v, 0, 0],
            [a, 2, 1],
            [b, 1, 2],
          ]),
          true
        ),
        true,
        "tutti dove devono"
      );
      // senza i ruoli (il tavolo del giocatore) la regola non c'è: niente si può giudicare
      assert(!buildPredicates(puzzle).some(({ clue }) => clue.type === "roleRule"));
      setRoleCell(puzzle.grid, 3, 0, defs.knight.id);
      assertEqual(rule(roles)(at([[a, 3, 0]]), false), false, "il villico sulla casella del cavaliere");
      assertEqual(rule(roles)(at([[v, 3, 0]]), false), undefined, "il cavaliere sulla sua casella");
    },
  },
  {
    name: "ruoli: i tre indizi — «è un X», «a nord di tutti gli X», «tutti gli X in una stanza», con la negazione; senza i ruoli non decidono mai",
    fn: () => {
      const { puzzle, people, defs, square } = scene();
      const [v, a, b] = people;
      const roles = roleMap([
        [v, defs.noble.id],
        [a, defs.knight.id],
        [b, defs.knight.id],
      ]);
      const view = withRoles(puzzle, roles);
      const isKnight = { id: "c1", characterId: a.id, type: "hasRole", params: { roleId: defs.knight.id } };
      assertEqual(buildPredicate(isKnight, view)(new Map(), false), true, "si decide dal solo ruolo, senza posizioni");
      assertEqual(buildPredicate({ ...isKnight, negate: true }, view)(new Map(), false), false);
      assertEqual(buildPredicate({ ...isKnight, characterId: v.id }, view)(new Map(), false), false, "il nobile non è un cavaliere");
      assertEqual(buildPredicate({ ...isKnight, params: { roleId: "*" } }, view)(new Map(), false), true, "«ha un ruolo»");
      assertEqual(buildPredicate(isKnight, puzzle)(new Map(), false), undefined, "ruoli ignoti: nessun giudizio");

      const north = { id: "c2", characterId: v.id, type: "roleDirection", params: { direction: "north", roleId: defs.knight.id } };
      assertEqual(
        buildPredicate(north, view)(
          at([
            [v, 0, 0],
            [a, 2, 1],
          ]),
          false
        ),
        undefined,
        "manca ancora B"
      );
      assertEqual(
        buildPredicate(north, view)(
          at([
            [v, 0, 0],
            [a, 2, 1],
            [b, 3, 2],
          ]),
          true
        ),
        true
      );
      assertEqual(
        buildPredicate(north, view)(
          at([
            [v, 2, 0],
            [a, 1, 1],
          ]),
          false
        ),
        false,
        "un cavaliere più a nord: falso subito"
      );
      const none = { ...north, characterId: a.id, params: { direction: "north", roleId: defs.noble.id } };
      assertEqual(
        buildPredicate(none, view)(
          at([
            [a, 0, 0],
            [v, 2, 1],
            [b, 3, 2],
          ]),
          true
        ),
        true,
        "a nord dell'unico nobile"
      );
      const noOther = { ...north, characterId: v.id, params: { direction: "north", roleId: defs.noble.id } };
      assertEqual(
        buildPredicate(noOther, view)(
          at([
            [v, 0, 0],
            [a, 2, 1],
            [b, 3, 2],
          ]),
          true
        ),
        false,
        "nessun altro nobile: non vale"
      );

      const allIn = { id: "c3", characterId: null, type: "roleAllInRoom", params: { roleId: defs.knight.id, zoneId: square.id } };
      assertEqual(buildPredicate(allIn, view)(at([[a, 2, 0]]), false), undefined, "B non c'è ancora");
      assertEqual(
        buildPredicate(allIn, view)(
          at([
            [v, 0, 0],
            [a, 2, 1],
            [b, 3, 2],
          ]),
          true
        ),
        true
      );
      assertEqual(buildPredicate(allIn, view)(at([[a, 0, 0]]), false), false, "un cavaliere nella Sala");
      assertEqual(buildPredicate({ ...allIn, negate: true }, view)(at([[a, 0, 0]]), false), true);
    },
  },
  {
    name: "ruoli: le frasi — italiano in tre tempi, inglese, negazione; il testo nomina il ruolo del caso",
    fn: () => {
      const { puzzle, people, defs, square } = scene();
      puzzle.tense = "present";
      const has = { characterId: people[1].id, type: "hasRole", params: { roleId: defs.knight.id } };
      assertEqual(describeClue(has, puzzle), "È un Cavaliere.");
      assertEqual(describeClue({ ...has, negate: true }, puzzle), "Non è un Cavaliere.");
      assertEqual(describeClue({ ...has, params: { roleId: "*" } }, puzzle), "Ha un ruolo.");
      assertEqual(describeClue({ ...has, params: { roleId: "*" }, negate: true }, puzzle), "Non ha nessun ruolo.");
      const north = { characterId: people[1].id, type: "roleDirection", params: { direction: "north", roleId: defs.knight.id } };
      assertEqual(describeClue(north, puzzle), "È a nord di tutte le persone con il ruolo «Cavaliere».");
      const all = { characterId: null, type: "roleAllInRoom", params: { roleId: defs.knight.id, zoneId: square.id } };
      assertEqual(describeClue(all, puzzle), 'Tutte le persone con il ruolo «Cavaliere» si trovano nella stanza "Piazza".');
      puzzle.tense = "past";
      assertEqual(describeClue(has, puzzle), "Era un Cavaliere.");
      assertEqual(describeClue({ ...has, params: { roleId: "*" } }, puzzle), "Aveva un ruolo.");
      assertEqual(describeClue(all, puzzle), 'Tutte le persone con il ruolo «Cavaliere» si trovavano nella stanza "Piazza".');
      puzzle.tense = "future";
      assertEqual(describeClue(has, puzzle), "Sarà un Cavaliere.");
    },
  },
  {
    name: "ruoli: la ricerca coincide con la forza bruta (numeri dichiarati, ruoli facoltativi, indizi sui ruoli) e conta le posizioni, non i ruoli",
    fn: () => {
      // 1) tre ruoli, ognuno ha il suo, un nobile / un villico / un cavaliere: i ruoli non cambiano le posizioni possibili tranne per le aree
      const a = scene({ counts: { noble: 1, villager: 1, knight: 1 } });
      const expectA = bruteForce(a.puzzle, a.defs);
      const gotA = checkUniqueness(a.puzzle, { maxSolutions: 10000 });
      assert(gotA.exhausted && gotA.solutionCount === expectA, `1) forza bruta ${expectA}, ricerca ${gotA.solutionCount}`);
      assert(expectA > 0);

      // 2) ruoli facoltativi (si può non averne), solo il nobile dichiarato, e un indizio: B non è nobile
      const b = scene({ roles: ["noble", "knight"], everyone: false, counts: { noble: 1 } });
      addClue(b.puzzle, b.people[2].id, "hasRole", { roleId: b.defs.noble.id }).negate = true;
      const expectB = bruteForce(b.puzzle, b.defs, (roles) => roles[2] !== b.defs.noble.id);
      const gotB = checkUniqueness(b.puzzle, { maxSolutions: 10000 });
      assert(gotB.exhausted && gotB.solutionCount === expectB, `2) forza bruta ${expectB}, ricerca ${gotB.solutionCount}`);

      // 3) A è un nobile (sta nella Sala) e tutti i cavalieri stanno in piazza
      const c = scene({ counts: { noble: 1, villager: 1, knight: 1 } });
      addClue(c.puzzle, c.people[1].id, "hasRole", { roleId: c.defs.noble.id });
      addClue(c.puzzle, null, "roleAllInRoom", { roleId: c.defs.knight.id, zoneId: c.square.id });
      const inSquare = (cell) => cell[0] >= 2;
      const expectC = bruteForce(c.puzzle, c.defs, (roles, cells) => {
        if (roles[1] !== c.defs.noble.id) return false;
        return roles.every((role, i) => role !== c.defs.knight.id || inSquare(cells[i]));
      });
      const gotC = checkUniqueness(c.puzzle, { maxSolutions: 10000 });
      assert(gotC.exhausted && gotC.solutionCount === expectC, `3) forza bruta ${expectC}, ricerca ${gotC.solutionCount}`);
      for (const solution of gotC.solutions) {
        const role = (name) => solution.find((p) => p.characterId === c.people[name].id).role;
        assertEqual(role(1), c.defs.noble.id, "ogni soluzione dice il ruolo di A");
        assert(
          solution.every((p) => typeof p.role === "string" || p.role === null),
          "ogni posizione porta il ruolo"
        );
      }
      // 4) senza ruoli le soluzioni non portano nessun ruolo (la ricerca di sempre)
      const plain = createPuzzle("Senza");
      plain.grid = resizeGrid(plain.grid, 4, 4);
      const room = addZone(plain.grid, "Stanza", "#cfe");
      for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) paintCellZone(plain.grid, r, col, room.id);
      addCharacter(plain, "V", "person1", true);
      addCharacter(plain, "A", "person2");
      assert(solvePuzzle(plain, { maxSolutions: 3 }).every((solution) => solution.every((p) => !("role" in p))));
    },
  },
  {
    name: "ruoli: le assegnazioni provate rispettano i numeri dichiarati e scartano subito quelle che gli indizi sui ruoli smentiscono",
    fn: () => {
      const { puzzle, people, defs } = scene({ counts: { noble: 1, villager: 1, knight: 1 } });
      assertEqual([...roleAssignments(puzzle)].length, 6, "3! modi di dare tre ruoli a tre persone");
      addClue(puzzle, people[1].id, "hasRole", { roleId: defs.noble.id });
      const all = [...roleAssignments(puzzle)];
      assertEqual(all.length, 2);
      assert(all.every((assignment) => assignment.get(people[1].id) === defs.noble.id));
      const free = scene({ roles: ["noble", "knight"], everyone: false });
      assertEqual([...roleAssignments(free.puzzle)].length, 27, "tre ruoli possibili (compreso nessuno) per tre persone");
      // un ruolo le cui uniche caselle sono di un altro non si può dare a nessuno
      const stuck = scene({ roles: ["knight", "outlaw"] });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) setRoleCell(stuck.puzzle.grid, r, c, stuck.defs.knight.id);
      assert(
        [...roleAssignments(stuck.puzzle)].every((assignment) => [...assignment.values()].every((role) => role === stuck.defs.knight.id))
      );
    },
  },
  {
    name: "ruoli: con le caselle riservate solo chi ha il ruolo ci sta (e un caso che lo richiede ha una soluzione)",
    fn: () => {
      const { puzzle, defs } = scene({ roles: ["knight", "outlaw"], everyone: false, counts: { knight: 1 } });
      // tutta la piazza è riservata ai cavalieri: i non-cavalieri possono stare solo nella Sala
      for (let r = 2; r < 4; r++) for (let c = 0; c < 4; c++) setRoleCell(puzzle.grid, r, c, defs.knight.id);
      const got = checkUniqueness(puzzle, { maxSolutions: 10000 });
      assert(got.exhausted && got.solutionCount > 0);
      for (const solution of got.solutions) {
        for (const p of solution) {
          if (p.row >= 2) assertEqual(p.role, defs.knight.id, "in piazza solo il cavaliere");
        }
        assertEqual(solution.filter((p) => p.row >= 2).length <= 1, true, "i cavalieri sono uno solo");
      }
    },
  },
  {
    name: "ruoli: la soluzione dichiarata — ruolo mancante, numeri sbagliati o ruolo che non permette la casella sono segnalati; quella giusta è valida",
    fn: () => {
      const { puzzle, people, defs } = scene({ counts: { noble: 1, villager: 1, knight: 1 } });
      const [v, a, b] = people;
      puzzle.solution.placements = [
        { characterId: v.id, row: 0, col: 0 },
        { characterId: a.id, row: 1, col: 3 },
        { characterId: b.id, row: 3, col: 1 },
      ];
      assert(declaredRoleProblems(puzzle).length > 0, "nessun ruolo dichiarato");
      assert(!validateSolution(puzzle).valid);
      setSolutionRole(puzzle, v.id, defs.knight.id);
      setSolutionRole(puzzle, a.id, defs.noble.id);
      setSolutionRole(puzzle, b.id, defs.villager.id);
      assertEqual(declaredRoleProblems(puzzle).length, 0);
      const ok = validateSolution(puzzle);
      assert(ok.valid, JSON.stringify(ok.violations));
      setSolutionRole(puzzle, a.id, defs.villager.id); // un villico nella Sala, e due villici
      setSolutionRole(puzzle, b.id, defs.noble.id); // un nobile in piazza
      const bad = validateSolution(puzzle);
      assert(!bad.valid && bad.violations.some((x) => /ruolo/.test(x.message)), JSON.stringify(bad.violations));
      setSolutionRole(puzzle, a.id, defs.noble.id);
      setSolutionRole(puzzle, b.id, defs.villager.id);
      setSolutionRole(puzzle, v.id, defs.villager.id); // due villici e nessun cavaliere: i numeri non tornano
      assert(declaredRoleProblems(puzzle).length >= 2 && !validateSolution(puzzle).valid);
      assertEqual(declaredRoleMap(createPuzzle("Senza")), null);
    },
  },
  {
    name: "ruoli: l'editor — scelte del ruolo negli indizi, tipi offerti solo se ci sono ruoli, suggerimenti dalla soluzione dichiarata",
    fn: () => {
      const bare = createPuzzle("Senza");
      assert(!typeIdsFor("x", bare).includes("hasRole") && !typeIdsFor(null, bare).includes("roleAllInRoom"), "senza ruoli non si offrono");
      const { puzzle, people, defs, square } = scene();
      assert(typeIdsFor("x", puzzle).includes("hasRole") && typeIdsFor("x", puzzle).includes("roleDirection"));
      assert(typeIdsFor(null, puzzle).includes("roleAllInRoom"));
      assert(!typeIdsFor("x", puzzle).includes("roleRule"), "la regola di base non si offre mai");
      assertEqual(defaultParams("hasRole", puzzle).roleId, puzzle.roles.defs[0].id);
      assertEqual(roleChoices(puzzle, CLUE_TYPES.hasRole.params[0]).join(), ["*", ...puzzle.roles.defs.map((d) => d.id)].join());
      assertEqual(roleChoices(puzzle, CLUE_TYPES.roleDirection.params[1]).length, 3, "«qualsiasi» solo dove ha senso");
      assertEqual(missingParams({ type: "hasRole", params: { roleId: defs.noble.id } }).length, 0);
      assert(missingParams({ type: "hasRole", params: {} }).length > 0);
      const kept = convertParams("hasRole", { roleId: defs.knight.id }, "roleDirection", puzzle);
      assertEqual(kept.roleId, defs.knight.id, "il ruolo resta cambiando tipo di indizio");

      // suggerimenti: con la soluzione dichiarata (ruoli compresi) i fatti sui ruoli compaiono
      const [v, a, b] = people;
      setSolutionRole(puzzle, v.id, defs.knight.id);
      setSolutionRole(puzzle, a.id, defs.noble.id);
      setSolutionRole(puzzle, b.id, defs.villager.id);
      const placements = at([
        [v, 0, 0],
        [a, 1, 3],
        [b, 3, 1],
      ]);
      const suggested = suggestClues(puzzle, placements, { ownerId: a.id });
      assert(
        suggested.clues.some((c) => c.type === "hasRole" && c.params.roleId === defs.noble.id && !c.negate),
        "A è un nobile"
      );
      assert(!suggested.clues.some((c) => c.type === "hasRole" && c.params.roleId === defs.villager.id && !c.negate), "…e non un villico");
      const general = suggestClues(puzzle, placements, { ownerId: null });
      assert(
        general.clues.some((c) => c.type === "roleAllInRoom" && c.params.roleId === defs.villager.id && c.params.zoneId === square.id)
      );
      assertEqual(enumerateParams(CLUE_TYPES.hasRole, bare, null).length, 0, "senza ruoli non c'è niente da proporre");
      assert(withDeclaredRoles(puzzle).roleOf instanceof Map && withDeclaredRoles(bare) === bare);
    },
  },
  {
    name: "ruoli: «Il fuorilegge era su un tappeto» (qualcuno / tutti) e le proprietà annidate «era con un fuorilegge», «una riga a nord di lui»",
    fn: () => {
      const { puzzle, people, defs } = scene({ roles: ["noble", "outlaw"], everyone: false });
      const [v, a, b] = people;
      placeObject(puzzle.grid, "carpet", 2, 0);
      placeObject(puzzle.grid, "carpet", 3, 2);
      placeObject(puzzle.grid, "horse", 1, 1);
      const view = withRoles(
        puzzle,
        roleMap([
          [v, defs.noble.id],
          [a, defs.outlaw.id],
          [b, defs.outlaw.id],
        ])
      );
      const base = {
        id: "c1",
        characterId: null,
        type: "roleOnObjectType",
        params: { roleId: defs.outlaw.id, objectTypeId: "carpet", quantifier: "some" },
      };
      const all = { ...base, params: { ...base.params, quantifier: "all" } };
      const cast = (aPos, bPos) =>
        at([
          [v, 0, 0],
          [a, ...aPos],
          [b, ...bPos],
        ]);
      assertEqual(buildPredicate(base, view)(cast([2, 0], [3, 3]), true), true, "uno sul tappeto basta");
      assertEqual(buildPredicate(base, view)(cast([2, 1], [3, 3]), true), false, "nessuno sul tappeto");
      assertEqual(buildPredicate(all, view)(cast([2, 0], [3, 3]), true), false, "uno non c'è: «tutti» è falso");
      assertEqual(buildPredicate(all, view)(cast([2, 0], [3, 2]), true), true, "tutti e due sul tappeto");
      assertEqual(buildPredicate({ ...all, negate: true }, view)(cast([2, 0], [3, 3]), true), true);
      assertEqual(buildPredicate(base, view)(at([[a, 2, 0]]), false), true, "uno basta anche se B non c'è ancora");
      assertEqual(buildPredicate(all, view)(at([[a, 2, 0]]), false), undefined, "B non c'è ancora");
      assertEqual(buildPredicate(base, puzzle)(cast([2, 0], [3, 3]), true), undefined, "ruoli ignoti: nessun giudizio");
      const nobody = scene({ roles: ["outlaw"], everyone: false });
      assertEqual(
        buildPredicate(
          { ...all, params: { ...all.params, roleId: nobody.defs.outlaw.id } },
          withRoles(nobody.puzzle, new Map(nobody.puzzle.characters.map((c) => [c.id, null])))
        )(new Map(), true),
        false,
        "«tutti» senza nessuno col ruolo non è vero"
      );

      puzzle.tense = "present";
      assertEqual(describeClue(base, puzzle), "Una persona con il ruolo «Fuorilegge» è su un tappeto.");
      assertEqual(describeClue(all, puzzle), "Tutte le persone con il ruolo «Fuorilegge» sono su un tappeto.");
      const horse = { ...base, params: { ...base.params, objectTypeId: "horse" } };
      assertEqual(describeClue(horse, puzzle), "Una persona con il ruolo «Fuorilegge» è in sella a un cavallo.");
      puzzle.tense = "past";
      assertEqual(describeClue(all, puzzle), "Tutte le persone con il ruolo «Fuorilegge» erano su un tappeto.");
      assert(CLUE_TYPES.roleOnObjectType);

      // «Era con un fuorilegge»: la proprietà annidata `hasRole` dentro «qualcun altro nella stanza»
      const withOutlaw = {
        id: "c2",
        characterId: a.id,
        type: "someoneInRoomWithProperty",
        params: { property: "custom", customClue: { type: "hasRole", params: { roleId: defs.outlaw.id } } },
      };
      const solo = buildPredicate(withOutlaw, view);
      assertEqual(solo(cast([2, 0], [3, 3]), true), true, "B, fuorilegge, è nella stanza di A");
      assertEqual(solo(cast([2, 0], [1, 3]), true), false, "B è in un'altra stanza");
      assertEqual(buildPredicate(withOutlaw, puzzle)(cast([2, 0], [3, 3]), true), undefined, "ruoli ignoti");
      // «C'era un fuorilegge una riga a nord di lui»
      const northOutlaw = {
        id: "c3",
        characterId: b.id,
        type: "someoneAtDirectionDistance",
        params: {
          direction: "north",
          distance: 1,
          property: "custom",
          customClue: { type: "hasRole", params: { roleId: defs.outlaw.id } },
        },
      };
      assertEqual(buildPredicate(northOutlaw, view)(cast([2, 1], [3, 3]), true), true, "A (fuorilegge) è una riga a nord di B");
      assertEqual(buildPredicate(northOutlaw, view)(cast([2, 1], [3, 0]), true), true, "la colonna non conta");
      assertEqual(buildPredicate(northOutlaw, view)(cast([0, 1], [3, 3]), true), false, "V è a due righe e non è fuorilegge");
    },
  },
];
