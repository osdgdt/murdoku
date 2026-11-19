// The key of the backend deploy as it arrives in a GitHub secret (tools/lib/service-account.mjs): what a copy and paste does to
// it, and what is repaired. The "key" here is made up (random-looking base64): the repair is text handling only.
import { parseKeyText, cleanPem, describePem } from "../tools/lib/service-account.mjs";
import { assert, assertEqual } from "./assert.js";

// a made-up PKCS#8-looking body: 1624 base64 characters in lines of 64, ending with "=" as a key whose length is not a multiple of 3 does
const body =
  Array.from({ length: 1623 }, (_, i) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[(i * 7 + (i >> 3)) % 64]).join(
    ""
  ) + "=";
const wrapPem = (b) => `-----BEGIN PRIVATE KEY-----\n${b.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
const lines = body.match(/.{1,64}/g);
const PEM = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
const keyJson = (privateKey) =>
  JSON.stringify(
    { type: "service_account", project_id: "p", client_email: "a@p.iam.gserviceaccount.com", private_key: privateKey },
    null,
    2
  );

export const tests = [
  {
    name: "chiave di rilascio: il file così com'è, o in base64 (una riga o a capo ogni 76), si legge; altro no, senza citare il testo",
    fn: () => {
      const file = keyJson(PEM);
      const plain = parseKeyText(file);
      assertEqual(plain.how, "as it is");
      assertEqual(plain.key.project_id, "p");
      const oneLine = parseKeyText(btoa(file));
      assertEqual(oneLine.how, "decoded from base64");
      assertEqual(oneLine.key.client_email, "a@p.iam.gserviceaccount.com");
      const wrapped = parseKeyText(btoa(file).replace(/(.{76})/g, "$1\n"));
      assertEqual(wrapped.how, "decoded from base64");
      const empty = parseKeyText("  ");
      assertEqual(empty.key, null);
      assertEqual(empty.problem, "empty");
      const junk = parseKeyText("questa non è una chiave");
      assertEqual(junk.key, null);
      assertEqual(junk.problem, "not-json");
      assert(!JSON.stringify(junk).includes("chiave"), "il testo del segreto non viene mai riportato");
      const cut = parseKeyText(file.slice(0, 200));
      assertEqual(cut.key, null);
      assertEqual(cut.startsWithBrace, true);
      assertEqual(cut.endsWithBrace, false);
    },
  },
  {
    name: "chiave di rilascio: a capo diventati spazi, «\\n» scritti, righe unite, CRLF o rientri si riparano e danno la stessa chiave",
    fn: () => {
      assertEqual(cleanPem(PEM), PEM);
      const damaged = {
        "spazi al posto degli a capo": PEM.trimEnd().replace(/\n/g, " "),
        "backslash-n scritti come testo": PEM.trimEnd().replace(/\n/g, "\\n"),
        "righe unite": `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`,
        CRLF: PEM.replace(/\n/g, "\r\n"),
        "rientri e righe vuote": PEM.replace(/\n/g, "\n  \n  "),
      };
      for (const [what, text] of Object.entries(damaged)) assertEqual(cleanPem(text), PEM, what);
      // il caso trovato nella realtà: il «=» finale perso (1623 caratteri invece di 1624), che OpenSSL non perdona
      assertEqual(cleanPem(wrapPem(body.slice(0, -1))), PEM, "il = finale ritrovato");
      // con «==» in fondo, uno o tutti e due persi
      const two = body.slice(0, -2) + "==";
      for (const lost of [two.slice(0, -1), two.slice(0, -2)])
        assertEqual(cleanPem(wrapPem(lost)), wrapPem(two), `${lost.length} caratteri`);
      // e attraverso il JSON, come arriva davvero (la chiave privata è una stringa JSON con i suoi \n)
      assertEqual(cleanPem(parseKeyText(keyJson(PEM.trimEnd().replace(/\n/g, " "))).key.private_key), PEM);
      assertEqual(cleanPem(parseKeyText(keyJson(PEM.replace(/\n/g, "\\n"))).key.private_key), PEM, "\\n doppiamente scritto");
    },
  },
  {
    name: "chiave di rilascio: senza blocco PEM non c'è chiave; i numeri distinguono una chiave intera da una tagliata",
    fn: () => {
      assertEqual(cleanPem("abc"), null);
      assertEqual(cleanPem(undefined), null);
      assertEqual(cleanPem("-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----"), null);
      assertEqual(cleanPem("-----END PRIVATE KEY-----\n-----BEGIN PRIVATE KEY-----\nAAAA"), null, "ordine sbagliato");
      const whole = describePem(PEM);
      assertEqual(whole.chars, 1624);
      assertEqual(whole.lines, 26);
      assertEqual(whole.looksComplete, true);
      assertEqual(
        describePem(cleanPem(`-----BEGIN PRIVATE KEY-----\n${body.slice(0, 900)}\n-----END PRIVATE KEY-----`)).looksComplete,
        false,
        "tagliata"
      );
      // un carattere perso IN MEZZO non si ripara: il testo non torna quello della chiave (e OpenSSL la rifiuterà)
      assert(cleanPem(wrapPem(body.slice(0, 700) + body.slice(701))) !== PEM, "manca un carattere");
      assertEqual(describePem(cleanPem(wrapPem(body.slice(0, 1200)))).looksComplete, false, "metà chiave");
      assertEqual(describePem(cleanPem(wrapPem(body.slice(0, -1)))).looksComplete, true, "il = finale perso invece sì");
    },
  },
];
