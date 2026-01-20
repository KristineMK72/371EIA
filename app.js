/* global Chart */

/**
 * 371 Economic Impact Analysis — app.js
 * - Alternatives table (sortable + selectable)
 * - Annual net benefit chart
 * - NPV + BCR calculator (screening)
 * - ESRI baseline context (Baxter / Brainerd) + modal
 * - Print / Save PDF
 */

const alternatives = [
  { name: "Single Point Interchange", time: 1.5, safety: 0.8, voc: 0.5, maint: 0.10, cost: 55 },
  { name: "Diverging Diamond Interchange", time: 2.0, safety: 1.2, voc: 0.7, maint: 0.15, cost: 60 },
  { name: "Folded Diamond Interchange", time: 1.3, safety: 0.7, voc: 0.4, maint: 0.12, cost: 52 },
  { name: "Quadrant Interchange", time: 1.8, safety: 1.0, voc: 0.6, maint: 0.18, cost: 65 },
  { name: "Button Hook Interchange", time: 1.6, safety: 0.9, voc: 0.55, maint: 0.13, cost: 58 }
];

// ESRI baseline context (place geography)
const esriPlaces = {
  baxter: {
    label: "Baxter",
    businesses: 650,
    employees: 9487,
    screenshot: "./assets/esri-baxter.jpg"
  },
  brainerd: {
    label: "Brainerd",
    businesses: 425,
    employees: 11297,
    screenshot: "./assets/esri-brainerd.jpg"
  }
};

/* =========================
   Math helpers
========================= */

// annual net benefit (M/yr)
function annualNet(a) {
  return (a.time + a.safety + a.voc) - a.maint;
}

// NPV of a level annual net benefit for N years at rate r (decimal)
function npvLevel(annual, r, years) {
  const rr = Number.isFinite(r) ? r : 0.04;
  const n = Number.isFinite(years) ? years : 30;

  let sum = 0;
  for (let t = 1; t <= n; t += 1) {
    sum += annual / Math.pow(1 + rr, t);
  }
  return sum;
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function fmt2(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function fmtInt(x) {
  if (!Number.isFinite(x)) return "—";
  return Math.round(x).toLocaleString();
}

/* =========================
   App state
========================= */

const state = {
  sortKey: "name",
  sortDir: "asc",
  selectedName: null,
  chart: null,
  placeKey: "baxter"
};

/* =========================
   Data utilities
========================= */

function bestAlternativeName(rows) {
  let best = rows[0]?.name ?? null;
  let bestVal = -Infinity;

  for (const a of rows) {
    const v = annualNet(a);
    if (v > bestVal) {
      bestVal = v;
      best = a.name;
    }
  }
  return best;
}

function getSelected() {
  const sel = alternatives.find(a => a.name === state.selectedName);
  return sel || alternatives[0];
}

function getRateAndYears() {
  const rateEl = document.getElementById("rate");
  const yearsEl = document.getElementById("years");

  const ratePct = clamp(Number(rateEl?.value), 0, 20);
  const years = clamp(Number(yearsEl?.value), 1, 60);

  return { ratePct, years, r: ratePct / 100 };
}

function sortedRows() {
  const rows = alternatives.slice();
  const { sortKey, sortDir } = state;

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

/* =========================
   UI: Alternatives table
========================= */

function renderTable() {
  const tbody = document.querySelector("#altTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const bestName = bestAlternativeName(alternatives);
  const rows = sortedRows();

  // keep selection stable; default to best
  if (!state.selectedName) state.selectedName = bestName;

  for (const a of rows) {
    const tr = document.createElement("tr");

    if (a.name === bestName) tr.classList.add("best");
    if (a.name === state.selectedName) tr.classList.add("selected");

    tr.innerHTML = `
      <td>${a.name}</td>
      <td class="num">${fmt2(a.time)}</td>
      <td class="num">${fmt2(a.safety)}</td>
      <td class="num">${fmt2(a.voc)}</td>
      <td class="num">${fmt2(a.maint)}</td>
      <td class="num">${fmt2(a.cost)}</td>
    `;

    tr.addEventListener("click", () => {
      state.selectedName = a.name;
      updateAll();
    });

    tbody.appendChild(tr);
  }
}

function wireSorting() {
  const headers = document.querySelectorAll("#altTable thead th");
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-key");
      if (!key) return;

      // map to supported keys
      const mapped =
        key === "name" ? "name" :
        key === "time" ? "time" :
        key === "safety" ? "safety" :
        key === "voc" ? "voc" :
        key === "maint" ? "maint" :
        key === "cost" ? "cost" : "name";

      if (state.sortKey === mapped) {
        state.sortDir = (state.sortDir === "asc") ? "desc" : "asc";
      } else {
        state.sortKey = mapped;
        state.sortDir = "asc";
      }

      renderTable();
      updateKPIs();
    });
  });
}

/* =========================
   UI: Chart
========================= */

function renderChart() {
  const canvas = document.getElementById("benefitChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = alternatives.map(a => a.name);
  const data = alternatives.map(a => annualNet(a));

  if (state.chart) state.chart.destroy();

  state.chart = new Chart(canvas, {
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

/* =========================
   UI: KPIs + calculator
========================= */

function updateKPIs() {
  const sel = getSelected();
  const annual = annualNet(sel);

  const { ratePct, years, r } = getRateAndYears();

  const npv = npvLevel(annual, r, years);
  const bcr = sel.cost > 0 ? (npv / sel.cost) : NaN;

  // hero cards
  const annualBenefitEl = document.getElementById("annualBenefit");
  const bcrValueEl = document.getElementById("bcrValue");
  const selNameTopEl = document.getElementById("selNameTop");

  if (annualBenefitEl) annualBenefitEl.textContent = fmt2(annual);
  if (bcrValueEl) bcrValueEl.textContent = fmt2(bcr);
  if (selNameTopEl) selNameTopEl.textContent = sel.name;

  // calculator results
  const selNameEl = document.getElementById("selName");
  const selAnnualEl = document.getElementById("selAnnual");
  const selNPVEl = document.getElementById("selNPV");
  const selBCREl = document.getElementById("selBCR");

  if (selNameEl) selNameEl.textContent = sel.name;
  if (selAnnualEl) selAnnualEl.textContent = fmt2(annual);
  if (selNPVEl) selNPVEl.textContent = fmt2(npv);
  if (selBCREl) selBCREl.textContent = fmt2(bcr);

  // meta pills
  const metaRateEl = document.getElementById("metaRate");
  const metaYearsEl = document.getElementById("metaYears");
  if (metaRateEl) metaRateEl.textContent = `${ratePct}%`;
  if (metaYearsEl) metaYearsEl.textContent = String(years);
}

function wireCalculator() {
  const rateEl = document.getElementById("rate");
  const yearsEl = document.getElementById("years");

  rateEl?.addEventListener("input", updateAll);
  yearsEl?.addEventListener("input", updateAll);

  document.querySelectorAll("[data-rate]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = Number(btn.getAttribute("data-rate"));
      const safe = clamp(v, 0, 20);
      const el = document.getElementById("rate");
      if (el) el.value = String(safe);
      updateAll();
    });
  });
}

/* =========================
   UI: Print
========================= */

function wirePrint() {
  const btn = document.getElementById("printBtn");
  btn?.addEventListener("click", () => window.print());
}

/* =========================
   UI: ESRI baseline module
========================= */

function setActivePlace(key) {
  const place = esriPlaces[key];
  if (!place) return;

  state.placeKey = key;

  const bizEl = document.getElementById("bizCount");
  const empEl = document.getElementById("empCount");
  if (bizEl) bizEl.textContent = fmtInt(place.businesses);
  if (empEl) empEl.textContent = fmtInt(place.employees);

  const img = document.getElementById("esriImg");
  if (img) img.src = place.screenshot;

  updateJobScale();
  stylePlaceButtons();
}

function stylePlaceButtons() {
  const bax = document.getElementById("btnBaxter");
  const brd = document.getElementById("btnBrainerd");
  if (!bax || !brd) return;

  const active = state.placeKey;
  bax.style.borderColor = (active === "baxter") ? "rgba(255,59,59,.55)" : "rgba(255,255,255,.10)";
  brd.style.borderColor = (active === "brainerd") ? "rgba(255,59,59,.55)" : "rgba(255,255,255,.10)";
}

function updateJobScale() {
  const place = esriPlaces[state.placeKey];
  if (!place) return;

  const direct = clamp(Number(document.getElementById("directJobs")?.value), 0, 1e9);
  const mult = clamp(Number(document.getElementById("jobMult")?.value), 1, 100);

  const total = Math.round(direct * mult);
  const share = place.employees > 0 ? (total / place.employees) * 100 : 0;

  const totalEl = document.getElementById("totalJobs");
  const shareEl = document.getElementById("jobShare");
  if (totalEl) totalEl.textContent = fmtInt(total);
  if (shareEl) shareEl.textContent = Number.isFinite(share) ? share.toFixed(2) : "—";
}

function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.setAttribute("aria-hidden", "true");
}

function wireEsriContext() {
  const bax = document.getElementById("btnBaxter");
  const brd = document.getElementById("btnBrainerd");
  const method = document.getElementById("btnMethod");
  const esri = document.getElementById("btnEsri");

  const direct = document.getElementById("directJobs");
  const mult = document.getElementById("jobMult");

  bax?.addEventListener("click", () => setActivePlace("baxter"));
  brd?.addEventListener("click", () => setActivePlace("brainerd"));

  direct?.addEventListener("input", updateJobScale);
  mult?.addEventListener("input", updateJobScale);

  method?.addEventListener("click", () => {
    const el = document.getElementById("methodology");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  esri?.addEventListener("click", () => openModal("esriModal"));

  const modal = document.getElementById("esriModal");
  modal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal("esriModal");
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal("esriModal");
  });

  setActivePlace(state.placeKey);
}

/* =========================
   Master update
========================= */

function updateAll() {
  renderTable();
  updateKPIs();
}

/* =========================
   Boot
========================= */

(function boot() {
  state.selectedName = bestAlternativeName(alternatives);

  renderTable();
  renderChart();
  wireSorting();
  wireCalculator();
  wireEsriContext();
  wirePrint();
  updateKPIs();
})();
