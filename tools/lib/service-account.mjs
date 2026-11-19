// The service-account key of the backend deploy (.github/workflows/deploy-backend.yml), as it arrives in a GitHub secret after
// being copied and pasted by hand. Pure text handling, so that it can be tested: no crypto, no network, nothing printed.
//
// What goes wrong when a key travels through a clipboard: the line breaks of the private key turn into spaces, or into the two
// characters "\n", or are lost altogether; the whole file may be sent as one line of base64 on purpose. All of that is repaired
// here. A character that is missing or changed cannot be repaired: `describePem` gives the numbers that show it.

const BEGIN = "-----BEGIN PRIVATE KEY-----";
const END = "-----END PRIVATE KEY-----";

// The text of the secret -> { key, how } with the key object, or { key: null, problem } saying what is wrong.
export function parseKeyText(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { key: null, problem: "empty" };
  let candidates = [{ text, how: "as it is" }];
  if (!text.startsWith("{")) {
    // maybe the whole file as base64 (what `base64 -w0 key.json` prints)
    try {
      const bytes = Uint8Array.from(atob(text.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes).trim();
      if (decoded.startsWith("{")) candidates = [{ text: decoded, how: "decoded from base64" }];
    } catch {
      // not base64 either
    }
  }
  for (const { text: json, how } of candidates) {
    try {
      const key = JSON.parse(json);
      if (key && typeof key === "object") return { key, how };
    } catch {
      // not JSON: said below, without quoting the text (it is a secret)
    }
  }
  return {
    key: null,
    problem: "not-json",
    startsWithBrace: text.startsWith("{"),
    endsWithBrace: text.endsWith("}"),
  };
}

// The private key as a clean PEM: line breaks, spaces, "\n" written as text and CRLF all rebuilt as 64-character lines.
// Returns null when there is no PEM at all.
export function cleanPem(value) {
  const text = String(value ?? "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n");
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < start) return null;
  const body = text.slice(start + BEGIN.length, end).replace(/[^A-Za-z0-9+/=]/g, "");
  if (!body) return null;
  return `${BEGIN}\n${body.match(/.{1,64}/g).join("\n")}\n${END}\n`;
}

// The numbers that tell a whole key from a damaged one (a 2048-bit RSA key in PKCS#8 has a body of about 1624 characters).
export function describePem(pem) {
  const lines = String(pem ?? "")
    .trim()
    .split("\n")
    .slice(1, -1);
  const chars = lines.reduce((sum, line) => sum + line.length, 0);
  return { lines: lines.length, chars, looksComplete: chars >= 1500 && chars <= 1800 && chars % 4 === 0 };
}
