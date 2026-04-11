// src/modules/risk.js
// Environmental Risk Module for £PER v14 (Hybrid Layout)

import { state } from "../core/state.js";
import { workerFetch, isError } from "../core/fetcher.js";
import { cleanText } from "../core/utils.js";

// ---------------------------------------------------------
// Normalise flood risk response
// ---------------------------------------------------------
function normaliseFlood(raw) {
  if (!raw) {
    return {
      summary: "No data",
      river: "N/A",
      surface: "N/A",
      groundwater: "N/A",
    };
  }

  return {
    summary: cleanText(raw.summary || "Unknown"),
    river: cleanText(raw.river || "N/A"),
    surface: cleanText(raw.surface || "N/A"),
    groundwater: cleanText(raw.groundwater || "N/A"),
  };
}

// ---------------------------------------------------------
// Normalise radon risk response
// ---------------------------------------------------------
function normaliseRadon(raw) {
  if (!raw) {
    return {
      band: "No data",
      percentage: "N/A",
    };
  }

  return {
    band: cleanText(raw.band || "Unknown"),
    percentage: cleanText(raw.percentage || "N/A"),
  };
}

// ---------------------------------------------------------
// Fetch flood risk (via Worker)
// ---------------------------------------------------------
export async function fetchFloodRisk(postcode) {
  const res = await workerFetch({
    flood: 1,
    postcode,
  });

  if (isError(res)) {
    state.flood = normaliseFlood(null);
    return { error: "FLOOD_FETCH_ERROR" };
  }

  state.flood = normaliseFlood(res);
  return state.flood;
}

// ---------------------------------------------------------
// Fetch radon risk (via Worker)
// ---------------------------------------------------------
export async function fetchRadonRisk(postcode) {
  const res = await workerFetch({
    radon: 1,
    postcode,
  });

  if (isError(res)) {
    state.radon = normaliseRadon(null);
    return { error: "RADON_FETCH_ERROR" };
  }

  state.radon = normaliseRadon(res);
  return state.radon;
}

// ---------------------------------------------------------
// Convenience getters
// ---------------------------------------------------------
export function getFloodRisk() {
  return state.flood || normaliseFlood(null);
}

export function getRadonRisk() {
  return state.radon || normaliseRadon(null);
}