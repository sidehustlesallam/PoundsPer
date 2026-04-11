// src/modules/render.js — £PER v14 Render Module (v27)

import { state } from "../core/state.js?v=26";

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? "";
}

function money(value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `£${Number(value).toLocaleString()}`;
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
  const el = $("market-evidence");
  if (!el) return;

  if (!state.ppi || !state.ppi.rows || state.ppi.rows.length === 0) {
    el.textContent = "No recent sales evidence available.";
    return;
  }

  const rows = state.ppi.rows
    .map((r) => `${r.date || "Unknown date"}: ${r.paon || ""} ${r.street || ""} — ${money(r.amount)}`)
    .join("\n");

  const median = state.market?.mid != null ? `\nMedian: ${money(state.market.mid)}` : "";
  el.textContent = `${rows}${median}`;
}

function renderSchools() {
  const el = $("schools");
  if (!el) return;

  if (!state.schools || state.schools.error) {
    el.textContent = "No schools data available.";
    return;
  }

  const name = state.schools.name || "Unknown";
  const rating = state.schools.rating || "Not found";
  const phase = state.schools.phase || "Unknown";
  el.textContent = `${name} · ${phase} · ${rating}`;
}

function renderRisk() {
  const el = $("risk");
  if (!el) return;

  const flood = state.flood?.summary || state.flood?.error || "No flood data";
  const radon = state.radon?.level || state.radon?.error || "No radon data";
  el.textContent = `Flood: ${flood} | Radon: ${radon}`;
}

function renderUtilities() {
  const el = $("utilities");
  if (!el) return;

  if (!state.utilities || state.utilities.error) {
    el.textContent = "No utilities data available.";
    return;
  }

  const u = state.utilities;
  el.textContent = `Broadband: ${u.broadband || "Unknown"}, Water: ${u.water || "Unknown"}, Council: ${u.council || "Unknown"}`;
}