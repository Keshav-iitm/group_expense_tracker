import { db } from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const groupName = document.getElementById('groupName').value.trim();
  const groupPassword = document.getElementById('groupPassword').value.trim();
  const membersInput = document.getElementById('members').value.trim();
  const loadingNotice = document.getElementById('loadingNotice');

  const dataLossCheck = document.getElementById('dataLossConsent').checked;
  const termsCheck = document.getElementById('agreeTerms').checked;

  if (!dataLossCheck || !termsCheck) {
    alert("Please agree to both checkboxes before proceeding.");
    return;
  }

  const members = membersInput
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);

  if (members.length < 2) {
    alert("Please enter at least two member names.");
    return;
  }

  loadingNotice.style.display = "block"; // Show "please wait..."

  try {
    const groupRef = doc(db, "groups", groupName);
    const groupSnap = await getDoc(groupRef);

    if (groupSnap.exists()) {
      alert("Group name already exists. Please choose a different name.");
      loadingNotice.style.display = "none";
      return;
    }

    // 1. Create main group doc
    await setDoc(groupRef, {
      password: groupPassword,
      members: members,
      createdAt: new Date().toISOString()
    });
    console.log("Group document created.");

    // 2. Create members
    for (const member of members) {
      try {
        await setDoc(doc(db, `groups/${groupName}/members`, member), {
          amountOwed: 0,
          amountToGet: 0,
          transactions: [],
          completedPayments: []
        });
        console.log(`Created data for member: ${member}`);
      } catch (memberErr) {
        console.error(`Error saving member ${member}:`, memberErr);
      }
    }

    // 3. Initialize deleteLogs
    try {
      await setDoc(doc(db, `groups/${groupName}/deleteLogs`, "info"), {
        entries: []
      });
      console.log("Delete log initialized.");
    } catch (logErr) {
      console.warn("Could not initialize delete log:", logErr);
    }

    // ✅ Success
    alert(`Group "${groupName}" created successfully!`);
    window.location.href = "index.html";

  } catch (error) {
    console.error("Error during group creation:", error);
    alert("An error occurred while creating the group. Please try again.");
    loadingNotice.style.display = "none"; // Hide on error
  }
});
