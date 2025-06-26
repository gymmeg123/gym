// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Remove or comment out
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGTgma54rQ8bhvr3WLie-r4RaRzaNpamY",
  authDomain: "gym-9378d.firebaseapp.com",
  projectId: "gym-9378d",
  storageBucket: "gym-9378d.appspot.com",
  messagingSenderId: "390032588726",
  appId: "1:390032588726:web:06d02f1c2b20b45db60b17",
  measurementId: "G-JF1CBLMX40"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Only initialize analytics in the browser (optional, not needed for Firestore/Auth)
if (typeof window !== "undefined") {
  // import("firebase/analytics").then(({ getAnalytics }) => {
  //   getAnalytics(app);
  // });
}

export const auth = getAuth(app);
export const db = getFirestore(app);