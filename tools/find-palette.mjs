// Searches for character colors that stay distinguishable under
// protanopia/deuteranopia/tritanopia (max-min CIEDE2000, victim red included)
// within a luminance/chroma band that keeps >=3:1 contrast with white token
// text and both cell backgrounds. Randomized: run it a few times and keep the
// best.
//
//   node tools/find-palette.mjs                  searches a whole new palette of 10 (the
//                                                  result goes in CHARACTER_COLORS,
//                                                  src/model/puzzle.js, and the copy in
//                                                  model/migrations.js: ordered so that
//                                                  every prefix is well separated)
//   node tools/find-palette.mjs --extend 16      keeps the current CHARACTER_COLORS as they
//                                                  are (saved cases use them) and searches
//                                                  the extra ones up to 16 (appended to it)
import { dE00, lab, sim, lum, contrast } from "../test/cvd-sim.js";
import { CHARACTER_COLORS } from "../src/model/puzzle.js";

const DANGER = "#a83a2e";
const extendIndex = process.argv.indexOf("--extend");
const TOTAL = extendIndex === -1 ? 10 : Number(process.argv[extendIndex + 1]) || 16;
const KEEP = extendIndex === -1 ? [] : CHARACTER_COLORS;
const toHex = (r, g, b) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

// candidate pool: sRGB grid, filtered by luminance band (contrast >= 3 vs white and both cell backgrounds)
const pool = [];
const N = extendIndex === -1 ? 24 : 30;
const [lumMin, lumMax, chromaMin, chromaMax] = extendIndex === -1 ? [0.15, 0.28, 30, 62] : [0.14, 0.3, 26, 66]; // a wider band for the extras
for (let r = 0; r <= N; r++)
  for (let g = 0; g <= N; g++)
    for (let b = 0; b <= N; b++) {
      const h = toHex(r / N, g / N, b / N);
      const L = lum(h);
      if (L < lumMin || L > lumMax) continue;
      if (contrast(h, "#ffffff") < 3.05 || contrast(h, "#fffaf0") < 3.05 || contrast(h, "#2a231c") < 3.05) continue;
      const [, a, bb] = lab(sim(h, null));
      const c = Math.hypot(a, bb);
      if (c < chromaMin || c > chromaMax) continue;
      pool.push(h);
    }
console.log("pool", pool.length);

const types = [null, "prot", "deut", "trit"];
const labs = new Map();
const getLab = (h, t) => {
  const k = h + t;
  if (!labs.has(k)) labs.set(k, lab(sim(h, t)));
  return labs.get(k);
};
const dist = (a, b) => Math.min(...types.map((t) => dE00(getLab(a, t), getLab(b, t))));
const fixed = [DANGER, ...KEEP];
const rnd = (n) => Math.floor(Math.random() * n);
const count = TOTAL - KEEP.length;
const score = (set) => {
  let m = 1e9;
  for (let i = 0; i < set.length; i++) {
    for (const f of fixed) m = Math.min(m, dist(set[i], f));
    for (let j = i + 1; j < set.length; j++) m = Math.min(m, dist(set[i], set[j]));
  }
  return m;
};

let best = null;
let bestScore = -1;
for (let run = 0; run < 6; run++) {
  const sample = Array.from({ length: 6000 }, () => pool[rnd(pool.length)]);
  // greedy max-min against the fixed colors, then local improvement
  let chosen = [];
  while (chosen.length < count) {
    let pick = null;
    let pd = -1;
    for (const c of sample) {
      const d = Math.min(...[...fixed, ...chosen].map((x) => dist(c, x)));
      if (d > pd) {
        pd = d;
        pick = c;
      }
    }
    chosen.push(pick);
  }
  let cur = score(chosen);
  for (let it = 0; it < 6000; it++) {
    const i = rnd(count);
    const trial = chosen.slice();
    trial[i] = sample[rnd(sample.length)];
    const s = score(trial);
    if (s >= cur) {
      chosen = trial;
      cur = s;
    }
  }
  console.log("run", run, "min dE", cur.toFixed(2));
  if (cur > bestScore) {
    bestScore = cur;
    best = chosen;
  }
}
// order them so every prefix is as well separated as it can be
const order = [];
const rest = best.slice();
while (rest.length) {
  let pi = 0;
  let pd = -1;
  rest.forEach((c, i) => {
    const d = Math.min(...[...fixed, ...order].map((x) => dist(c, x)));
    if (d > pd) {
      pd = d;
      pi = i;
    }
  });
  order.push(rest.splice(pi, 1)[0]);
}
console.log("min dE:", bestScore.toFixed(2));
console.log(JSON.stringify(order));
