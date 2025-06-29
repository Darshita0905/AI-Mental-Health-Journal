// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBbJQc_TOv5nNMvf99nqsAHUiTX_aN2mMg",
  authDomain: "ai-journal-app-de9d9.firebaseapp.com",
  projectId: "ai-journal-app-de9d9",
  storageBucket: "ai-journal-app-de9d9.firebasestorage.app",
  messagingSenderId: "73604188863",
  appId: "1:73604188863:web:c748be4db651ca06a1540a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Connect to Firestore
const db = getFirestore(app);

// Enable Anonymous Auth
const auth = getAuth();
signInAnonymously(auth)
  .then(() => {
    console.log("Signed in anonymously");
  })
  .catch((error) => {
    console.error("Auth error:", error);
  });

// ✅ Export both db and auth once
export { db, auth };
