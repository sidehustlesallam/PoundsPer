/**
 * £Per Schools Module
 * - Handles fetching, processing, and structuring local school data from Ofsted.
 * - This module is responsible for data retrieval only and must not manipulate the DOM.
 */

/**
 * Fetches school data for a given postcode.
 * @param {string} cleanPostcode - The cleaned postcode.
 * @param {function} safeFetch - The global safeFetch utility function.
 * @returns {Promise<{schools: Array<object>, error: string|null}>} Array of school objects.
 */
async function fetchSchoolsData(cleanPostcode, safeFetch) {
  try {
    // The proxy URL is used here, assuming it handles the 'schools=1' parameter
    const data = await safeFetch(
      `https://lingering-snow-ccff.sidehustlesallam.workers.dev/?schools=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );

    if (data?.schools?.length > 0) {
      return { schools: data.schools, error: null };
    } else {
      return { schools: [], error: "NO_SCHOOLS_FOUND" };
    }
  } catch (e) {
    return { schools: [], error: "SCHOOLS_FETCH_ERROR" };
  }
}

export {
  fetchSchoolsData
};