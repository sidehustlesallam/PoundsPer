/**
 * £Per Audit Engine
 * - Main application entry point.
 * - Initializes state, binds event listeners, and orchestrates the audit workflow
 *   by calling functions from core/engine.js.
 */

import {
  initializeApp
} from './core/engine.js';

// --- GLOBAL STATE ---
window.__PER_STATE__ = {
  epc: null,
  schools: [],
  ppi: [],
  flood: null,
  radon: null,
  map: null,
  mapLayers: {
    epc: null,
    schools: null,
    ppi: null,
    flood: null,
    radon: null,
  },
  activeLayers: {
    epc: true,
    schools: true,
    ppi: true,
    flood: true,
    radon: true,
  },
  potentialAddresses: [],
  epcError: null,
};

// --- UI HELPERS ---
function updateStatus(msg, type) {
  const text = document.getElementById("statusText");
  const dot = document.getElementById("statusDot");
  if (text) text.innerText = msg.toUpperCase();
  if (!dot) return;

  let cls = "w-1.5 h-1.5 rounded-full ";
  if (type === "loading") cls += "bg-sky-400 animate-pulse";
  else if (type === "error") cls += "bg-red-600 shadow-[0_0_8px_rgba(248,113,113,0.8)]";
  else cls += "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]";
  dot.className = cls;
}

function setEpcState(state, meta = "") {
  const badge = document.getElementById("epcBadge");
  const metaEl = document.getElementById("epcMeta");
  if (!badge) return;

  badge.classList.remove("bg-red-500", "animate-pulse");
  if (state === "pending") {
    badge.classList.add("animate-pulse");
    badge.innerText = "?";
    if (metaEl) metaEl.innerText = "EPC_QUERY_ACTIVE";
  } else if (state === "error") {
    badge.classList.add("bg-red-500");
    badge.innerText = "!";
    if (metaEl) metaEl.innerText = meta || "EPC_ERROR";
  } else if (state === "ready") {
    if (metaEl && meta) metaEl.innerText = meta;
  }
}

// --- GENERIC PROXY FETCH ---
async function safeFetch(url) {
  try {
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    const text = await res.text();
    if (!text || text.startsWith("<!DOCTYPE")) return { error: "INVALID_RESPONSE" };
    return JSON.parse(text);
  } catch (e) {
    return { error: "NETWORK_EXCEPTION", message: e.message };
  }
}

// --- INITIALIZATION ---
/**
 * Main initialization function. Binds all event listeners and runs initial setup.
 * @param {object} modules - Object containing all module functions.
 */
function initializeApp(modules) {
  // Bind global handlers
  window.handleDiscovery = async function () {
    const input = document.getElementById("mainInput").value.trim();
    await coreEngine.handleDiscovery(input, window.__PER_STATE__, updateStatus, safeFetch, modules);
  };

  window.selectAddress = function () {
    const idx = document.getElementById("addressDropdown").value;
    coreEngine.selectAddress(idx, window.__PER_STATE__, modules);
  };
}

// Exporting the initialization function
export {
  initializeApp
};
