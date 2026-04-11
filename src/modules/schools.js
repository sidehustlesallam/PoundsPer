// src/modules/schools.js
// Education Intelligence Module for £PER v14 (Hybrid Layout)

import { state } from "../core/state.js";
import { workerFetch, isError } from "../core/fetcher.js";
import { cleanText } from "../core/utils.js";

// ---------------------------------------------------------
// Normalise a single school entry
// ---------------------------------------------------------
function normaliseSchool(raw) {
  if (!raw) return null;

  return {
    name: cleanText(raw.name || "Unknown School"),
    rating: cleanText(raw.rating || "NOT_RATED"),
    category: cleanText(raw.category || "School"),
    distance: cleanText(raw.distance_text || "N/A"),
  };
}

// ---------------------------------------------------------
// Fetch nearest schools (via Worker)
// ---------------------------------------------------------
export async function fetchSchools(postcode) {
  const res = await workerFetch({
    schools: 1,
    postcode,
  });

  if (isError(res)) {
    state.schools = [];
    return { error: "SCHOOLS_FETCH_ERROR" };
  }

  const rawList = res.schools || [];
  const normalised = rawList.map(normaliseSchool).filter(Boolean);

  // Keep only the nearest 3
  state.schools = normalised.slice(0, 3);

  return state.schools;
}

// ---------------------------------------------------------
// Utility: return a safe list of 3 schools
// ---------------------------------------------------------
export function getSchools() {
  if (!state.schools || state.schools.length === 0) {
    return [
      { name: "No schools found", rating: "N/A", category: "N/A", distance: "N/A" },
    ];
  }
  return state.schools;
}