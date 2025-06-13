import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const groupName = document.getElementById("groupName").value.trim();
  const groupPassword = document.getElementById("groupPassword").value.trim();

  if (!groupName || !groupPassword) {
    alert("Please enter both group name and password.");
    return;
  }

  try {
    // Reference to the group document by groupName as the document ID
    const groupRef = doc(db, "groups", groupName);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      alert("Group does not exist. Please check the name or create a new group.");
      return;
    }

    const data = groupSnap.data();

    // Password check
    if (data.password !== groupPassword) {
      alert("Incorrect password. Please try again.");
      return;
    }

    // Save current group info in localStorage for session persistence
    localStorage.setItem("currentGroup", groupName);

    // Redirect to dashboard
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    alert("An error occurred while logging in. Please try again.");
  }
});
