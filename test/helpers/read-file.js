// Reads a file of the repository, in Node (npm test) and in the browser test page (fetch).
// `repoPath` is relative to the repository root, e.g. "styles/contrast.css".
export async function readRepoFile(repoPath) {
  const url = new URL(`../../${repoPath}`, import.meta.url);
  if (globalThis.process?.versions?.node) {
    const { readFile } = await import("node:fs/promises");
    return readFile(url, "utf8");
  }
  const response = await fetch(url);
  return response.text();
}
