// app.js — £PER v14 Orchestrator (v26)

import { state, resetState } from "./core/state.js?v=26";

import { 
  getEpcForPostcode,
  getEpcCertificate,
  pickEpcRow
} from "./modules/epc.js?v=26";

import { 
  fetchPpi,
  enrichPpiWithAreas,
  applyHpiAdjustments,
  computeMarketAverages
} from "./modules/ppi.js?v=26";

import { fetchSchools } from "./modules/schools.js?v=26";
import { fetchFloodRisk, fetchRadonRisk } from "./modules/risk.js?v=26";
import { fetchUtilities } from "./modules/utilities.js?v=26";
import { renderAll } from "./modules/render.js?v=26";
import { initMap } from "./modules/map.js?v=26";

// -------------------------------------------------------
// DOM helpers
// -------------------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// -------------------------------------------------------
// MAIN SCAN FLOW (EPC-FIRST → POSTCODE FALLBACK)
// -------------------------------------------------------
async function scanProperty(postcode) {
  resetState();
  setText("status", "Scanning…");

  // ---------------------------------------------------
  // 1) EPC-FIRST
  // ---------------------------------------------------
  const epcResult = await getEpcForPostcode(postcode);

  if (epcResult.error) {
    console.error("EPC error:", epcResult.error);
  }

  const rows = epcResult.rows;

  // ---------------------------------------------------
  // 2) If EPC rows exist → pick first row + fetch cert
  // ---------------------------------------------------
  if (rows.length > 0) {
    const first = pickEpcRow(rows, 0);
    if (first && first.rrn) {
      const certRes = await getEpcCertificate(first.rrn);

      if (!certRes.error) {
        state.epcDetail = certRes.epc;
        state.epc = certRes.epc;
      }
    }
  } else {
    // ---------------------------------------------------
    // 3) EPC fallback: no EPC → continue with postcode only
    // ---------------------------------------------------
    console.warn("No EPC found — using postcode fallback");
    state.epc = null;
    state.epcDetail = null;
  }

  // ---------------------------------------------------
  // 4) Init map early (if EPC has coords, map will center)
  // ---------------------------------------------------
  initMap("map");

  // ---------------------------------------------------
  // 5) PPI
  // ---------------------------------------------------
  await fetchPpi(postcode);
  await enrichPpiWithAreas(postcode);

  // ---------------------------------------------------
  // 6) HPI adjustments (only if EPC has LA)
  // ---------------------------------------------------
  if (state.epc && state.epc.localAuthority) {
    await applyHpiAdjustments(state.epc.localAuthority);
  }

  // ---------------------------------------------------
  // 7) Market averages
  // ---------------------------------------------------
  const avgs = computeMarketAverages();
  console.log("Market averages:", avgs);

  // ---------------------------------------------------
  // 8) Schools
  // ---------------------------------------------------
  await fetchSchools(postcode);

  // ---------------------------------------------------
  // 9) Utilities
  // ---------------------------------------------------
  await fetchUtilities(postcode);

  // ---------------------------------------------------
  // 10) Risk
  // ---------------------------------------------------
  await fetch