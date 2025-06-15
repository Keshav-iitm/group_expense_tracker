import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const currentGroup = localStorage.getItem("currentGroup");
if (!currentGroup) {
  alert("No group found. Please login again.");
  window.location.href = "index.html";
}

let membersList = [];
document.getElementById("groupNameHeader").textContent = currentGroup;

async function loadGroupMembers() {
  membersList = [];
  const memberDocs = await getDocs(collection(db, "groups", currentGroup, "members"));
  const involvedSelect = document.getElementById("involvedMembersSelect");
  const payersSelect = document.getElementById("contributorsSelect");

  involvedSelect.innerHTML = "";
  payersSelect.innerHTML = "";

  memberDocs.forEach(docSnap => {
    const name = docSnap.id;
    membersList.push(name);

    [involvedSelect, payersSelect].forEach(select => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  });

  involvedSelect.size = membersList.length;
  involvedSelect.multiple = true;
  payersSelect.size = membersList.length;
  payersSelect.multiple = true;
}

document.getElementById("selectAllMembers").addEventListener("change", function () {
  const options = document.getElementById("involvedMembersSelect").options;
  for (let opt of options) {
    opt.selected = this.checked;
  }
});

document.getElementById("addMemberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("newMemberName").value.trim();
  if (!name) return;

  const ref = doc(db, "groups", currentGroup, "members", name);
  await setDoc(ref, { amountOwed: 0, amountToGet: 0 });

  document.getElementById("newMemberName").value = "";
  await loadGroupMembers();
  await updateBalances();
  await updateSettlementTable();
});

document.getElementById("addExpenseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payers = [...document.getElementById("contributorsSelect").selectedOptions].map(opt => opt.value);
  const involved = [...document.getElementById("involvedMembersSelect").selectedOptions].map(opt => opt.value);
  const amount = parseFloat(document.getElementById("amount").value);
  const reason = document.getElementById("expenseReason").value;
  const statusDisplay = document.getElementById("statusDisplay");

  if (!payers.length || !involved.length || isNaN(amount) || amount <= 0) return alert("Invalid input");

  statusDisplay.textContent = "Adding...";

  const perHead = amount / involved.length;
  const expenseId = `EX${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  await setDoc(doc(db, "groups", currentGroup, "expenses", expenseId), {
    payers, involved, amount, reason, date: Date.now(), settled: []
  });

  for (let name of involved) {
    const ref = doc(db, "groups", currentGroup, "members", name);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      amountOwed: (snap.data().amountOwed || 0) + perHead
    });
  }

  for (let name of payers) {
    const ref = doc(db, "groups", currentGroup, "members", name);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      amountToGet: (snap.data().amountToGet || 0) + (amount / payers.length)
    });
  }

  document.getElementById("addExpenseForm").reset();
  statusDisplay.textContent = "Added!";

  await loadExpenseLogs();
  await updateBalances();
  await updateSettlementTable();
});

async function updateBalances() {
  const div = document.getElementById("balanceSummary");
  div.innerHTML = "";

  for (const m of membersList) {
    const snap = await getDoc(doc(db, "groups", currentGroup, "members", m));
    const data = snap.data();
    const net = (data.amountToGet || 0) - (data.amountOwed || 0);
    const color = net >= 0 ? "text-success" : "text-danger";

    div.innerHTML += `<div class="col-md-4"><p><strong>${m}</strong>: <span class="${color}">₹${net.toFixed(2)}</span></p></div>`;
  }
}

async function updateSettlementTable() {
  const table = document.getElementById("settlementTableBody");
  table.innerHTML = "";

  const expensesSnap = await getDocs(collection(db, "groups", currentGroup, "expenses"));

  for (const docSnap of expensesSnap.docs) {
    const expense = docSnap.data();
    const expenseId = docSnap.id;
    const perHead = expense.amount / expense.involved.length;

    for (const from of expense.involved) {
      if (expense.payers.includes(from)) continue;
      for (const to of expense.payers) {
        const amount = perHead;
        const key = `${expenseId}_${from}_${to}`;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${expenseId}</td>
          <td>${to}</td>
          <td>${from}</td>
          <td>₹${amount.toFixed(2)}</td>
          <td class="status">Unpaid</td>
          <td><button class="btn btn-sm btn-success">Paid</button></td>
        `;

        const statusCell = row.querySelector(".status");
        const btn = row.querySelector("button");

        const paidKey = `${expenseId}_${from}_${to}`;
        const isPaid = expense.settled?.includes(paidKey);
        if (isPaid) {
          row.classList.add("highlight-paid");
          statusCell.textContent = "Paid";
          btn.textContent = "Revoke";
          btn.classList.remove("btn-success");
          btn.classList.add("btn-warning");
        }

        btn.addEventListener("click", async () => {
          const confirmText = btn.textContent === "Paid"
            ? "Are you sure you have paid this amount?"
            : "Are you sure you want to revoke the payment? This should only be done if you selected 'Paid' by mistake or returned the amount.";

          if (!confirm(confirmText)) return;

          const fromRef = doc(db, "groups", currentGroup, "members", from);
          const toRef = doc(db, "groups", currentGroup, "members", to);
          const fromSnap = await getDoc(fromRef);
          const toSnap = await getDoc(toRef);

          const fromData = fromSnap.data();
          const toData = toSnap.data();

          const paidKey = `${expenseId}_${from}_${to}`;
          const newSettled = expense.settled || [];

          if (btn.textContent === "Paid") {
            await updateDoc(fromRef, { amountOwed: (fromData.amountOwed || 0) - amount });
            await updateDoc(toRef, { amountToGet: (toData.amountToGet || 0) - amount });
            newSettled.push(paidKey);
          } else {
            await updateDoc(fromRef, { amountOwed: (fromData.amountOwed || 0) + amount });
            await updateDoc(toRef, { amountToGet: (toData.amountToGet || 0) + amount });
            const idx = newSettled.indexOf(paidKey);
            if (idx > -1) newSettled.splice(idx, 1);
          }

          await updateDoc(doc(db, "groups", currentGroup, "expenses", expenseId), {
            settled: newSettled
          });

          await updateBalances();
          await updateSettlementTable();
        });

        table.appendChild(row);
      }
    }
  }
}

async function loadExpenseLogs() {
  const ref = collection(db, "groups", currentGroup, "expenses");
  const snap = await getDocs(ref);
  const body = document.getElementById("expenseLogBody");
  body.innerHTML = "";
  let total = 0;

  snap.forEach(docSnap => {
    const { payers, amount, involved, reason, date } = docSnap.data();
    total += parseFloat(amount);
    body.innerHTML += `
      <tr>
        <td>${docSnap.id}</td>
        <td>${payers.join(', ')}</td>
        <td>₹${amount}</td>
        <td>${involved.join(', ')}</td>
        <td>${reason}</td>
        <td>${new Date(date).toLocaleString()}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteExpense('${docSnap.id}', ${amount})">Delete</button></td>
      </tr>`;
  });

  document.getElementById("totalAmount").textContent = `₹${total.toFixed(2)}`;
}

window.deleteExpense = async function (id, amount) {
  const expenseRef = doc(db, "groups", currentGroup, "expenses", id);
  const expenseSnap = await getDoc(expenseRef);
  if (!expenseSnap.exists()) return;

  const expense = expenseSnap.data();

  if ((expense.settled || []).length > 0) {
    alert("This expense has already been partially settled. Please revoke payments before deletion.");
    return;
  }

  if (!confirm("Are you sure you want to delete this log? It will be excluded from all calculations and cannot be restored.")) return;

  const perHead = expense.amount / expense.involved.length;
  for (const name of expense.involved) {
    const ref = doc(db, "groups", currentGroup, "members", name);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      amountOwed: (snap.data().amountOwed || 0) - perHead
    });
  }
  for (const name of expense.payers) {
    const ref = doc(db, "groups", currentGroup, "members", name);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      amountToGet: (snap.data().amountToGet || 0) - (expense.amount / expense.payers.length)
    });
  }

  await deleteDoc(expenseRef);

  const deleteLogRef = doc(db, "groups", currentGroup, "deleteLogs", "info");
  const logSnap = await getDoc(deleteLogRef);
  const entries = logSnap.exists() ? logSnap.data().entries || [] : [];
  entries.push({
    id,
    reason: "Deleted by user",
    deletedBy: "system",
    date: Date.now()
  });
  await setDoc(deleteLogRef, { entries });

  await loadExpenseLogs();
  await updateBalances();
  await updateSettlementTable();
};

async function loadDeleteLogs() {
  const deleteLogRef = doc(db, "groups", currentGroup, "deleteLogs", "info");
  const logSnap = await getDoc(deleteLogRef);
  const body = document.getElementById("deleteLogBody");
  if (!body) return;

  body.innerHTML = "";

  if (!logSnap.exists()) return;

  const entries = logSnap.data().entries || [];

  entries.forEach(log => {
    body.innerHTML += `
      <tr>
        <td>${log.id}</td>
        <td>${log.reason}</td>
        <td>${log.deletedBy}</td>
        <td>${new Date(log.date).toLocaleString()}</td>
      </tr>
    `;
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadGroupMembers();
  await loadExpenseLogs();
  await loadDeleteLogs();
  await updateBalances();
  await updateSettlementTable();
});
