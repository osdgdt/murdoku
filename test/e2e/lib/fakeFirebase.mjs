// A stand-in for the Firebase SDK files the pages load from Google's CDN (not reachable from the tests, and
// they must not touch the real project anyway): sign-in as a made-up player, and a tiny Firestore (documents in
// localStorage, so a reload keeps them) with the calls the app uses. It does NOT enforce firestore.rules: it
// tests the page's own logic, not the security rules (those have test/rules).
const APP = `export const initializeApp = (config) => ({ config });`;

const AUTH = `
const USER_KEY = "__fake_user";
const listeners = new Set();
const read = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
const notify = () => listeners.forEach((cb) => cb(read()));
export const getAuth = () => ({ get currentUser() { return read(); } });
export class GoogleAuthProvider {}
export const signInWithPopup = async () => {
  const user = { uid: localStorage.getItem("__fake_uid") || "uid-test", email: "tester@example.test" };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
  return { user };
};
export const signOut = async () => { localStorage.removeItem(USER_KEY); notify(); };
export const onAuthStateChanged = (auth, cb) => { listeners.add(cb); setTimeout(() => cb(read()), 0); return () => listeners.delete(cb); };
export const deleteUser = async () => {};
`;

const FIRESTORE = `
const DB_KEY = "__fake_db";
const load = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch { return {}; } };
const save = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
export const getFirestore = () => ({});
const path = (segments) => segments.join("/");
export const doc = (db, ...segments) => ({ __doc: true, path: path(segments), id: segments[segments.length - 1] });
export const collection = (db, ...segments) => ({ __col: true, path: path(segments) });
export const serverTimestamp = () => ({ __ts: true });
export const increment = (n) => ({ __inc: n });
const materialize = (value) => {
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = v && v.__ts ? { seconds: Math.floor(Date.now() / 1000) } : v;
  return out;
};
const snap = (ref, data) => ({ id: ref.id, ref, exists: () => data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))) });
export const getDoc = async (ref) => snap(ref, load()[ref.path]);
export const setDoc = async (ref, value, options) => {
  const db = load();
  db[ref.path] = options && options.merge ? { ...(db[ref.path] || {}), ...materialize(value) } : materialize(value);
  save(db);
};
export const deleteDoc = async (ref) => { const db = load(); delete db[ref.path]; save(db); };
export const orderBy = (field, dir = "asc") => ({ __order: field, dir });
export const limit = (n) => ({ __limit: n });
export const where = (field, op, value) => ({ __where: [field, op, value] });
export const startAfter = (snapshot) => ({ __after: snapshot });
export const query = (col, ...parts) => ({ ...col, parts });
const field = (data, path) => path.split(".").reduce((value, key) => value?.[key], data);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const matches = (actual, op, value) => {
  if (op === "==") return actual === value;
  if (op === "in") return Array.isArray(value) && value.includes(actual);
  if (op === ">") return actual !== undefined && actual > value;
  if (op === "array-contains") return Array.isArray(actual) && actual.includes(value);
  if (op === ">=") return actual !== undefined && actual >= value;
  if (op === "<") return actual !== undefined && actual < value;
  throw new Error("fake Firestore: unsupported operator " + op);
};
// (like the real one: a query ordered by a field only returns the documents that have it)
export const getDocs = async (q) => {
  const db = load();
  const prefix = q.path + "/";
  const parts = q.parts || [];
  let rows = Object.entries(db).filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/")).map(([p, data]) => ({ p, data }));
  for (const part of parts) if (part.__where) rows = rows.filter(({ data }) => matches(field(data, part.__where[0]), part.__where[1], part.__where[2]));
  const orders = parts.filter((part) => part.__order);
  rows = rows.filter(({ data }) => orders.every((o) => field(data, o.__order) !== undefined));
  rows.sort((a, b) => {
    for (const o of orders) {
      const c = compare(field(a.data, o.__order), field(b.data, o.__order));
      if (c) return o.dir === "desc" ? -c : c;
    }
    return 0;
  });
  const after = parts.find((part) => part.__after);
  if (after) rows = rows.slice(rows.findIndex((r) => r.p === after.__after.ref.path) + 1);
  const cap = parts.find((part) => part.__limit);
  if (cap) rows = rows.slice(0, cap.__limit);
  return { docs: rows.map(({ p, data }) => snap({ id: p.split("/").pop(), path: p }, data)), size: rows.length };
};
export const writeBatch = () => {
  const ops = [];
  const batch = {
    set: (ref, value, options) => (ops.push(() => setDoc(ref, value, options)), batch),
    update: (ref, value) => (ops.push(() => setDoc(ref, value, { merge: true })), batch),
    delete: (ref) => (ops.push(() => deleteDoc(ref)), batch),
    commit: async () => { for (const op of ops) await op(); },
  };
  return batch;
};
export const runTransaction = async (db, fn) => fn({ get: (ref) => getDoc(ref), set: (ref, v, o) => setDoc(ref, v, o) });
`;

// The Cloud Functions of the shared case database, run for real in the page: the SAME handlers as the server
// (functions/src/handlers.js, with the page's own casePolicy.js) over the fake Firestore above. It enforces what the
// server enforces in code (login, nickname, "solved once", limits, duplicates); it does not enforce firestore.rules.
const FUNCTIONS = `
export const getFunctions = (app, region) => ({ app, region });
export const httpsCallable = (functions, name) => async (data) => {
  const [{ createHandlers }, policy, { createFakeStore }] = await Promise.all([
    import(location.origin + "/functions/src/handlers.js"),
    import(location.origin + "/src/community/casePolicy.js"),
    import(location.origin + "/test/helpers/fake-store.js"),
  ]);
  const DB_KEY = "__fake_db";
  const store = createFakeStore(JSON.parse(localStorage.getItem(DB_KEY) || "{}"));
  const handlers = createHandlers({ store, policy, randomInt: (n) => Math.floor(Math.random() * n) });
  const user = JSON.parse(localStorage.getItem("__fake_user") || "null");
  try {
    const result = await handlers[name](JSON.parse(JSON.stringify(data)), user ? { uid: user.uid } : null);
    localStorage.setItem(DB_KEY, JSON.stringify(Object.fromEntries(store.docs)));
    return { data: result };
  } catch (e) {
    if (e.name !== "CaseError") throw e;
    const err = new Error(e.reason);
    err.code = "functions/" + e.code;
    err.details = e.details;
    throw err;
  }
};
`;

// Registers the stand-ins on a Playwright page (call BEFORE page.goto).
export async function installFakeFirebase(page) {
  const files = {
    "firebase-app.js": APP,
    "firebase-auth.js": AUTH,
    "firebase-firestore.js": FIRESTORE,
    "firebase-functions.js": FUNCTIONS,
  };
  await page.route("https://www.gstatic.com/firebasejs/**", (route) => {
    const name = route.request().url().split("/").pop();
    if (files[name]) route.fulfill({ contentType: "text/javascript", body: files[name] });
    else route.abort();
  });
  await page.route("https://apis.google.com/**", (route) => route.abort());
}
