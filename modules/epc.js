// src/modules/epc.js — £PER v14 EPC Module (v28)

import {
  epcSearchByPostcode,
  epcSearchByUprn,
  epcFetchCertificate,
  ensureArray,
  isError
} from "../core/fetcher.js?v=26";

/**
 * Fetches EPC rows for a given postcode or UPRN.
 * Includes robust error handling for API failures.
 * @param {object} params - Contains postcode and uprn.
 * @returns {Promise<{rows: Array, error: object|null}>}
 */
export async function getEpcRows({ postcode, uprn }) {
  try {
    let res;
    if (uprn) {
      res = await epcSearchByUprn(uprn);
    } else if (postcode) {
      res = await epcSearchByPostcode(postcode);
    } else {
      return { rows: [], error: { message: "Postcode or UPRN is required." } };
    }

    if (isError(res)) {
      return { rows: [], error: res };
    }
    return { rows: ensureArray(res.rows), error: null };
  } catch (e) {
    console.error("Error fetching EPC rows:", e);
    // Fallback structure on network/runtime error
    return { rows: [], error: { message: `Failed to fetch EPC data due to a runtime error: ${e.message}` } };
  }
}

/**
 * Fetches the detailed EPC certificate for a given RRN.
 * Includes robust error handling for API failures.
 * @param {string} rrn - The RRN of the property.
 * @returns {Promise<{epc: object|null, error: object|null}>}
 */
export async function getEpcCertificate(rrn) {
  try {
    const res = await epcFetchCertificate(rrn);
    if (isError(res)) return { epc: null, error: res };
    const cert = normaliseEpc(res);
    return { epc: cert, error: null };
  } catch (e) {
    console.error("Error fetching EPC certificate:", e);
    // Fallback structure on network/runtime error
    return { epc: null, error: { message: `Failed to fetch EPC certificate due to a runtime error: ${e.message}` } };
  }
}

/**
 * Normalizes raw EPC data into a consistent structure.
 * @param {object} raw - The raw data object from the API.
 * @returns {object|null}
 */
export function normaliseEpc(raw) {
  if (!raw) return null;
  return {
    rrn: raw.rrn || raw.lmk_key || null,
    address: raw.address || [raw.address1, raw.address2, raw.address3, raw.postcode].filter(Boolean).join(", "),
    postcode: raw.postcode || null,
    uprn: raw.uprn || null,
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    propertyType: raw.property_type || null,
    builtForm: raw.built_form || null,
    floorArea: Number(raw.total_floor_area || raw.floor_area || 0) || null,
    currentRating: raw.current_energy_rating || null,
    potentialRating: raw.potential_energy_rating || null,
    lodgementDate: raw.lodgement_date || null,
    localAuthority: raw.local_authority || null
  };
}

/**
 * Selects a specific row from the fetched EPC rows array.
 * @param {Array} rows - Array of EPC rows.
 * @param {number} index - Index of the row to pick.
 * @returns {object|null}
 */
export function pickEpcRow(rows, index) {
  if (!rows || rows.length === 0) return null;
  return rows[index] || null;
}