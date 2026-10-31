// Searches for a character-color palette that stays distinguishable under
// protanopia/deuteranopia/tritanopia (max-min CIEDE2000, victim red included)
// within a luminance/chroma band that keeps >=3:1 contrast with white token
// text and both cell backgrounds. Randomized: run it a few times and keep the
// best; then put the result (ordered so every prefix is well separated) in
// CHARACTER_COLORS (src/model/puzzle.js + the copy in model/migrations.js).
//   node tools/find-palette.mjs
import { dE00, lab, sim, lum, contrast } from "../test/cvd-sim.js";
const DANGER="#a83a2e";
const toHex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join("");
// candidate pool: sRGB grid, filtered by luminance band (contrast >=3 vs white and vs dark cell bg)
const pool=[]; const N=24;
for(let r=0;r<=N;r++)for(let g=0;g<=N;g++)for(let b=0;b<=N;b++){ const h=toHex(r/N,g/N,b/N); const L=lum(h); if(L<0.15||L>0.28) continue; if(contrast(h,"#ffffff")<3.1||contrast(h,"#2a231c")<3.1) continue; { const [, a, bb] = lab(sim(h, null)); const c=Math.hypot(a,bb); if(c<30||c>62) continue; pool.push(h);} }
console.log("pool",pool.length);
const types=[null,"prot","deut","trit"];
const labs=new Map(); const getLab=(h,t)=>{const k=h+t; if(!labs.has(k)) labs.set(k,lab(sim(h,t))); return labs.get(k);};
const dist=(a,b)=>Math.min(...types.map(t=>dE00(getLab(a,t),getLab(b,t))));
// greedy max-min with fixed danger, then local improvement
let chosen=[DANGER];
const score=(set)=>{let m=1e9; for(let i=0;i<set.length;i++)for(let j=i+1;j<set.length;j++) m=Math.min(m,dist(set[i],set[j])); return m;};
// random subsample of pool for speed
const rnd=(n)=>Math.floor(Math.random()*n);
const sample=Array.from({length:4000},()=>pool[rnd(pool.length)]);
while(chosen.length<11){ let best=null,bd=-1; for(const c of sample){ const d=Math.min(...chosen.map(x=>dist(c,x))); if(d>bd){bd=d;best=c;} } chosen.push(best); }
let cur=score(chosen); console.log("greedy",cur.toFixed(1));
for(let it=0;it<20000;it++){ const i=1+rnd(10); const cand=sample[rnd(sample.length)]; const trial=chosen.slice(); trial[i]=cand; const s=score(trial); if(s>=cur){chosen=trial;cur=s;} }
console.log("optimized min dE:",cur.toFixed(1)); console.log(JSON.stringify(chosen.slice(1)));
