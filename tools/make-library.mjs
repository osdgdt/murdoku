// Builds the bundled case library (examples/library/*.json + examples/library.json)
// from tools/cases/library.mjs. Only ids listed in the CLI args are rebuilt
// when given (`node tools/make-library.mjs hotel`); seeds that already passed
// their gate are remembered in tools/cases/seeds.json so reruns are instant
// and byte-identical.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { buildBase, trueClues, composeClues, measure, verify, rng, addClue } from "./lib/author.mjs";
import { LIBRARY } from "./cases/library.mjs";
const { estimateDifficultyFromNodes } = await import("../src/model/puzzle.js");
const { checkUniqueness } = await import("../src/solver/validator.js");
const { zoneOfCell } = await import("../src/model/grid.js");

const root = path.resolve(import.meta.dirname, "..");
const seedsFile = path.join(root, "tools/cases/seeds.json");
const seeds = existsSync(seedsFile) ? JSON.parse(readFileSync(seedsFile, "utf8")) : {};
const only = process.argv.slice(2);

const SIMPLE = new Set(["inRoom", "inRowOrCol", "adjacent", "diagonal", "sameRoomAs", "onObjectType", "rowOrColWith", "inCorner", "aloneInRoom", "facing", "seated"]);
const RELATIONAL = new Set([...SIMPLE, "between", "closerTo", "zoneAdjacentTo", "rowOrColAdjacentTo", "directionDistance", "onlyPersonNear", "inRoomCorner", "aloneWithPerson", "rowOrColParity", "someoneInRoomWithProperty"]);

const MODES = {
  easy: { allowType: (c) => SIMPLE.has(c.type) && !c.negate && !c.generic, negateChance: 0, pruneChance: 0.5, gate: (m) => m.forcedByPropagation === m.nChars && m.types >= 3 && m.nClues >= m.nChars + 1 },
  medium: { allowType: (c) => RELATIONAL.has(c.type) && !c.generic, negateChance: 0.25, pruneChance: 1, gate: (m) => m.forcedByPropagation >= 1 && m.forcedByPropagation < m.nChars && m.types >= 4 },
  hard: { allowType: () => true, negateChance: 0.4, pruneChance: 1, gate: (m) => m.forcedByPropagation <= 1 && m.generic >= 1 && m.types >= 5 },
  expert: { allowType: () => true, negateChance: 0.5, pruneChance: 1, gate: (m) => m.forcedByPropagation === 0 && m.generic >= 1 && m.types >= 5 },
};

// Rename random ids to stable, language-independent ones.
function canonicalize(puzzle, ids) {
  const map = new Map();
  puzzle.characters.forEach((c, i) => map.set(c.id, `c${i + 1}`));
  puzzle.grid.zones.forEach((z, i) => map.set(z.id, `z${i + 1}`));
  puzzle.grid.objects.forEach((o, i) => map.set(o.id, `o${i + 1}`));
  let json = JSON.stringify(puzzle);
  for (const [from, to] of map) json = json.split(`"${from}"`).join(`"${to}"`);
  const out = JSON.parse(json);
  const newIds = Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, map.get(v)]));
  return { puzzle: out, ids: newIds };
}

function finish(spec, lang, base, ids, clues) {
  const puzzle = JSON.parse(JSON.stringify(base));
  puzzle.id = `lib_${spec.id}_${lang}`;
  puzzle.author = "Murdoku";
  puzzle.difficulty = spec.difficulty;
  puzzle.createdAt = puzzle.updatedAt = Date.UTC(2026, 0, 1);
  clues.forEach((c, i) => {
    const clue = addClue(puzzle, c.characterId, c.type, c.params);
    clue.id = `k${i + 1}`;
    if (c.negate) clue.negate = true;
  });
  // victim room + murderer, derived from the true solution
  const victim = puzzle.characters.find((c) => c.isVictim);
  const vp = puzzle.solution.placements.find((p) => p.characterId === victim.id);
  const vzone = zoneOfCell(puzzle.grid, vp.row, vp.col);
  const roomName = puzzle.grid.zones.find((z) => z.id === vzone).name;
  const other = puzzle.solution.placements.filter((p) => p.characterId !== victim.id).find((p) => zoneOfCell(puzzle.grid, p.row, p.col) === vzone);
  const murderer = puzzle.characters.find((c) => c.id === other.characterId).name;
  const roomPhrase = lang === "it" ? `nella stanza «${roomName}»` : `in the room "${roomName}"`;
  const fill = (s) => s.replaceAll("{victimRoom}", roomPhrase).replaceAll("{murderer}", murderer).replaceAll("{room}", roomName);
  puzzle.briefing = fill(spec.text[lang].briefing);
  puzzle.resolutionNote = fill(spec.text[lang].resolution);
  return puzzle;
}

mkdirSync(path.join(root, "examples/library"), { recursive: true });
const index = [];
for (const spec of LIBRARY) {
  // A case with a remembered seed is rebuilt deterministically (fast); one without is searched.
  const rebuild = only.length === 0 ? true : only.includes(spec.id);
  const mode = MODES[spec.mode];
  const en = buildBase(spec, "en");
  const baseEn = canonicalize(en.puzzle, en.ids);
  const it = buildBase(spec, "it");
  const baseIt = canonicalize(it.puzzle, it.ids);

  const fileOf = (lang) => path.join(root, `examples/library/${spec.id}.${lang}.murdoku.json`);
  let chosen = null;
  if (!rebuild && existsSync(fileOf("en"))) {
    const existing = JSON.parse(readFileSync(fileOf("en"), "utf8"));
    chosen = { clues: existing.clues.map(({ characterId, type, params, negate }) => ({ characterId, type, params, negate: !!negate })), seed: seeds[spec.id] };
  } else {
    const pool = trueClues(baseEn.puzzle, baseEn.ids, spec.solution);
    const startSeed = seeds[spec.id] ?? spec.seed;
    const tryOrder = seeds[spec.id] ? [seeds[spec.id]] : Array.from({ length: 400 }, (_, i) => startSeed + i);
    for (const seed of tryOrder) {
      const clues = await composeClues(baseEn.puzzle, pool, { random: rng(seed), ...mode });
      if (!clues) continue;
      const m = measure(baseEn.puzzle, clues, baseEn.ids);
      const nonVictimsCovered = Object.entries(m.perChar).every(([key, n]) => key === "v" || n >= 1);
      if (mode.gate(m) && nonVictimsCovered && m.nClues <= 3 * m.nChars + 3) { chosen = { clues, seed, m }; break; }
    }
    if (!chosen) throw new Error(`${spec.id}: no seed satisfied the ${spec.mode} gate`);
    seeds[spec.id] = chosen.seed;
    writeFileSync(seedsFile, JSON.stringify(seeds, null, 2) + "\n"); // keep progress if the run is interrupted
  }

  const files = {};
  let info = null;
  for (const lang of ["it", "en"]) {
    const base = lang === "en" ? baseEn : baseIt;
    const puzzle = finish(spec, lang, base.puzzle, base.ids, chosen.clues);
    const { redundant } = await verify(puzzle);
    const stats = { nodes: checkUniqueness(puzzle, { maxSolutions: 2 }).nodesVisited };
    info = { redundant, nodes: stats.nodes, estimate: estimateDifficultyFromNodes(stats.nodes) };
    writeFileSync(fileOf(lang), JSON.stringify(puzzle, null, 2) + "\n");
    files[lang] = `examples/library/${spec.id}.${lang}.murdoku.json`;
  }
  const m = measure(baseEn.puzzle, chosen.clues, baseEn.ids);
  console.log(`${spec.id.padEnd(11)} ${spec.mode.padEnd(7)} seed=${chosen.seed} clues=${m.nClues} types=${m.types} generic=${m.generic} propagation-forced=${m.forcedByPropagation}/${m.nChars} redundant=${info.redundant} nodes=${info.nodes}`);
  index.push({
    id: spec.id, order: spec.order, difficulty: spec.difficulty, size: [spec.map.length, spec.map[0].length], characters: spec.cast.length, clues: chosen.clues.length,
    title: { it: spec.text.it.title, en: spec.text.en.title }, files,
    puzzleId: { it: `lib_${spec.id}_it`, en: `lib_${spec.id}_en` },
  });
}
// The hand-written tutorial (tools/make-tutorial.mjs) leads the library.
index.unshift({
  id: "tutorial", order: 0, difficulty: "very-easy", size: [4, 4], characters: 3, clues: 7,
  title: { it: "Tutorial: il primo caso", en: "Tutorial: your first case" },
  files: { it: "examples/tutorial.it.murdoku.json", en: "examples/tutorial.en.murdoku.json" },
  puzzleId: { it: "tutorial_it", en: "tutorial_en" },
});
writeFileSync(seedsFile, JSON.stringify(seeds, null, 2) + "\n");
writeFileSync(path.join(root, "examples/library.json"), JSON.stringify({ version: 1, cases: index }, null, 2) + "\n");
console.log(`library: ${index.length} cases`);
