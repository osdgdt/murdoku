// An in-memory stand-in for the Firestore adapter of functions/index.js, with the two behaviours of the real one
// that matter to the handlers: `create` refuses an existing document, and in a transaction every read must come
// before the first write (Firestore refuses otherwise). A transaction that throws changes nothing.
export function createFakeStore(initial = {}) {
  const docs = new Map(Object.entries(initial).map(([path, data]) => [path, structuredClone(data)]));
  const clone = (value) => structuredClone(value);
  const view = (data) => ({
    exists: data !== null && data !== undefined,
    data: data === null || data === undefined ? undefined : clone(data),
  });
  return {
    docs,
    async get(path) {
      return view(docs.get(path));
    },
    async runTransaction(fn) {
      const staged = new Map(); // path -> data, or null for a deletion
      let wrote = false;
      const current = (path) => (staged.has(path) ? staged.get(path) : (docs.get(path) ?? null));
      const tx = {
        async get(path) {
          if (wrote) throw new Error(`Firestore: all reads must come before writes (read of ${path} after a write)`);
          return view(current(path));
        },
        create(path, data) {
          wrote = true;
          if (current(path) !== null) throw new Error(`ALREADY_EXISTS: ${path}`);
          staged.set(path, clone(data));
        },
        set(path, data) {
          wrote = true;
          staged.set(path, clone(data));
        },
        update(path, patch) {
          wrote = true;
          const existing = current(path);
          if (existing === null) throw new Error(`NOT_FOUND: ${path}`);
          staged.set(path, { ...existing, ...clone(patch) });
        },
        delete(path) {
          wrote = true;
          staged.set(path, null);
        },
      };
      const result = await fn(tx);
      for (const [path, data] of staged) {
        if (data === null) docs.delete(path);
        else docs.set(path, data);
      }
      return result;
    },
    // reads outside a transaction (what the account deletion and the administrator's actions need)
    async list(collection) {
      const prefix = `${collection}/`;
      return [...docs.entries()]
        .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map(([path, data]) => ({ path, data: clone(data) }));
    },
    async where(collection, field, value) {
      return (await this.list(collection)).filter((doc) => doc.data[field] === value);
    },
    async groupWhere(group, field, value) {
      return [...docs.entries()]
        .filter(([path]) => {
          const parts = path.split("/");
          return parts.length % 2 === 0 && parts[parts.length - 2] === group;
        })
        .filter(([, data]) => data[field] === value)
        .map(([path, data]) => ({ path, data: clone(data) }));
    },
    async deleteTree(path) {
      for (const key of [...docs.keys()]) if (key === path || key.startsWith(`${path}/`)) docs.delete(key);
    },
  };
}
