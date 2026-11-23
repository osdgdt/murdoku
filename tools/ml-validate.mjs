// `node tools/ml-validate.mjs < input.json > report.json` — see tools/lib/ml-validate.mjs for the shape of both.
// Python reads this through ml/murdoku_ml/validate.py. The exit status is 0 whenever a report could be written (even for an
// invalid case: it is in the report), 2 when the input is not JSON.
globalThis.__MURDOKU_LANG__ = "it"; // the messages of the model are in Italian (set before the modules load: they read it when imported)
const { validateForMl } = await import("./lib/ml-validate.mjs");

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch (error) {
  console.error(`input non JSON: ${error.message}`);
  process.exit(2);
}
process.stdout.write(JSON.stringify(validateForMl(input)));
