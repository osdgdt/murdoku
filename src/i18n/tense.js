// Verb tense of the clue sentences. Every clue is written once, in the PRESENT
// ("È accanto a…", "Is next to…"); a case can ask for its clues in the past or
// in the future instead, and the whole case then reads in one tense. The
// conversion works on the sentence TEMPLATE (before names and numbers are
// filled in), one word at a time, so nothing a person typed is ever touched.
//
// Tiny and dependency-free on purpose: it is a word table, not a grammar. It
// only has to know the verbs the clue sentences actually use — test-tense.js
// walks every clue type to make sure none slips through in the wrong tense.

export const TENSES = ["present", "past", "future"];
export const DEFAULT_TENSE = "present";

export function isTense(value) {
  return TENSES.includes(value);
}

// [present, past, future]. Italian uses the imperfetto for the past, the way
// a witness would say "era in cucina".
const IT = [
  ["c'è", "c'era", "ci sarà"],
  ["si trovano", "si trovavano", "si troveranno"],
  ["si trova", "si trovava", "si troverà"],
  ["condivide", "condivideva", "condividerà"],
  ["verifica", "verificava", "verificherà"],
  ["hanno", "avevano", "avranno"],
  ["sono", "erano", "saranno"],
  ["è", "era", "sarà"],
];

const EN = [
  ["is not", "was not", "will not be"],
  ["are not", "were not", "will not be"],
  ["do not have", "did not have", "will not have"],
  ["does not have", "did not have", "will not have"],
  ["does not", "did not", "will not"],
  ["do not", "did not", "will not"],
  ["satisfies", "satisfied", "will satisfy"],
  ["stands", "stood", "will stand"],
  ["shares", "shared", "will share"],
  ["sits", "sat", "will sit"],
  ["has", "had", "will have"],
  ["have", "had", "will have"],
  ["holds", "held", "will hold"],
  ["is", "was", "will be"],
  ["are", "were", "will be"],
];

function compile(table) {
  const byPresent = new Map(table.map(([present, past, future]) => [present, { past, future }]));
  const alternatives = [...byPresent.keys()].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Whole words only; one pass over the text so a replacement is never
  // converted a second time ("has" -> "will have" must not turn "have" again).
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return { byPresent, re };
}

const COMPILED = { it: compile(IT), en: compile(EN) };

// Keeps a capital letter at the start of the word ("È" -> "Era", "Is" -> "Was").
function matchCase(original, replacement) {
  const first = original.charAt(0);
  return first !== first.toLowerCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

// Turns a present-tense sentence template into the given tense.
export function conjugate(text, language, tense) {
  if (tense === "present" || !isTense(tense) || typeof text !== "string") return text;
  const { byPresent, re } = COMPILED[language] || COMPILED.it;
  return text.replace(re, (match) => matchCase(match, byPresent.get(match.toLowerCase())[tense]));
}
