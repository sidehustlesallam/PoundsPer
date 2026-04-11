// src/modules/render.js — £PER v14 Render Module (v26)

import { state } from "../core/state.js?v=26";

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? "";
}

export function renderAll() {
  renderEpc();
  renderPpi();
  renderSchools();
  renderRisk();
  renderUtilities();
}

function renderEpc() {
  if (!state.epcDetail) {
    setText("epc-summary", "No EPC found for this postcode.");
    return;
  }

  const e = state.epcDetail;
  setText(
    "epc-summary",
    `${e.address || "Unknown address"} — rating ${e.currentRating || "?"}`
  );
}

function renderPpi() {
  if (!state.market || state.market.mid == null) {
    setText("ppi-summary", "No PPI data available.");
    return;
  }
  setText("ppi-summary", `Estimated median value: £${state.market.mid.toLocaleString()}`);
}

function renderSchools() {
  if (!state.schools) {
    setText("schools-summary", "No schools data yet.");
    return;
  }
  setText("schools-summary", "Schools data loaded.");
}

function renderRisk() {
  const flood = state.flood ? "Flood data loaded" : "No flood data";
  const radon = state.radon ? "Radon data loaded" : "No radon data";
  setText("risk-summary", `${flood} · ${radon}`);
}

function renderUtilities() {
  if (!state.utilities) {
    setText("utilities-summary", "No utilities data yet.");
    return;
  }
  setText("utilities-summary", "Utilities data loaded.");
}