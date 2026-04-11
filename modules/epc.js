// src/modules/epc.js — £PER v14 EPC Module (v26)

import {
  epcSearchByPostcode,
  epcSearchByUprn,
  epcFetchCertificate,
  ensureArray,
  isError
} from "../core/fetcher.js?v=26";

import { state } from "../core/state.js?v=26";

// -------------------------------------------------------
// EPC-FIRST → POSTCODE FALLBACK LOGIC
// -------------------------------------------------------
export async function getEpcForPostcode(postcode) {
  // 1) Try EPC search
  const epcRes = await epcSearchByPostcode(postcode);

  if (isError(epcRes)) {
    return { epc: null, rows: [], error: epcRes };
  }

  const rows = ensureArray(epcRes.rows);

  // 2) If EPC rows exist → return them
  if (rows.length > 0) {
    return { epc: null, rows, error: null };
  }

  // 3) Fallback: no EPC → return null EPC but allow scan to continue
  return { epc: null, rows: [], error: null };
}

// -------------------------------------------------------
// Fetch full EPC certificate by RRN
// -------------------------------------------------------
export async function getEpcCertificate(rrn) {
  const res = await epcFetchCertificate(rrn);

  if (isError(res)) {
    return { epc: null, error: res };
  }

  const cert = normaliseEpc(res);
  return { epc: cert, error: null };
}

// -------------------------------------------------------
// Normalisation
// -------------------------------------------------------
export function normaliseEpc(raw) {
  if (!raw) return null;

  return {
    rrn: raw.rrn || null,
    address: raw.address || null,
    postcode: raw.postcode || null,
    uprn: raw.uprn || null,

    // Coordinates
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,

    // Property details
    propertyType: raw.property_type || null,
    builtForm: raw.built_form || null,
    floorArea: raw.total_floor_area || null,

    // Ratings
    currentRating: raw.current_energy_rating || null,
    potentialRating: raw.potential_energy_rating || null,

    // Admin
    lodgementDate: raw.lodgement_date || null,
    localAuthority: raw.local_authority || null
  };
}

// -------------------------------------------------------
// Utility: pick EPC row by index
// -------------------------------------------------------
export function pickEpcRow(rows, index) {
  if (!rows || rows.length === 0) return null;
  return rows[index] || null;
}