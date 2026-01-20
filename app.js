/* global Chart */

const alternatives = [
  { name: "Single Point Interchange", time: 1.5, safety: 0.8, voc: 0.5, maint: 0.10, cost: 55 },
  { name: "Diverging Diamond Interchange", time: 2.0, safety: 1.2, voc: 0.7, maint: 0.15, cost: 60 },
  { name: "Folded Diamond Interchange", time: 1.3, safety: 0.7, voc: 0.4, maint: 0.12, cost: 52 },
  { name: "Quadrant Interchange", time: 1.8, safety: 1.0, voc: 0.6, maint: 0.18, cost: 65 },
  { name: "Button Hook Interchange", time: 1.6, safety: 0.9, voc: 0.55, maint: 0.13, cost: 58 }
];

// annual net benefit (M/yr)
function annualNet(a) {
  return (a.time + a.safety + a.voc) - a.maint;
}

// NPV of a level annual benefit for N years at rate r (as decimal) (M)
function npvLevel(annual, r, years) {
  let sum = 0;
  for (let t = 1; t <= years; t++) {
    sum += annual / Math.pow(1 + r, t);
  }
  return sum;
}

function fmtM(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function fmtBCR(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

let sortKey = "name";
let sortDir = "asc";
let selectedName = null;
let chart = null;

function computeBestName(rows) {
  let best = null;
  let bestVal = -Infinity;
  for (const a of rows) {
    const v = annualNet(a);
    if (v > bestVal) { bestVal = v; best = a.name; }
  }
  return best;
}

function sortedRows() {
  const rows = alternatives.slice();
  rows.sort((a, b) => {
    const av = (sortKey === "annual") ? annualNet(a) : a[sortKey];
    const bv = (sortKey === "annual") ? annualNet(b) : b[sortKey];

    if (typeof av === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av - bv) : (bv - av);
  });
  return rows;
}

function renderTable() {
  const tbody = document.querySelector("#altTable tbody");
  tbody.innerHTML = "";

  const bestName = computeBestName(alternatives);
  const rows = sortedRows();

  for (const a of rows) {
    const tr = document.createElement("tr");
    const isBest = a.name === bestName;
    const isSel = a.name === selectedName;

    if (isBest) tr.classList.add("best");
    if (isSel) tr.classList.add("selected");

    tr.innerHTML = `
      <td>${a.name}</td>
      <td class="num">${fmtM(a.time)}</td>
      <td class="num">${fmtM(a.safety)}</td>
      <td class="num">${fmtM(a.voc)}</td>
      <td class="num">${fmtM(a.maint)}</td>
      <td class="num">${fmtM(a.cost)}</td>
    `;

    tr.addEventListener("click", () => {
      selectedName = a.name;
      updateAll();
    });

    tbody.appendChild(tr);
  }

  // default selection if none
  if (!selectedName) selectedName = bestName;
}

function renderChart() {
  const ctx = document.getElementById("benefitChart");
  const labels = alternatives.map(a => a.name);
  const data = alternatives.map(a => annualNet(a));

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Annual Net Benefit (M/yr)",
        data
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#999" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        x: {
          ticks: { color: "#999", maxRotation: 45, minRotation: 0 },
          grid: { display: false }
        }
      }
    }
  });
}

function updateKPIs() {
  const bestName = computeBestName(alternatives);
  document.getElementById("bestAlt").textContent = bestName;

  const sel = alternatives.find(a => a.name === selectedName) || alternatives[0];
  const annual = annualNet(sel);

  const ratePct = Number(document.getElementById("rate").value);
  const years = Number(document.getElementById("years").value);
  const r = (Number.isFinite(ratePct) ? ratePct : 4) / 100;

  const npv = npvLevel(annual, r, years);
  const bcr = npv / sel.cost;

  document.getElementById("annualBenefit").textContent = fmtM(annual);
  document.getElementById("bcrValue").textContent = fmtBCR(bcr);

  document.getElementById("selName").textContent = sel.name;
  document.getElementById("selAnnual").textContent = fmtM(annual);
  document.getElementById("selNPV").textContent = fmtM(npv);
  document.getElementById("selBCR").textContent = fmtBCR(bcr);

  document.getElementById("metaRate").textContent = `${ratePct}%`;
  document.getElementById("metaYears").textContent = String(years);
}

function wireSorting() {
  const headers = document.querySelectorAll("#altTable thead th");
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-key");
      if (!key) return;

      // map table keys to object keys
      const k = (key === "name") ? "name" :
                (key === "time") ? "time" :
                (key === "safety") ? "safety" :
                (key === "voc") ? "voc" :
                (key === "maint") ? "maint" :
                (key === "cost") ? "cost" : "name";

      if (sortKey === k) sortDir = (sortDir === "asc") ? "desc" : "asc";
      else { sortKey = k; sortDir = "asc"; }

      renderTable();
      updateKPIs();
    });
  });
}

function wireCalculator() {
  const rate = document.getElementById("rate");
  const years = document.getElementById("years");

  rate.addEventListener("input", () => updateAll());
  years.addEventListener("input", () => updateAll());

  document.querySelectorAll("[data-rate]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = Number(btn.getAttribute("data-rate"));
      document.getElementById("rate").value = String(v);
      updateAll();
    });
  });
}

function wirePrint() {
  const btn = document.getElementById("printBtn");
  btn.addEventListener("click", () => window.print());
}

function updateAll() {
  renderTable();
  updateKPIs();
}

(function boot(){
  // default select best
  selectedName = computeBestName(alternatives);

  renderTable();
  renderChart();
  wireSorting();
  wireCalculator();
  wirePrint();
  updateKPIs();
})();
