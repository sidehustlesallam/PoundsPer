/**
 * £Per Flood Module
 * - Handles fetching and structuring Flood Risk data.
 * - This module is responsible for data retrieval only and must not manipulate the DOM.
 */

/**
 * Fetches flood risk data for a given postcode.
 * @param {string} cleanPostcode - The cleaned postcode.
 * @param {function} safeFetch - The global safeFetch utility function.
 * @returns {Promise<{risk_band: string, raw: string, source: string, error: string|null}>} Structured flood risk object.
 */
async function fetchFloodRisk(cleanPostcode, safeFetch) {
  try {
    // Note: The worker handles the actual API call, we just pass the parameters.
    // We assume the worker is updated to handle this standardized call.
    const data = await safeFetch(
      `https://lingering-snow-ccff.sidehustlesallam.workers.dev/?flood=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );
    
    if (data?.risk_band) {
      return { risk_band: data.risk_band, raw: data.raw || "UNKNOWN", source: data.source || "UNKNOWN", error: null };
    } else {
      return { risk_band: "UNKNOWN", raw: "UNKNOWN", source: "UNKNOWN", error: "NO_FLOOD_DATA" };
    }
  } catch (e) {
    return { risk_band: "UNKNOWN", raw: "UNKNOWN", source: "UNKNOWN", error: "FLOOD_FETCH_ERROR" };
  }
}

export {
  fetchFloodRisk
};