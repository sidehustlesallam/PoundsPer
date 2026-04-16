// app.js — £PER v14 Orchestrator (v28)

import { state, resetState } from "./core/state.js?v=28";
import { getEpcRows, getEpcCertificate, pickEpcRow } from "./modules/epc.js?v=28";
import { fetchPpi, applyHpiAdjustments, computeMarketAverages } from "./modules/ppi.js?v=28";
import { fetchSchools } from "./modules/schools.js?v=28";
import { fetchFloodRisk, fetchRadonRisk } from "./modules/risk.js?v=28";
import { fetchUtilities } from "./modules/utilities.js?v=28";
import { renderAll } from "./modules/render.js?v=28";
import { initMap } from "./modules/map.js?v=26";

function $(id) { return document.getElementById(id); }
function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function cleanPostcode(input = "") { return String(input).trim().toUpperCase(); }
function cleanUprn(input = "") { return String(input).replace(/\D+/g, "").trim(); }

function populatePropertyPicker(rows) {
  const picker = $("property-picker");
  if (!picker) return;

  picker.innerHTML = '<option value="">Select EPC address…</option>';
  rows.forEach((row, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    const label = row.address || [row.address1, row.address2, row.address3, row.postcode].filter(Boolean).join(", ");
    option.textContent = label || `EPC option ${idx + 1}`;
    picker.appendChild(option);
  });

  picker.hidden = rows.length === 0;
}

/**
 * Executes the full data fetching and rendering pipeline.
 * This function is now decoupled from the success of the EPC search.
 * @param {string} postcode - The primary postcode for the scan.
 */
async function runDownstream(postcode) {
  setText("status", "Fetching Market Evidence...");
  await fetchPpi(postcode);
  
  // Pass localAuthority from state.epc if available, otherwise null.
  const localAuthority = state.epc?.localAuthority || null;
  await applyHpiAdjustments(state.ppi?.rows || [], localAuthority);
  computeMarketAverages();

  setText("status", "Fetching School Data...");
  await fetchSchools(postcode);

  setText("status", "Fetching Utilities...");
  await fetchUtilities(postcode);

  setText("status", "Fetching Environmental Risks...");
  await Promise.allSettled([fetchFloodRisk(postcode), fetchRadonRisk(postcode)]);

  setText("status", "Initializing Map...");
  initMap("map");

  setText("status", "Rendering results...");
  renderAll();
}

/**
 * Handles the selection of a specific EPC property row.
 * This triggers the full downstream scan using the selected property's data.
 * @param {number} index - Index of the selected EPC row.
 * @param {string} postcodeFallback - The postcode from the input field.
 */
async function locateBySelection(index, postcodeFallback) {
  const row = pickEpcRow(state.epcRows, index);
  if (!row) return;

  const rrn = row.rrn || row.lmk_key;
  if (rrn) {
    const certRes = await getEpcCertificate(rrn);
    if (!certRes.error) {
      state.epcDetail = certRes.epc;
      state.epc = certRes.epc;
    }
  }

  // Use the postcode from the selected row, or the fallback, or the state.
  const postcode = row.postcode || postcodeFallback;
  if (!postcode) return;
  
  await runDownstream(postcode);
  setText("status", "Scan complete (Selected Property)");
}

/**
 * Main handler for the search form submission.
 * Orchestrates the EPC search and determines the next action (select or fallback scan).
 * @param {string} postcode - The entered postcode.
 * @param {string} uprn - The entered UPRN.
 */
async function handleSearch(postcode, uprn) {
  resetState();
  setText("status", "Searching EPC…");

  const epcRes = await getEpcRows({ postcode, uprn });
  state.epcRows = epcRes.rows;

  if (epcRes.error) {
    console.error("EPC Search Error:", epcRes.error);
    setText("status", `EPC search failed: ${epcRes.error.message || 'Check network or API status.'}`);
  }

  if (state.epcRows.length > 0) {
    populatePropertyPicker(state.epcRows);
    // Automatically select the first row and run the full scan
    await locateBySelection(0, postcode);
    return;
  }

  // Fallback path: No EPC rows found, but we have a postcode.
  populatePropertyPicker([]);
  state.epc = null;
  state.epcDetail = null;

  if (postcode) {
    setText("status", "No EPC found. Running full postcode fallback scan...");
    // Run the full scan using only the postcode, decoupling from EPC success.
    await runDownstream(postcode);
    setText("status", "Scan complete (Postcode Fallback)");
  } else {
    setText("status", "No EPC found for UPRN and no postcode fallback provided.");
  }
}

function bindUI() {
  const form = $("search-form");
  const postcodeInput = $("postcode-input");
  const uprnInput = $("uprn-input");
  const picker = $("property-picker");
  if (!form || !postcodeInput || !uprnInput || !picker) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const postcode = cleanPostcode(postcodeInput.value);
    const uprn = cleanUprn(uprnInput.value);

    if (!postcode && !uprn) {
      setText("status", "Enter postcode or UPRN.");
      return;
    }

    try {
      await handleSearch(postcode, uprn);
    } catch (err) {
      console.error(err);
      setText("status", "Scan failed. Please try again.");
    }
  });

  picker.addEventListener("change", async () => {
    if (picker.value === "") return;
    setText("status", "Loading selected EPC property…");
    try {
      await locateBySelection(Number(picker.value), cleanPostcode(postcodeInput.value));
    } catch (err) {
      console.error(err);
      setText("status", "Failed to load selected property.");
    }
  });
}

bindUI();