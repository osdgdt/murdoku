// Checks the Firebase service-account key that .github/workflows/deploy-backend.yml deploys with, repairs what a copy and paste
// can have done to it, says what is wrong when it cannot, and writes the clean key for firebase-tools. It prints nothing secret:
// only lengths, the (public) project and account names, and what Google answers when the key is used to ask for an access token.
//   FIREBASE_SERVICE_ACCOUNT=... node tools/check-service-account.mjs <expected-project-id> <file-to-write>
// The secret may be the content of the .json file as it is, or that content as one line of base64. Exits 1 on any problem, so the
// deploy stops here with a clear message instead of firebase-tools' "Failed to authenticate".
import { createRequire } from "node:module";
import { createPrivateKey } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { parseKeyText, cleanPem, describePem } from "./lib/service-account.mjs";

const root = path.resolve(import.meta.dirname, "..");
const [expectedProject = "", outFile = ""] = process.argv.slice(2);
const raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";

const say = (text) => console.log(text);
const stop = (text) => {
  console.log(`✗ ${text}`);
  process.exit(1);
};
const AGAIN =
  "Create a new JSON key for the service account and put it in the secret again (docs/community-setup.md, step 3): " +
  "the safest way is the one-line base64 form, see the note there.";

say(`The secret holds ${raw.length} characters (the JSON file of a key is about 2350, its base64 about 3140).`);
const parsed = parseKeyText(raw);
if (!parsed.key) {
  if (parsed.problem === "empty") stop("FIREBASE_SERVICE_ACCOUNT is empty.");
  stop(
    `The secret is neither the JSON file of a key nor its base64 (it ${parsed.startsWithBrace ? "does" : "does NOT"} start with "{" and ` +
      `${parsed.endsWithBrace ? "does" : "does NOT"} end with "}"): it was cut or changed when it was pasted. ${AGAIN}`
  );
}
const key = parsed.key;
say(`The secret is ${parsed.how}.`);
if (key.type !== "service_account") stop(`The JSON is not a service-account key (its "type" is ${JSON.stringify(key.type)}).`);
say(`project_id: ${key.project_id}`);
say(`client_email: ${key.client_email}`);
if (expectedProject && key.project_id !== expectedProject)
  stop(`The key belongs to project "${key.project_id}", not to "${expectedProject}".`);

const pem = cleanPem(key.private_key);
if (!pem) stop(`The "private_key" has no -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY----- block. ${AGAIN}`);
const shape = describePem(pem);
say(`private_key: ${shape.chars} characters in ${shape.lines} lines (a whole key: about 1624 in 26-27 lines).`);
try {
  createPrivateKey(pem);
} catch {
  stop(
    `The private key cannot be read: ${shape.looksComplete ? "some characters of it were changed" : "it is cut or has lost characters"} ` +
      `when it was pasted. ${AGAIN}`
  );
}
key.private_key = pem;

// what Google answers when the key is used: the real test
try {
  const { GoogleAuth } = createRequire(path.join(root, "test", "rules", "package.json"))("google-auth-library");
  const auth = new GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await (await auth.getClient()).getAccessToken();
  if (!token?.token) throw new Error("no token returned");
  say("✓ Google accepted the key and gave an access token.");
} catch (error) {
  stop(
    `Google refused the key: ${String(error?.message ?? error).slice(0, 300)}\n` +
      '  ("invalid_grant" means the key was deleted or disabled, or the service account no longer exists.) ' +
      AGAIN
  );
}
if (outFile) {
  writeFileSync(outFile, JSON.stringify(key), { mode: 0o600 });
  say("The clean key was written for the deploy.");
}
