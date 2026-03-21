import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFMZkF4x6y3aCOXkxZ6ARALcSdfOME7JQ",
  authDomain: "group-gift-65215.firebaseapp.com",
  projectId: "group-gift-65215",
  storageBucket: "group-gift-65215.firebasestorage.app",
  messagingSenderId: "662404225294",
  appId: "1:662404225294:web:81ea6060dc5489d9b6df5f"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };