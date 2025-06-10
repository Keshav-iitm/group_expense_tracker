// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCB3jhRHmrHtSiAf_2kxZxiPDVttlsfn_E",
  authDomain: "group-expense-tracker-kk.firebaseapp.com",
  projectId: "group-expense-tracker-kk",
  storageBucket: "group-expense-tracker-kk.firebasestorage.app",
  messagingSenderId: "842227280018",
  appId: "1:842227280018:web:850969f1a3b3324c959e4b",
  measurementId: "G-W2ECEC52SH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
