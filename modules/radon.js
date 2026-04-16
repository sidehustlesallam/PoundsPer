/**
 * £Per Radon Module
 * - Handles fetching and structuring Radon Risk data.
 * - This module is responsible for data retrieval only and must not manipulate the DOM.
 */

/**
 * Fetches radon risk data for a given postcode.
 * @param {string} cleanPostcode - The cleaned postcode.
 * @param {function} safeFetch - The global safeFetch utility function.
 * @returns {Promise<{band: string, raw: string, source: string, error: string|null}>} Structured radon risk object.
 */
async function fetchRadonRisk(cleanPostcode, safeFetch) {
  try {
    // The worker handles the actual API call, we just pass the parameters.
    const data = await safeFetch(
      `https://lingering-snow-ccff.sidehustlesallam.workers.dev/?radon=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );
    
    if (data?.band) {
      return { band: data.band, raw: data.raw || "UNKNOWN", source: data.source || "UNKNOWN", error: null };
    } else {
      return { band: "UNKNOWN", raw: "UNKNOWN", source: "UNKNOWN", error: "NO_RADON_DATA" };
    }
  } catch (e) {
    return { band: "UNKNOWN", raw: "UNKNOWN", source: "UNKNOWN", error: "RADON_FETCH_ERROR" };
  }
}

export {
  fetchRadonRisk
};