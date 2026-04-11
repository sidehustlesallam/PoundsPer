// app.js — £PER v14 Orchestrator (v27)

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
} from "./modules/ppi.js?v=27";

import { fetchSchools } from "./modules/schools.js?v=26";
import { fetchFloodRisk, fetchRadonRisk } from "./modules/risk.js?v=27";
import { fetchUtilities } from "./modules/utilities.js?v=26";
import { renderAll } from "./modules/render.js?v=27";
import { initMap } from "./modules/map.js?v=26";

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function cleanPostcode(input = "") {
  return String(input).trim().toUpperCase();
}

async function scanProperty(postcode) {
  resetState();
  setText("status", "Scanning…");

  const epcResult = await getEpcForPostcode(postcode);
  if (epcResult.error) {
    console.error("EPC error:", epcResult.error);
  }

  const rows = epcResult.rows;
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
    console.warn("No EPC found — using postcode fallback");
    state.epc = null;
    state.epcDetail = null;
  }

  initMap("map");

  await fetchPpi(postcode);
  await enrichPpiWithAreas(postcode);

  if (state.epc && state.epc.localAuthority) {
    await applyHpiAdjustments(state.epc.localAuthority);
  }

  computeMarketAverages();

  await fetchSchools(postcode);
  await fetchUtilities(postcode);

  await Promise.allSettled([
    fetchFloodRisk(postcode),
    fetchRadonRisk(postcode)
  ]);

  renderAll();
  setText("status", "Scan complete");
}

function bindUI() {
  const form = $("search-form");
  const input = $("postcode-input");

  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const postcode = cleanPostcode(input.value);
    if (!postcode) {
      setText("status", "Enter a postcode to scan.");
      return;
    }

    try {
      await scanProperty(postcode);
    } catch (err) {
      console.error(err);
      setText("status", "Scan failed. Please try again.");
    }
  });
}

bindUI();