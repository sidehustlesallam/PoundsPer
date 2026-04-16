/**
 * £Per PPI Module
 * - Handles fetching, processing, and structuring Property Price Index data.
 * - This module is responsible for data retrieval only and must not manipulate the DOM.
 */

/**
 * Fetches and processes Property Price Index (PPI) data.
 * @param {string} postcode - The postcode to query.
 * @param {function} safeFetch - The global safeFetch utility function.
 * @returns {Promise<{transactions: Array<object>, error: string|null}>} Structured PPI data.
 */
async function fetchMarketData(postcode, safeFetch) {
  try {
    const data = await safeFetch(
      `https://lingering-snow-ccff.sidehustlesallam.workers.dev/?ppi=1&postcode=${encodeURIComponent(postcode)}`
    );
    
    if (data?.transactions?.length > 0) {
      return { transactions: data.transactions, error: null };
    } else {
      return { transactions: [], error: "NO_PPI_DATA" };
    }
  } catch (e) {
    return { transactions: [], error: "PPI_FETCH_ERROR" };
  }
}

/**
 * Processes raw PPI transactions into a standardized, sorted list.
 * This function is a helper for the main fetcher.
 * @param {Array<object>} txs - Array of raw transaction objects.
 * @returns {Array<object>} Cleaned and sorted transaction list.
 */
function processTransactions(txs) {
  return txs
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
}

export {
  fetchMarketData,
  processTransactions
};