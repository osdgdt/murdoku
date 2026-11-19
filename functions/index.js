// Entry point of the Cloud Functions of the shared case database. All the logic is in src/handlers.js (and the rules in
// shared/src/community/casePolicy.js, a generated copy of the page's own module): this file only wires it to Firebase.
//
// No top-level `await` on purpose: the Functions emulator loads this file with require(), which refuses an ES module graph
// that contains one (casePolicy.js pulls in the app's i18n, which has one). The modules are imported on the first call.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";

// Keep in step with FUNCTIONS_REGION in src/community/config.js (the page names the region when it calls).
const REGION = "europe-west1";
// A ceiling on the instances (and so on the bill) in case somebody floods the endpoints.
setGlobalOptions({ region: REGION, maxInstances: 5, timeoutSeconds: 60, memory: "256MiB" });

initializeApp();
const db = getFirestore();

// What the handlers need of Firestore (see the top of src/handlers.js).
const read = (snapshot) => ({ exists: snapshot.exists, data: snapshot.data() });
const store = {
  async get(path) {
    return read(await db.doc(path).get());
  },
  runTransaction(fn) {
    // (async: the real Firestore wants a Promise back from the callback, even from a handler that only writes)
    return db.runTransaction(async (t) =>
      fn({
        async get(path) {
          return read(await t.get(db.doc(path)));
        },
        create: (path, data) => t.create(db.doc(path), data),
        set: (path, data) => t.set(db.doc(path), data),
        update: (path, patch) => t.update(db.doc(path), patch),
        delete: (path) => t.delete(db.doc(path)),
      })
    );
  },
  deleteTree: (path) => db.recursiveDelete(db.doc(path)),
  // reads outside a transaction: -> [{ path, data }]
  async list(collection) {
    return (await db.collection(collection).get()).docs.map((d) => ({ path: d.ref.path, data: d.data() }));
  },
  async where(collection, field, value) {
    return (await db.collection(collection).where(field, "==", value).get()).docs.map((d) => ({ path: d.ref.path, data: d.data() }));
  },
  async groupWhere(group, field, value) {
    return (await db.collectionGroup(group).where(field, "==", value).get()).docs.map((d) => ({ path: d.ref.path, data: d.data() }));
  },
};

let ready = null;
function load() {
  ready ??= (async () => {
    // casePolicy.js pulls in the app's own model, which words its messages through i18n: pin a language, no browser here.
    globalThis.__MURDOKU_LANG__ = "it";
    const policy = await import("./shared/src/community/casePolicy.js");
    const { createHandlers, CaseError } = await import("./src/handlers.js");
    return { handlers: createHandlers({ store, policy, randomInt: (n) => randomInt(n) }), CaseError };
  })();
  return ready;
}

// A refusal of the domain becomes a callable error the page can read (`details.reason`); anything else is a bug: logged, hidden.
const wrap = (name) =>
  onCall(async (request) => {
    const { handlers, CaseError } = await load();
    try {
      return await handlers[name](request.data, request.auth ? { uid: request.auth.uid } : null);
    } catch (error) {
      if (error instanceof CaseError) throw new HttpsError(error.code, error.reason, error.details);
      console.error(error);
      throw new HttpsError("internal", "internal");
    }
  });

export const publishCase = wrap("publishCase");
export const updateCase = wrap("updateCase");
export const withdrawCase = wrap("withdrawCase");
export const deleteCase = wrap("deleteCase");
export const setLike = wrap("setLike");
export const recordPlay = wrap("recordPlay");
export const followAuthor = wrap("followAuthor");
export const setAuthorProfile = wrap("setAuthorProfile");
export const reportCase = wrap("reportCase");
export const moderateCase = wrap("moderateCase");
export const dismissReports = wrap("dismissReports");
export const prepareAccountDeletion = wrap("prepareAccountDeletion");
