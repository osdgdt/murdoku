import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

// Not a secret: a client-side Firebase web config only identifies which
// project to talk to. Access control is enforced entirely by
// firestore.rules, not by hiding this object.
export const firebaseApp = initializeApp({
  apiKey: "AIzaSyBe3hvmVnLk7MBnlKVev6a0JCOKZM7l39c",
  authDomain: "murdoku-61284.firebaseapp.com",
  projectId: "murdoku-61284",
  storageBucket: "murdoku-61284.firebasestorage.app",
  messagingSenderId: "357960250118",
  appId: "1:357960250118:web:6f16f4ef6116eb50dae487",
});
