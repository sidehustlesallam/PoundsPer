// src/modules/render.js — £PER v14 Render Module (v28)

import { state } from "../core/state.js?v=28";

function $(id) { return document.getElementById(id); }
function money(value) { return value == null || Number.isNaN(value) ? "N/A" : `£${Number(value).toLocaleString()}`; }

export function renderAll() {
  renderEpc();
  renderPpi();
  renderSchools();
  renderRisk();
  renderUtilities();
}

function renderEpc() {
  const el = $("epc-summary");
  if (!el) return;

  if (!state.epcDetail) {
    el.textContent = "No EPC selected. Using postcode-level fallback where possible.";
    return;
  }

  const e = state.epcDetail;
  el.textContent = `${e.address || "Unknown address"}\nEPC ${e.currentRating || "?"} | Floor area ${e.floorArea || "N/A"} sqm | UPRN ${e.uprn || "N/A"}`;
}

function renderPpi() {
  const el = $("market-evidence");
  if (!el) return;

  const rows = state.hpiAdjustedRows.length ? state.hpiAdjustedRows : (Array.isArray(state.ppi?.rows) ? state.ppi.rows : []);
  if (!rows.length) {
    el.textContent = "No recent sales evidence available.";
    return;
  }

  const lines = rows.map((r, idx) => {
    const addr = [r.paon, r.street, r.postcode].filter(Boolean).join(" ");
    return `${idx + 1}. ${addr}\n   Sold: ${r.date || "N/A"} @ ${money(r.amount)} | Area: ${r.floorArea || "N/A"} sqm (${r.floorAreaSqft || "N/A"} sqft)\n   Today est.: ${money(r.projectedValue)} | £/sqm: ${r.pricePerSqm ?? "N/A"} | £/sqft: ${r.pricePerSqft ?? "N/A"}`;
  });

  const m = state.market || {};
  lines.push(`\nAverages (${m.count || 0} sales): Price ${money(m.averagePrice)} | £/sqm ${m.averagePricePerSqm ?? "N/A"} | £/sqft ${m.averagePricePerSqft ?? "N/A"}`);
  el.textContent = lines.join("\n");
}

function renderSchools() {
  const el = $("schools");
  if (!el) return;

  const providers = state.schools?.providers || [];
  if (!providers.length) {
    el.textContent = "No schools data available.";
    return;
  }

  el.textContent = providers.map((s, idx) => `${idx + 1}. ${s.name} | ${s.type} | ${s.rating}`).join("\n");
}

function renderRisk() {
  const el = $("risk");
  if (!el) return;
  el.textContent = `Flood: ${state.flood?.summary || "No flood data"}\nRadon: ${state.radon?.level || "No radon data"}`;
}

function renderUtilities() {
  const el = $("utilities");
  if (!el) return;

  const u = state.utilities;
  if (!u || u.error) {
    el.textContent = "No utilities data available.";
    return;
  }

  el.textContent = `Council: ${u.council || "Unknown"}\nWater: ${u.water || "Unknown"}\nBroadband (max expected): ${u.broadband || "Unknown"}`;
}