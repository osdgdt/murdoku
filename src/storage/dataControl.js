// "Delete my data": everything this site keeps on the visitor's device lives
// under the `murdoku:` localStorage prefix (puzzles, progress, theme,
// language, achievements, solve history, last-opened...), so clearing that
// prefix removes all of it.
const PREFIX = "murdoku:";

function backend() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function localDataKeys() {
  const store = backend();
  if (!store) return [];
  const keys = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

// Returns how many entries were removed.
export function clearLocalData() {
  const store = backend();
  if (!store) return 0;
  const keys = localDataKeys();
  for (const key of keys) store.removeItem(key);
  return keys.length;
}
