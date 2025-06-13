// dashboard.js
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

let currentGroup = localStorage.getItem("currentGroup");
if (!currentGroup) {
  alert("No group found. Please login again.");
  window.location.href = "index.html";
}

// Display group name on top
const groupTitle = document.createElement("h4");
groupTitle.className = "text-center text-primary";
groupTitle.textContent = `Group: ${currentGroup}`;
document.querySelector(".container").prepend(groupTitle);

let membersList = [];

// Load group members into the select list
async function loadGroupMembers(groupName) {
  const membersRef = collection(db, "groups", groupName, "members");
  const membersSnap = await getDocs(membersRef);

  membersList = [];
  const select = document.getElementById("involvedMembersSelect");
  const payerSelect = document.getElementById("payer");

  select.innerHTML = "";
  payerSelect.innerHTML = "";

  membersSnap.forEach(docSnap => {
    const member = docSnap.id;
    membersList.push(member);

    const option1 = document.createElement("option");
    option1.value = member;
    option1.textContent = member;
    select.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = member;
    option2.textContent = member;
    payerSelect.appendChild(option2);
  });
}

// Select all checkbox logic
document.getElementById("selectAllMembers").addEventListener("change", function () {
  const options = document.getElementById("involvedMembersSelect").options;
  for (let option of options) {
    option.selected = this.checked;
  }
});

// Load members and logs on start
window.onload = async () => {
  await loadGroupMembers(currentGroup);
  await loadExpenseLogs();
  await loadDeleteLogs();
  await updateBalances();
  await updateTables();
};

// Generate 5-character ID: 2 letters + 3 digits
function generateExpenseID() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = Math.floor(100 + Math.random() * 900);
  const chars = letters.charAt(Math.floor(Math.random() * 26)) + letters.charAt(Math.floor(Math.random() * 26));
  return chars + digits;
}

// Add expense logic
document.getElementById("addExpenseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payer = document.getElementById("payer").value.trim();
  const amount = parseFloat(document.getElementById("amount").value.trim());
  const involvedSelect = document.getElementById("involvedMembersSelect");
  const involved = Array.from(involvedSelect.selectedOptions).map(option => option.value);

  if (!payer || isNaN(amount) || involved.length === 0) {
    alert("Please fill all fields and select at least one involved member.");
    return;
  }

  const expenseID = generateExpenseID();
  const date = new Date().toISOString();
  const eachShare = amount / involved.length;

  const logRef = doc(db, `groups/${currentGroup}/expenses`, expenseID);
  await setDoc(logRef, {
    payer,
    amount,
    involved,
    date
  });

  for (const member of involved) {
    const memberRef = doc(db, `groups/${currentGroup}/members`, member);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const data = memberSnap.data();
      const owed = member === payer ? 0 : eachShare;
      const toGet = member === payer ? amount - eachShare : 0;

      await updateDoc(memberRef, {
        amountOwed: (data.amountOwed || 0) + owed,
        amountToGet: (data.amountToGet || 0) + toGet
      });
    }
  }

  alert("Expense added successfully.");
  window.location.reload();
});

// Load expense logs
async function loadExpenseLogs() {
  const logsRef = collection(db, `groups/${currentGroup}/expenses`);
  const logsSnap = await getDocs(logsRef);
  const logBody = document.getElementById("expenseLogBody");
  logBody.innerHTML = "";

  let total = 0;
  logsSnap.forEach(docSnap => {
    const { payer, amount, involved, date } = docSnap.data();
    total += parseFloat(amount);
    logBody.innerHTML += `<tr><td>${docSnap.id}</td><td>${payer}</td><td>₹${amount}</td><td>${involved.join(", ")}</td><td>${new Date(date).toLocaleString()}</td></tr>`;
  });

  document.getElementById("totalAmount").textContent = `₹${total.toFixed(2)}`;
}

// Load delete logs
async function loadDeleteLogs() {
  const logRef = doc(db, `groups/${currentGroup}/deleteLogs`, "info");
  const logSnap = await getDoc(logRef);
  const deleteLogBody = document.getElementById("deleteLogBody");
  deleteLogBody.innerHTML = "";
  const entries = logSnap.exists() ? (logSnap.data().entries || []) : [];

  entries.forEach(entry => {
    deleteLogBody.innerHTML += `<tr><td>${entry.id}</td><td>${entry.deletedBy}</td><td>${entry.reason}</td><td>${new Date(entry.date).toLocaleString()}</td></tr>`;
  });
}

// Update balances
async function updateBalances() {
  const summaryDiv = document.getElementById("balanceSummary");
  summaryDiv.innerHTML = "";
  for (const member of membersList) {
    const ref = doc(db, `groups/${currentGroup}/members`, member);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const net = (data.amountToGet || 0) - (data.amountOwed || 0);
      const color = net >= 0 ? "text-success" : "text-danger";
      summaryDiv.innerHTML += `<div class='col-md-4'><p><strong>${member}</strong>: <span class='${color}'>₹${net.toFixed(2)}</span></p></div>`;
    }
  }
}

// Update owe/get tables
async function updateTables() {
  const oweBody = document.getElementById("oweTableBody");
  const getBody = document.getElementById("getTableBody");
  oweBody.innerHTML = getBody.innerHTML = "";

  for (const from of membersList) {
    const fromRef = doc(db, `groups/${currentGroup}/members`, from);
    const fromSnap = await getDoc(fromRef);
    if (!fromSnap.exists()) continue;
    const fromData = fromSnap.data();

    for (const to of membersList) {
      if (from === to) continue;
      const toRef = doc(db, `groups/${currentGroup}/members`, to);
      const toSnap = await getDoc(toRef);
      if (!toSnap.exists()) continue;

      const toData = toSnap.data();
      const owed = Math.min((fromData.amountOwed || 0), (toData.amountToGet || 0)) / (membersList.length - 1);
      if (owed > 0.01) {
        oweBody.innerHTML += `<tr><td>${from}</td><td>${to}</td><td>₹${owed.toFixed(2)}</td></tr>`;
        getBody.innerHTML += `<tr><td>${to}</td><td>${from}</td><td>₹${owed.toFixed(2)}</td></tr>`;
      }
    }
  }
}

// Delete expense logic
document.getElementById("deleteExpenseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("expenseIdToDelete").value.trim();
  const reason = document.getElementById("deleteReason").value.trim();

  if (!id || !reason) {
    alert("Please enter both ID and reason.");
    return;
  }

  try {
    await deleteDoc(doc(db, `groups/${currentGroup}/expenses`, id));

    const logRef = doc(db, `groups/${currentGroup}/deleteLogs`, "info");
    const logSnap = await getDoc(logRef);
    let entries = logSnap.exists() ? (logSnap.data().entries || []) : [];

    entries.push({ id, reason, deletedBy: "Admin", date: new Date().toISOString() });
    await updateDoc(logRef, { entries });

    alert("Expense deleted and logged.");
    window.location.reload();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Error deleting expense. Please check ID or try again.");
  }
});
