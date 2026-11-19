// What the player does for the shared database besides showing the case: counts that this person opened or solved it (only when
// the browser has seen a signed-in account: the player does not load Firebase for somebody who never signed in), and the likes and
// reports from the panel above the board. The server decides what counts (src/community, functions/src/social.js).
import { wasSignedIn } from "../community/localRegistry.js";

const sent = new Set();

const currentUser = (auth) =>
  new Promise((resolve) => {
    const off = auth.onAuthChange((user) => {
      resolve(user);
      queueMicrotask(() => off());
    });
  });

// event: "opened" | "solved". Once per page and event; failures are silent (the count is a courtesy).
export async function countPlay(code, event) {
  const key = `${code}:${event}`;
  if (!wasSignedIn() || sent.has(key)) return;
  sent.add(key);
  try {
    const [community, auth] = await Promise.all([import("../community/communityStore.js"), import("../auth/googleAuth.js")]);
    if (await currentUser(auth)) await community.recordPlay(code, event);
  } catch {
    // offline, or not signed in any more
  }
}

// Does this signed-in person like this case? false when unknown.
export async function likedByMe(code) {
  if (!wasSignedIn()) return false;
  try {
    const [gallery, auth] = await Promise.all([import("../community/galleryStore.js"), import("../auth/googleAuth.js")]);
    const user = await currentUser(auth);
    return user ? (await gallery.fetchLiked(user.uid, [code])).has(code) : false;
  } catch {
    return false;
  }
}

// -> the account window's answer ({ user, nickname }) or null; and the store, for the calls.
export async function withAccount() {
  const { requireAccount } = await import("../community/accountDialog.js");
  const account = await requireAccount();
  if (!account) return null;
  return { account, community: await import("../community/communityStore.js") };
}
