import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const groupName = document.getElementById("groupName").value.trim();
  const groupPassword = document.getElementById("groupPassword").value.trim();

  try {
    const groupRef = doc(db, "groups", groupName);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      alert("Group does not exist. Please check the name or create a new group.");
      return;
    }

    const data = groupSnap.data();

    if (data.password !== groupPassword) {
      alert("Incorrect password. Please try again.");
      return;
    }

    localStorage.setItem("currentGroup", groupName);
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    alert("An error occurred while logging in. Please try again.");
  }
});
