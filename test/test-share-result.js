import { buildShareText } from "../src/util/shareResult.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "shareResult: il testo condiviso contiene titolo e tempo ma nessuno spoiler",
    fn: () => {
      const text = buildShareText({ title: "Caso 1", elapsedSeconds: 151, hintsUsed: 0, url: "https://x.test/" });
      assert(text.includes("Caso 1") && text.includes("2:31") && text.includes("https://x.test/"));
      assert(!/assassino|murderer/i.test(text), "niente spoiler");
    },
  },
  {
    name: "shareResult: con suggerimenti usati lo dice",
    fn: () => {
      assertEqual(buildShareText({ title: "T", elapsedSeconds: 5, hintsUsed: 2 }).includes("suggerimenti usati: 2"), true);
    },
  },
];
