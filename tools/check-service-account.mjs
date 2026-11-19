// Checks the Firebase service-account key that .github/workflows/deploy-backend.yml deploys with, and says what is wrong with it,
// printing nothing secret: only the length, the shape, the (public) project and account names, and what Google answers when the key
// is used to ask for an access token. Reads the key from the FIREBASE_SERVICE_ACCOUNT environment variable.
//   node tools/check-service-account.mjs [expected-project-id]
// Exits 1 on any problem, so the deploy stops here with a clear message instead of "Failed to authenticate".
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const expectedProject = process.argv[2] || "";
const raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";

const problems = [];
const say = (text) => console.log(text);
const fail = (text) => {
  problems.push(text);
  console.log(`✗ ${text}`);
};

say(`The secret holds ${raw.length} characters (a real key is about 2300).`);
if (!raw.trim()) {
  fail("FIREBASE_SERVICE_ACCOUNT is empty.");
  process.exit(1);
}

let key = null;
try {
  key = JSON.parse(raw);
} catch {
  // the parser's message quotes the start of the text: it is not printed, in case the secret is not what it should be
  fail(
    `The secret is not valid JSON. It must be the WHOLE content of the .json file downloaded from Google Cloud, from the first "{" to the last "}"` +
      ` (it ${raw.trim().startsWith("{") ? "does" : "does NOT"} start with "{" and ${raw.trim().endsWith("}") ? "does" : "does NOT"} end with "}").` +
      ` Paste it again, taking care that the text is not cut or wrapped.`
  );
  process.exit(1);
}

if (key?.type !== "service_account")
  fail(`The JSON is not a service-account key (its "type" is ${JSON.stringify(key?.type)}): create a JSON key for the service account.`);
say(`project_id: ${key?.project_id}`);
say(`client_email: ${key?.client_email}`);
if (expectedProject && key?.project_id !== expectedProject)
  fail(`The key belongs to project "${key?.project_id}", not to "${expectedProject}".`);
const pem = String(key?.private_key ?? "");
if (!pem.startsWith("-----BEGIN PRIVATE KEY-----") || !pem.trimEnd().endsWith("-----END PRIVATE KEY-----"))
  fail('The "private_key" is missing or cut: it must start with -----BEGIN PRIVATE KEY----- and end with -----END PRIVATE KEY-----.');
else if (!pem.includes("\n")) fail('The "private_key" has lost its line breaks: paste the file content as it is, without editing it.');
if (problems.length) process.exit(1);

// what Google answers when the key is used: the real test
try {
  const { GoogleAuth } = createRequire(path.join(root, "test", "rules", "package.json"))("google-auth-library");
  const auth = new GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await (await auth.getClient()).getAccessToken();
  if (!token?.token) throw new Error("no token returned");
  say("✓ Google accepted the key and gave an access token.");
} catch (error) {
  fail(
    `Google refused the key: ${String(error?.message ?? error).slice(0, 300)}\n` +
      '  ("invalid_grant" means the key was deleted or disabled, or the service account no longer exists: create a new JSON key.)'
  );
  process.exit(1);
}
