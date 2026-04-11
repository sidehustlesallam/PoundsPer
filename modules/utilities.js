// src/modules/utilities.js
// Utilities Intelligence Module for £PER v14 (Hybrid Layout)

import { state } from "../core/state.js";
import { workerFetch, isError } from "../core/fetcher.js";
import { cleanText } from "../core/utils.js";

// ---------------------------------------------------------
// Normalise broadband response
// ---------------------------------------------------------
function normaliseBroadband(raw) {
  if (!raw) {
    return {
      tech: "Unknown",
      maxDown: "N/A",
      providers: [],
    };
  }

  return {
    tech: cleanText(raw.tech || "Unknown"),
    maxDown: cleanText(raw.maxDown || "N/A"),
    providers: Array.isArray(raw.providers) ? raw.providers : [],
  };
}

// ---------------------------------------------------------
// Normalise water/sewerage response
// ---------------------------------------------------------
function normaliseWater(raw) {
  if (!raw) {
    return {
      water: "Unknown",
      sewerage: "Unknown",
    };
  }

  return {
    water: cleanText(raw.water || "Unknown"),
    sewerage: cleanText(raw.sewerage || "Unknown"),
  };
}

// ---------------------------------------------------------
// Normalise council tax response
// ---------------------------------------------------------
function normaliseCouncilTax(raw) {
  if (!raw) {
    return {
      band: "Unknown",
      authority: "Unknown",
    };
  }

  return {
    band: cleanText(raw.band || "Unknown"),
    authority: cleanText(raw.authority || "Unknown"),
  };
}

// ---------------------------------------------------------
// Normalise energy region response
// ---------------------------------------------------------
function normaliseEnergy(raw) {
  if (!raw) {
    return {
      region: "Unknown",
    };
  }

  return {
    region: cleanText(raw.region || "Unknown"),
  };
}

// ---------------------------------------------------------
// Fetch utilities bundle (via Worker)
// ---------------------------------------------------------
export async function fetchUtilities(postcode) {
  const res = await workerFetch({
    utilities: 1,
    postcode,
  });

  if (isError(res)) {
    state.utilities = {
      broadband: normaliseBroadband(null),
      water: normaliseWater(null),
      councilTax: normaliseCouncilTax(null),
      energy: normaliseEnergy(null),
    };
    return { error: "UTILITIES_FETCH_ERROR" };
  }

  state.utilities = {
    broadband: normaliseBroadband(res.broadband),
    water: normaliseWater(res.water),
    councilTax: normaliseCouncilTax(res.councilTax),
    energy: normaliseEnergy(res.energy),
  };

  return state.utilities;
}

// ---------------------------------------------------------
// Convenience getter
// ---------------------------------------------------------
export function getUtilities() {
  return (
    state.utilities || {
      broadband: normaliseBroadband(null),
      water: normaliseWater(null),
      councilTax: normaliseCouncilTax(null),
      energy: normaliseEnergy(null),
    }
  );
}