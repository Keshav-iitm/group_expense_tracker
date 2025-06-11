// create_group.js

import { db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const groupName = document.getElementById('groupName').value.trim();
  const groupPassword = document.getElementById('groupPassword').value.trim();
  const membersInput = document.getElementById('members').value.trim();

  const dataLossCheck = document.getElementById('dataLossCheck').checked;
  const termsCheck = document.getElementById('termsCheck').checked;

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

  try {
    // Save main group data
    await setDoc(doc(db, "groups", groupName), {
      password: groupPassword,
      members: members,
      createdAt: new Date().toISOString()
    });

    // Initialize data for each member
    for (const member of members) {
      await setDoc(doc(db, `groups/${groupName}/members`, member), {
        amountOwed: 0,
        amountToGet: 0,
        transactions: [],
        completedPayments: []
      });
    }

    // Initialize delete log
    await setDoc(doc(db, `groups/${groupName}`, "deleteLog"), {
      entries: []
    });

    alert(`Group "${groupName}" created successfully!`);
    window.location.href = "index.html";

  } catch (error) {
    console.error("Error creating group:", error);
    alert("An error occurred while creating the group. Please try again.");
  }
});
