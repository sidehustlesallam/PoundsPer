// src/app.js
// Orchestrator for £PER v14 (Hybrid Layout)

import { state, resetState } from "./core/state.js";
import { searchEpcByPostcode, fetchEpcDetail, normaliseEpc } from "./modules/epc.js";
import { fetchPpi, enrichPpiWithAreas, applyHpiAdjustments, computeMarketAverages } from "./modules/ppi.js";
import { fetchSchools } from "./modules/schools.js";
import { fetchFloodRisk, fetchRadonRisk } from "./modules/risk.js";
import { fetchUtilities } from "./modules/utilities.js";
import { renderAll } from "./modules/render.js";
import { initMap } from "./modules/map.js";


// -----------------------------
// DOM helpers
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// -----------------------------
// Main scan flow
// -----------------------------
async function scanProperty(postcode) {
  resetState();
  setText("status", "Scanning…");

  // 1) EPC search by postcode → pick best match (for now: first row)
  const epcRows = await searchEpcByPostcode(postcode);
  if (epcRows.error || !epcRows.length) {
    setText("status", "No EPC found for this postcode");
    return;
  }

  const first = epcRows[0];
  const detail = await fetchEpcDetail(first.rrn);
  state.epcDetail = detail;
  state.epc = normaliseEpc(detail);

  // Init map early
  initMap("map");

  // 2) PPI fetch
  await fetchPpi(postcode);

  // 3) Enrich PPI with EPC areas
  await enrichPpiWithAreas(postcode);

  // 4) Apply HPI adjustments (if we have LA)
  if (state.epc && state.epc.localAuthority) {
    await applyHpiAdjustments(state.epc.localAuthority);
  }

  // 5) Compute market averages (for future use / header)
  const avgs = computeMarketAverages();
  console.log("Market averages:", avgs);

  // 6) Schools
  await fetchSchools(postcode);

  // 7) Utilities
  await fetchUtilities(postcode);

  // 8) Risk
  await fetchFloodRisk(postcode);
  await fetchRadonRisk(postcode);

  // 9) Render everything
  renderAll();
  setText("status", "Scan complete");
}

// -----------------------------
// Wire up UI
// -----------------------------
function initApp() {
  const form = $("search-form");
  const input = $("postcode-input");

  if (!form || !input) {
    console.error("Form or input not found");
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const postcode = input.value.trim();
    if (!postcode) return;
    scanProperty(postcode);
  });

  // Optional: auto-focus input
  input.focus();
}

// -----------------------------
// Boot
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});