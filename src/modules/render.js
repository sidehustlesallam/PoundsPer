// src/modules/render.js
// DOM rendering for £PER v14 (Hybrid Layout)

import { state } from "../core/state.js";
import { formatMoney } from "../core/utils.js";
import { renderMap } from "./map.js";

// ---------------------------------------------------------
// Helper: safely set innerHTML
// ---------------------------------------------------------
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ---------------------------------------------------------
// Render EPC summary in the header
// ---------------------------------------------------------
export function renderEpcSummary() {
  if (!state.epc) {
    setHTML("epc-summary", "<p>No EPC data</p>");
    return;
  }

  const epc = state.epc;

  setHTML(
    "epc-summary",
    `
      <div class="epc-summary">
        <h3>${epc.address}</h3>
        <p><strong>UPRN:</strong> ${epc.uprn}</p>
        <p><strong>Postcode:</strong> ${epc.postcode}</p>
        <p><strong>Area:</strong> ${epc.area ? epc.area + " m²" : "N/A"}</p>
        <p><strong>Rating:</strong> ${epc.rating}</p>
      </div>
    `
  );
}

// ---------------------------------------------------------
// Render Market Evidence (full-width table)
// ---------------------------------------------------------
export function renderMarketEvidence() {
  const rows = state.ppiEnriched || [];

  if (!rows.length) {
    setHTML("market-evidence", "<p>No recent sales found</p>");
    return;
  }

  const tableRows = rows
    .map((r) => {
      return `
        <tr>
          <td>${r.date.split("T")[0]}</td>
          <td>${r.addrCore}</td>
          <td>${formatMoney(r.amount)}</td>
          <td>${r.areaSqft ? r.areaSqft.toFixed(0) + " sqft" : "N/A"}</td>
          <td>${r.ppSqft ? "£" + r.ppSqft.toFixed(0) : "N/A"}</td>
          <td>${r.hpiFactor ? r.hpiFactor.toFixed(3) : "N/A"}</td>
          <td>${r.adjPrice ? formatMoney(r.adjPrice) : "N/A"}</td>
        </tr>
      `;
    })
    .join("");

  setHTML(
    "market-evidence",
    `
      <table class="ppi-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Address</th>
            <th>Price</th>
            <th>Area</th>
            <th>£/sqft</th>
            <th>HPI Factor</th>
            <th>Adjusted Price</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `
  );
}

// ---------------------------------------------------------
// Render Education (3 nearest schools)
// ---------------------------------------------------------
export function renderSchools() {
  const schools = state.schools || [];

  if (!schools.length) {
    setHTML("schools", "<p>No schools found</p>");
    return;
  }

  const cards = schools
    .map((s) => {
      return `
        <div class="card">
          <h4>${s.name}</h4>
          <p><strong>Rating:</strong> ${s.rating}</p>
          <p><strong>Category:</strong> ${s.category}</p>
          <p><strong>Distance:</strong> ${s.distance}</p>
        </div>
      `;
    })
    .join("");

  setHTML("schools", cards);
}

// ---------------------------------------------------------
// Render Utilities (broadband, water, council tax, energy)
// ---------------------------------------------------------
export function renderUtilities() {
  const u = state.utilities;

  if (!u) {
    setHTML("utilities", "<p>No utilities data</p>");
    return;
  }

  setHTML(
    "utilities",
    `
      <div class="card">
        <h4>Broadband</h4>
        <p><strong>Tech:</strong> ${u.broadband.tech}</p>
        <p><strong>Max Down:</strong> ${u.broadband.maxDown}</p>
        <p><strong>Providers:</strong> ${u.broadband.providers.join(", ")}</p>
      </div>

      <div class="card">
        <h4>Water & Sewerage</h4>
        <p><strong>Water:</strong> ${u.water.water}</p>
        <p><strong>Sewerage:</strong> ${u.water.sewerage}</p>
      </div>

      <div class="card">
        <h4>Council Tax</h4>
        <p><strong>Band:</strong> ${u.councilTax.band}</p>
        <p><strong>Authority:</strong> ${u.councilTax.authority}</p>
      </div>

      <div class="card">
        <h4>Energy Region</h4>
        <p><strong>Region:</strong> ${u.energy.region}</p>
      </div>
    `
  );
}

// ---------------------------------------------------------
// Render Environmental Risk (flood + radon)
// ---------------------------------------------------------
export function renderRisk() {
  const flood = state.flood;
  const radon = state.radon;

  setHTML(
    "risk",
    `
      <div class="card">
        <h4>Flood Risk</h4>
        <p><strong>Summary:</strong> ${flood.summary}</p>
        <p><strong>River:</strong> ${flood.river}</p>
        <p><strong>Surface:</strong> ${flood.surface}</p>
        <p><strong>Groundwater:</strong> ${flood.groundwater}</p>
      </div>

      <div class="card">
        <h4>Radon Risk</h4>
        <p><strong>Band:</strong> ${radon.band}</p>
        <p><strong>Percentage:</strong> ${radon.percentage}</p>
      </div>
    `
  );
}

// ---------------------------------------------------------
// Render the map + EPC summary (header)
// ---------------------------------------------------------
export function renderHeader() {
  if (state.epc && state.epc.latitude && state.epc.longitude) {
    renderMap(state.epc.latitude, state.epc.longitude);
  }
  renderEpcSummary();
}

// ---------------------------------------------------------
// Render ALL sections (called by app.js)
// ---------------------------------------------------------
export function renderAll() {
  renderHeader();
  renderMarketEvidence();
  renderSchools();
  renderUtilities();
  renderRisk();
}