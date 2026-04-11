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

async function runDownstream(postcode) {
  await fetchPpi(postcode);
  await applyHpiAdjustments(state.ppi?.rows || [], state.epc?.localAuthority || null);
  computeMarketAverages();
  await fetchSchools(postcode);
  await fetchUtilities(postcode);
  await Promise.allSettled([fetchFloodRisk(postcode), fetchRadonRisk(postcode)]);
  initMap("map");
  renderAll();
}

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

  const postcode = state.epc?.postcode || row.postcode || postcodeFallback;
  if (!postcode) return;
  await runDownstream(postcode);
  setText("status", "Scan complete");
}

async function handleSearch(postcode, uprn) {
  resetState();
  setText("status", "Searching EPC…");

  const epcRes = await getEpcRows({ postcode, uprn });
  state.epcRows = epcRes.rows;

  if (epcRes.error) {
    console.error(epcRes.error);
    setText("status", "EPC search failed, using postcode fallback.");
  }

  if (state.epcRows.length > 0) {
    populatePropertyPicker(state.epcRows);
    await locateBySelection(0, postcode);
    return;
  }

  populatePropertyPicker([]);
  state.epc = null;
  state.epcDetail = null;

  if (postcode) {
    setText("status", "No EPC found. Running postcode fallback scan…");
    await runDownstream(postcode);
    setText("status", "Scan complete (postcode fallback)");
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