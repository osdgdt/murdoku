import { buildIssueUrl, ISSUES_URL } from "../src/util/errorReport.js";
import { assert } from "./assert.js";

export const tests = [
  {
    name: "errorReport: l'URL della segnalazione è una issue precompilata con titolo, pagina e dettagli tecnici",
    fn: () => {
      const url = buildIssueUrl({ message: "TypeError: x is undefined\nat foo", stack: "TypeError: x\n at a.js:1", page: "/player.html?id=a", lang: "en", userAgent: "UA/1.0" });
      assert(url.startsWith(ISSUES_URL + "?title="));
      const params = new URL(url).searchParams;
      assert(params.get("title").startsWith("[auto] TypeError: x is undefined"));
      assert(!params.get("title").includes("\n"), "il titolo è su una riga");
      const body = params.get("body");
      assert(body.includes("/player.html?id=a") && body.includes("Language: en") && body.includes("UA/1.0") && body.includes("a.js:1"));
    },
  },
  {
    name: "errorReport: uno stack enorme viene troncato per restare entro il limite degli URL",
    fn: () => {
      const url = buildIssueUrl({ message: "boom", stack: "x".repeat(50000), page: "/", lang: "it", userAgent: "UA" });
      assert(url.length <= 7000, `URL troppo lungo: ${url.length}`);
      assert(new URL(url).searchParams.get("body").includes("truncated"));
    },
  },
];
