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

  if (!payers.length || !involved.length || isNaN(amount) || amount <= 0) return alert("Invalid input");

  const perHead = amount / involved.length;
  const perPayer = amount / payers.length;
  const expenseId = `EX${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  await setDoc(doc(db, "groups", currentGroup, "expenses", expenseId), {
    payers, involved, amount, reason, date: Date.now()
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
      amountToGet: (snap.data().amountToGet || 0) + amount
    });
  }

  document.getElementById("addExpenseForm").reset();
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

const paidSet = new Set();

async function updateSettlementTable() {
  const table = document.getElementById("settlementTableBody");
  table.innerHTML = "";

  for (let from of membersList) {
    for (let to of membersList) {
      if (from === to) continue;

      const fromSnap = await getDoc(doc(db, "groups", currentGroup, "members", from));
      const toSnap = await getDoc(doc(db, "groups", currentGroup, "members", to));
      const fromData = fromSnap.data();
      const toData = toSnap.data();

      const amount = Math.min((fromData.amountOwed || 0), (toData.amountToGet || 0));
      if (amount > 0.01) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${to}</td>
          <td>${from}</td>
          <td>₹${amount.toFixed(2)}</td>
          <td class="status">Unpaid</td>
          <td><button class="btn btn-sm btn-success">Paid</button></td>
        `;

        const button = row.querySelector("button");

        button.addEventListener("click", async () => {
          const key = `${from}->${to}`;

          if (!paidSet.has(key)) {
            if (!confirm(`Are you sure ${from} has paid ₹${amount.toFixed(2)} to ${to}?`)) return;

            await updateDoc(doc(db, "groups", currentGroup, "members", from), {
              amountOwed: fromData.amountOwed - amount
            });
            await updateDoc(doc(db, "groups", currentGroup, "members", to), {
              amountToGet: toData.amountToGet - amount
            });

            paidSet.add(key);
            row.querySelector(".status").textContent = "Paid";
            row.classList.add("highlight-paid");
            button.textContent = "Revoke";
            button.classList.replace("btn-success", "btn-warning");
            await updateBalances();
          } else {
            await updateDoc(doc(db, "groups", currentGroup, "members", from), {
              amountOwed: fromData.amountOwed + amount
            });
            await updateDoc(doc(db, "groups", currentGroup, "members", to), {
              amountToGet: toData.amountToGet + amount
            });

            paidSet.delete(key);
            row.querySelector(".status").textContent = "Unpaid";
            row.classList.remove("highlight-paid");
            button.textContent = "Paid";
            button.classList.replace("btn-warning", "btn-success");
            await updateBalances();
          }
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
        <td><button class="btn btn-sm btn-danger" onclick="deleteExpense('${docSnap.id}', ${amount}, ${JSON.stringify(payers)}, ${JSON.stringify(involved)})">Delete</button></td>
      </tr>`;
  });

  document.getElementById("totalAmount").textContent = `₹${total.toFixed(2)}`;
}

window.deleteExpense = async (id, amount, payers, involved) => {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  const perHead = amount / involved.length;
  for (let name of involved) {
    const ref = doc(db, "groups", currentGroup, "members", name);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      amountOwed: snap.data().amountOwed - perHead
    });
  }

  for (let name of payers) {
    const ref = doc(db, "groups", currentGroup, "members", name);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      amountToGet: snap.data().amountToGet - amount
    });
  }

  await deleteDoc(doc(db, "groups", currentGroup, "expenses", id));
  await loadExpenseLogs();
  await updateBalances();
  await updateSettlementTable();
};

async function loadDeleteLogs() {
  const ref = doc(db, "groups", currentGroup, "deleteLogs", "info");
  const snap = await getDoc(ref);
  const body = document.getElementById("deleteLogBody");
  body.innerHTML = "";

  const logs = snap.exists() ? (snap.data().entries || []) : [];
  logs.forEach(log => {
    body.innerHTML += `
      <tr>
        <td>${log.id}</td>
        <td>${log.reason}</td>
        <td>${log.deletedBy}</td>
        <td>${new Date(log.date).toLocaleString()}</td>
      </tr>`;
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadGroupMembers();
  await loadExpenseLogs();
  await loadDeleteLogs();
  await updateBalances();
  await updateSettlementTable();
});
