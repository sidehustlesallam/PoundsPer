/**
 * £Per EPC Module
 * - Handles fetching, normalizing, and structuring Energy Performance Certificate data.
 * - This module is responsible for data retrieval only and must not manipulate the DOM.
 */

/**
 * Normalizes raw EPC data into a standardized object.
 * @param {object} epcRaw - Raw data from the EPC API.
 * @returns {object} Standardized EPC object.
 */
function normalizeEpc(epcRaw) {
  const epc = epcRaw || {};
  const area = parseFloat(epc["total-floor-area"]) || 0;
  const lat = parseFloat(epc.latitude || epc["latitude"]) || null;
  const lon = parseFloat(epc.longitude || epc["longitude"]) || null;

  return {
    address: (epc.address || "").toString(),
    uprn: epc.uprn || "N/A",
    postcode: (epc.postcode || "").toString(),
    area,
    rating: epc["current-energy-rating"] || "?",
    latitude: lat,
    longitude: lon,
  };
}

/**
 * Fetches EPC data for a given postcode.
 * @param {string} postcode - The postcode to query.
 * @param {function} safeFetch - The global safeFetch utility function.
 * @returns {Promise<{epc: object, error: string|null}>} Structured EPC data.
 */
async function fetchEpcData(postcode, safeFetch) {
  const data = await safeFetch(
    `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${postcode.replace(/\s/g, "")}`
  );

  if (data?.rows?.length > 0) {
    const epc = normalizeEpc(data.rows[0]);
    return { epc: epc, error: null };
  } else {
    return { epc: null, error: "NO_EPC_FOR_POSTCODE" };
  }
}

export {
  fetchEpcData,
  normalizeEpc
};