// The QR code generator (src/community/qr.js). It was checked once against an independent decoder (jsQR) and an
// independent generator on 64 texts, every version from 1 to 10 at both levels, at the edges of each capacity:
// all decoded. What is kept here guards it from then on: the capacities of the standard, the structure of the
// symbol (finders, timing, format and version information) and the exact matrix of a few texts.
import { qrMatrix, qrSvg, capacityBytes, MAX_VERSION } from "../src/community/qr.js";
import { assert, assertEqual } from "./assert.js";

const KNOWN_CAPACITY = {
  M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
  L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
};
const sha = async (modules) => {
  const text = modules.map((row) => row.map((v) => (v ? "1" : "0")).join("")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
// the BCH(15,5) code of the format information, worked out the slow way (polynomial division by 10100110111)
function formatBits(eccBits, mask) {
  let value = ((eccBits << 3) | mask) << 10;
  for (let bit = 14; bit >= 10; bit--) if ((value >>> bit) & 1) value ^= 0b10100110111 << (bit - 10);
  return ((((eccBits << 3) | mask) << 10) | value) ^ 0b101010000010010;
}
function versionBits(version) {
  let value = version << 12;
  for (let bit = 17; bit >= 12; bit--) if ((value >>> bit) & 1) value ^= 0b1111100100101 << (bit - 12);
  return (version << 12) | value;
}

export const tests = [
  {
    name: "QR: le capacità in byte di ogni versione (1-10, livelli L e M) sono quelle dello standard, e la versione scelta è la più piccola che basta",
    fn: () => {
      for (const ecc of ["M", "L"]) {
        KNOWN_CAPACITY[ecc].forEach((expected, i) => assertEqual(capacityBytes(i + 1, ecc), expected, `versione ${i + 1}, livello ${ecc}`));
        for (let version = 1; version <= MAX_VERSION; version++) {
          const cap = capacityBytes(version, ecc);
          assertEqual(qrMatrix("x".repeat(cap), { ecc }).version, version, `${cap} byte stanno nella versione ${version} (${ecc})`);
          if (version < MAX_VERSION)
            assertEqual(qrMatrix("x".repeat(cap + 1), { ecc }).version, version + 1, `un byte in più: versione ${version + 1}`);
        }
      }
      let error = null;
      try {
        qrMatrix("x".repeat(214));
      } catch (e) {
        error = e;
      }
      assert(error, "oltre la capacità della versione 10 si rifiuta, invece di produrre un codice illeggibile");
      error = null;
      try {
        qrMatrix("x", { ecc: "H" });
      } catch (e) {
        error = e;
      }
      assert(error, "un livello non supportato si rifiuta");
      assertEqual(qrMatrix("è").version, 1, "il testo è contato in byte UTF-8 (2 per «è»)");
      assertEqual(qrMatrix("x".repeat(13) + "è").version, 2, "13 + 2 byte non stanno nella versione 1 (14 byte)");
    },
  },
  {
    name: "QR: struttura del simbolo — tre marcatori, linee di sincronismo, modulo scuro, informazioni di formato (due copie valide) e di versione",
    fn: () => {
      for (const [text, ecc] of [
        ["ACDEFGHJ", "M"],
        ["https://osdgdt.github.io/murdoku/player.html?c=ACDEFGHJ", "M"],
        ["https://osdgdt.github.io/murdoku/player.html?c=ACDEFGHJ", "L"],
        ["y".repeat(120), "M"], // version 8: has the version information
        ["z".repeat(200), "L"], // version 9 or 10
      ]) {
        const { modules: m, size, version, mask } = qrMatrix(text, { ecc });
        assertEqual(size, 17 + 4 * version);
        // finders: 7x7 with the 1:1:3:1:1 profile, light separators around
        const finderAt = (r0, c0) => {
          for (let dr = -1; dr <= 7; dr++)
            for (let dc = -1; dc <= 7; dc++) {
              const r = r0 + dr;
              const c = c0 + dc;
              if (r < 0 || c < 0 || r >= size || c >= size) continue;
              const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
              const expected = inside && Math.max(Math.abs(dr - 3), Math.abs(dc - 3)) !== 2;
              assertEqual(m[r][c], expected, `marcatore in (${r0},${c0}), modulo (${dr},${dc})`);
            }
        };
        finderAt(0, 0);
        finderAt(0, size - 7);
        finderAt(size - 7, 0);
        for (let i = 8; i < size - 8; i++) {
          assertEqual(m[6][i], i % 2 === 0, `sincronismo orizzontale ${i}`);
          assertEqual(m[i][6], i % 2 === 0, `sincronismo verticale ${i}`);
        }
        assertEqual(m[size - 8][8], true, "modulo scuro");
        // format information, two copies, each the BCH code of (level, mask)
        const expected = formatBits(ecc === "L" ? 1 : 0, mask);
        const copyOne = [];
        for (let i = 0; i <= 5; i++) copyOne[i] = m[i][8];
        copyOne[6] = m[7][8];
        copyOne[7] = m[8][8];
        copyOne[8] = m[8][7];
        for (let i = 9; i < 15; i++) copyOne[i] = m[8][14 - i];
        const copyTwo = [];
        for (let i = 0; i < 8; i++) copyTwo[i] = m[8][size - 1 - i];
        for (let i = 8; i < 15; i++) copyTwo[i] = m[size - 15 + i][8];
        const asNumber = (bits) => bits.reduce((n, bit, i) => n | ((bit ? 1 : 0) << i), 0);
        assertEqual(asNumber(copyOne), expected, "formato, prima copia");
        assertEqual(asNumber(copyTwo), expected, "formato, seconda copia");
        if (version >= 7) {
          const info = versionBits(version);
          for (let i = 0; i < 18; i++) {
            const bit = ((info >>> i) & 1) === 1;
            assertEqual(m[Math.floor(i / 3)][size - 11 + (i % 3)], bit, `versione, copia alta, bit ${i}`);
            assertEqual(m[size - 11 + (i % 3)][Math.floor(i / 3)], bit, `versione, copia bassa, bit ${i}`);
          }
        }
      }
    },
  },
  {
    name: "QR: matrici esatte di alcuni testi (già decodificate con un lettore esterno): ogni modifica involontaria dell'algoritmo le cambia",
    fn: async () => {
      const link = "https://osdgdt.github.io/murdoku/player.html?c=ACDEFGHJ";
      const long =
        "https://example.org/murdoku/player.html?c=KQ3YXN46 con un testo piuttosto lungo per arrivare a una versione più alta del codice QR, ben oltre la quarta";
      const golden = [
        [link, "M", "9495874285f6af427883715c"],
        [link, "L", "e3ca3933c29454443ba78e20"],
        ["ACDEFGHJ", "M", "170162692ac4f7af1805932b"],
        ["ACDEFGHJ", "L", "d57b1bfafa4762573d48adea"],
        ["Murdoku è bello", "M", "33e36e4ff219790657f515d2"],
        [long, "M", "1dbf70f08ad9d3b8998f37ac"],
        [long, "L", "9a1f0a647bb16f8cc52b2483"],
      ];
      for (const [text, ecc, prefix] of golden) {
        const { modules } = qrMatrix(text, { ecc });
        assert((await sha(modules)).startsWith(prefix), `matrice di «${text.slice(0, 24)}…» (${ecc})`);
      }
      assertEqual(JSON.stringify(qrMatrix(link).modules), JSON.stringify(qrMatrix(link).modules), "deterministico");
    },
  },
  {
    name: "QR: l'SVG ha la zona di silenzio di 4 moduli, una sola figura scura, nessuno script né riferimento esterno, e il titolo è protetto",
    fn: () => {
      const { size } = qrMatrix("ACDEFGHJ");
      const svg = qrSvg("ACDEFGHJ", { scale: 5, title: 'Codice <b>"x"</b> & co' });
      assert(svg.startsWith("<svg "), "è un SVG");
      assert(svg.includes(`viewBox="0 0 ${size + 8} ${size + 8}"`), "zona di silenzio di 4 moduli per lato");
      assert(svg.includes(`width="${(size + 8) * 5}"`), "la scala si applica");
      assertEqual((svg.match(/<path /g) || []).length, 1, "un solo tracciato scuro");
      assert(!/<script|href=|on[a-z]+=|javascript:/i.test(svg), "niente di attivo né esterno");
      assert(svg.includes("&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; co"), "il titolo è reso innocuo");
      assert(!svg.includes("<b>"), "nessun tag nel titolo");
      assert(qrSvg("ACDEFGHJ", { dark: "#112233", light: "#fefefe" }).includes('fill="#112233"'), "i colori si scelgono");
      assert(!qrSvg("ACDEFGHJ").includes("aria-label"), "senza titolo non c'è etichetta");
    },
  },
];
