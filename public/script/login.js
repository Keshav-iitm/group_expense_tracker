import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const groupName = document.getElementById("groupName").value.trim();
  const groupPassword = document.getElementById("groupPassword").value.trim();
  const loadingNotice = document.getElementById("loadingNotice");

  if (!groupName || !groupPassword) {
    alert("Please enter both group name and password.");
    return;
  }

  loadingNotice.style.display = "block"; // Show loading message

  try {
    const groupRef = doc(db, "groups", groupName);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      alert("Group does not exist. Please check the name or create a new group.");
      loadingNotice.style.display = "none";
      return;
    }

    const data = groupSnap.data();

    if (data.password !== groupPassword) {
      alert("Incorrect password. Please try again.");
      loadingNotice.style.display = "none";
      return;
    }

    localStorage.setItem("currentGroup", groupName);
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    alert("An error occurred while logging in. Please try again.");
    loadingNotice.style.display = "none"; // ✅ Fix: hide it here too
  }
});
