// A small QR code generator with no dependencies, for the link of a published case ("scan it with the phone").
// Byte mode, error correction level L or M (M by default), versions 1 to 10 (up to 213 bytes at M: the link of a
// case is about 60). Written after ISO/IEC 18004 and checked against two independent implementations (a decoder
// and a reference generator, see test/test-qr.js for what is kept in the repository).
//
//   qrMatrix("https://...")        -> { size, version, mask, modules: boolean[][] }  (true = dark)
//   qrSvg("https://...", options)  -> the SVG text, ready to put in the page (no scripts, no external references)

// ---- tables ---------------------------------------------------------------------------------------------------------
// Per version (1-10): [error-correction codewords per block, [blocks, data codewords per block], ...groups]
const BLOCKS = {
  L: [
    null,
    [7, [1, 19]],
    [10, [1, 34]],
    [15, [1, 55]],
    [20, [1, 80]],
    [26, [1, 108]],
    [18, [2, 68]],
    [20, [2, 78]],
    [24, [2, 97]],
    [30, [2, 116]],
    [18, [2, 68], [2, 69]],
  ],
  M: [
    null,
    [10, [1, 16]],
    [16, [1, 28]],
    [26, [1, 44]],
    [18, [2, 32]],
    [24, [2, 43]],
    [16, [4, 27]],
    [18, [4, 31]],
    [22, [2, 38], [2, 39]],
    [22, [3, 36], [2, 37]],
    [26, [4, 43], [1, 44]],
  ],
};
const ECC_BITS = { L: 1, M: 0 }; // the two bits that say the level, in the format information
const ALIGNMENT = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
export const MAX_VERSION = 10;

const dataCodewords = (version, ecc) => BLOCKS[ecc][version].slice(1).reduce((sum, [blocks, size]) => sum + blocks * size, 0);
// bytes that fit in byte mode: 4 bits of mode and 8 (versions 1-9) or 16 (10) of length come first
export const capacityBytes = (version, ecc = "M") => Math.floor((dataCodewords(version, ecc) * 8 - 4 - (version < 10 ? 8 : 16)) / 8);

// ---- Reed-Solomon over GF(256) (x^8 + x^4 + x^3 + x^2 + 1) --------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generatorPolynomial(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((coefficient, j) => {
      next[j] ^= coefficient;
      next[j + 1] ^= gfMul(coefficient, EXP[i]);
    });
    poly = next;
  }
  return poly;
}

function remainder(data, degree) {
  const generator = generatorPolynomial(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMul(generator[i + 1], factor);
  }
  return result;
}

// ---- the message ----------------------------------------------------------------------------------------------------
function encodeData(bytes, version, ecc) {
  const bits = [];
  const put = (value, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4); // byte mode
  put(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) put(byte, 8);
  const total = dataCodewords(version, ecc) * 8;
  put(0, Math.min(4, total - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  for (let pad = 0xec; bits.length < total; pad ^= 0xec ^ 0x11) put(pad, 8);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  return codewords;
}

// Splits into blocks, adds the error correction of each, and interleaves (data first, then correction).
function interleave(codewords, version, ecc) {
  const [eccPerBlock, ...groups] = BLOCKS[ecc][version];
  const blocks = [];
  let at = 0;
  for (const [count, size] of groups)
    for (let i = 0; i < count; i++) {
      const data = codewords.slice(at, at + size);
      at += size;
      blocks.push({ data, ecc: remainder(data, eccPerBlock) });
    }
  const out = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  for (let i = 0; i < eccPerBlock; i++) for (const block of blocks) out.push(block.ecc[i]);
  return out;
}

// ---- the matrix -----------------------------------------------------------------------------------------------------
function bchFormat(data) {
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersion(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function buildMatrix(version, ecc, codewords, mask) {
  const size = 17 + 4 * version;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, dark, fixed = true) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = dark;
    if (fixed) reserved[r][c] = true;
  };

  // finders with their separators, timing lines, alignment patterns, the dark module
  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++)
      for (let dc = -1; dc <= 7; dc++) {
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3)); // 3 = the outer dark ring, 2 = the light ring
        set(r0 + dr, c0 + dc, inside && ring !== 2); // outside the 7x7 square: the light separator
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const centres = ALIGNMENT[version];
  for (const r of centres)
    for (const c of centres) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  set(size - 8, 8, true); // the dark module
  // the places the format and version information will go
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  if (version >= 7)
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }

  // the data, in the zigzag of two-column strips from the right, skipping the column of the vertical timing line
  const bits = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = ((right + 1) & 2) === 0 ? size - 1 - step : step; // upwards in the first strip, then alternating
      for (let c = right; c >= right - 1; c--) {
        if (reserved[row][c]) continue;
        const dark = bit < bits.length ? bits[bit] === 1 : false;
        bit++;
        const flip = MASKS[mask](row, c);
        modules[row][c] = dark !== flip;
      }
    }
  }

  // format information (two copies) and, from version 7, the version information (two copies)
  const format = bchFormat((ECC_BITS[ecc] << 3) | mask);
  const bitOf = (i) => ((format >>> i) & 1) === 1;
  // first copy, around the top-left finder
  for (let i = 0; i <= 5; i++) set(i, 8, bitOf(i));
  set(7, 8, bitOf(6));
  set(8, 8, bitOf(7));
  set(8, 7, bitOf(8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, bitOf(i));
  // second copy, split between the other two finders
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, bitOf(i));
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, bitOf(i));
  set(size - 8, 8, true);
  if (version >= 7) {
    const info = bchVersion(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((info >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  return modules;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// The four penalty rules of the standard: the mask with the lowest total wins.
function penalty(m) {
  const size = m.length;
  let total = 0;
  const run = (line) => {
    let score = 0;
    let length = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) length++;
      else {
        if (length >= 5) score += 3 + (length - 5);
        length = 1;
      }
    }
    return score;
  };
  const pattern = [true, false, true, true, true, false, true]; // 1:1:3:1:1
  const finderLike = (line) => {
    let score = 0;
    for (let i = 0; i + 7 <= line.length; i++) {
      if (!pattern.every((v, k) => line[i + k] === v)) continue;
      const before = i >= 4 && [0, 1, 2, 3].every((k) => line[i - 1 - k] === false);
      const after = i + 7 + 4 <= line.length && [0, 1, 2, 3].every((k) => line[i + 7 + k] === false);
      if (before || after) score += 40;
    }
    return score;
  };
  for (let r = 0; r < size; r++) {
    const row = m[r];
    const column = m.map((line) => line[r]);
    total += run(row) + run(column) + finderLike(row) + finderLike(column);
  }
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) total += 3;
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  total += 10 * Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
  return total;
}

// ---- public ---------------------------------------------------------------------------------------------------------
export function qrMatrix(text, { ecc = "M" } = {}) {
  if (!(ecc in ECC_BITS)) throw new Error(`Livello di correzione non supportato: ${ecc}`);
  const bytes = [...new TextEncoder().encode(String(text))];
  let version = 1;
  while (version <= MAX_VERSION && capacityBytes(version, ecc) < bytes.length) version++;
  if (version > MAX_VERSION) throw new Error("Testo troppo lungo per il codice QR.");
  const codewords = interleave(encodeData(bytes, version, ecc), version, ecc);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const modules = buildMatrix(version, ecc, codewords, mask);
    const score = penalty(modules);
    if (best === null || score < best.score) best = { score, mask, modules };
  }
  return { size: best.modules.length, version, mask: best.mask, modules: best.modules };
}

// An SVG of the code: dark squares on a light background with the quiet zone the standard asks for (4 modules).
export function qrSvg(text, { ecc = "M", scale = 6, margin = 4, dark = "#000000", light = "#ffffff", title = "" } = {}) {
  const { size, modules } = qrMatrix(text, { ecc });
  const total = size + 2 * margin;
  const path = [];
  modules.forEach((row, r) =>
    row.forEach((on, c) => {
      if (on) path.push(`M${c + margin} ${r + margin}h1v1h-1z`);
    })
  );
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * scale}" height="${total * scale}" shape-rendering="crispEdges" role="img"${title ? ` aria-label="${esc(title)}"` : ""}>` +
    `<rect width="${total}" height="${total}" fill="${esc(light)}"/><path d="${path.join("")}" fill="${esc(dark)}"/></svg>`
  );
}
