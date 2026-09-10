import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { firebaseApp } from "../firebaseConfig.js";

const auth = getAuth(firebaseApp);

export function signIn() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signOutUser() {
  return signOut(auth);
}

// cb(user | null) — fires immediately with the current state, then again on
// every sign-in/sign-out. Returns the unsubscribe function.
export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}
