/**
 * £Per Core Engine
 * - Central orchestration layer for the PoundsPer Audit Engine.
 * - Handles the entire workflow from user input to data synthesis.
 * - This module should be imported and initialized by app.js.
 */

// --- GLOBAL STATE (Should ideally be managed by core/state.js, but kept here for now) ---
// We assume window.__PER_STATE__ is available globally or passed in.

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
 * Initiates the full audit process after successful data retrieval.
 * This function orchestrates calls to all data modules.
 * @param {object} epcRaw - The raw EPC data object.
 * @param {object} state - The global application state object.
 * @param {object} modules - An object containing all module functions (ppi, schools, etc.).
 */
async function initiateFinalAudit(epcRaw, state, modules) {
  // 1. Normalize and set EPC state
  const epc = normalizeEpc(epcRaw);
  state.epc = epc;

  // 2. Update UI elements (This part will be moved to a dedicated rendering function later)
  console.log("EPC Data Normalized:", epc);

  // 3. Update global state and trigger parallel data fetching
  state.activeLayers.epc = true; // Ensure EPC is active
  
  const cleanPc = epc.postcode.replace(/\s+/g, "").toUpperCase();
  
  // Use Promise.allSettled for resilience
  const results = await Promise.allSettled([
    // Pass the state object and the modules object to modules
    modules.ppi.loadMarketData(epc.postcode, state),
    modules.schools.loadSchoolsFromOfsted(cleanPc, state),
    modules.flood.loadFloodRisk(cleanPc, state),
    modules.radon.loadRadonRisk(cleanPc, state),
  ]);

  // 4. Map initialization and update
  state.map.init(epc, state);
  state.map.updateLayers();

  console.log("Audit Complete. Results:", results);
}

/**
 * Handles the initial user input (UPRN, Postcode, or URL) and starts the audit flow.
 * @param {string} input - The raw input string from the user.
 * @param {object} state - The global application state object.
 * @param {function} updateStatus - Callback function to update UI status.
 * @param {function} safeFetch - The function used to proxy API calls.
 * @param {object} modules - An object containing all module functions.
 */
async function handleDiscovery(input, state, updateStatus, safeFetch, modules) {
  if (!input) return updateStatus("INPUT_REQUIRED", "error");

  // Reset state and UI
  state.epc = null;
  state.schools = [];
  state.ppi = [];
  state.flood = null;
  state.radon = null;
  
  // Clear address selector
  const addressSelectorContainer = document.getElementById("addressSelectorContainer");
  if (addressSelectorContainer) addressSelectorContainer.classList.add("hidden");

  // UPRN Lookup
  if (/^\d{6,12}$/.test(input)) {
    updateStatus("UPRN_LOOKUP", "loading");
    // Use the safeFetch wrapper to call the EPC API
    const data = await safeFetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${input}`
    );
    if (data?.rows?.length > 0) {
      initiateFinalAudit(data.rows[0], state, modules);
    } else {
      updateStatus("UPRN_NOT_FOUND", "error");
      // Set error state in the state object
      state.epcError = "UPRN_NOT_FOUND";
    }
  } 
  // Postcode Lookup
  else if (/[A-Z]{1,2}\d/i.test(input)) {
    const pcMatch = input.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    if (!pcMatch) return updateStatus("INVALID_POSTCODE", "error");

    updateStatus("POSTCODE_SCAN", "loading");
    // Use the safeFetch wrapper to call the EPC API
    const data = await safeFetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pcMatch[0].replace(/\s/g, "")}`
    );

    if (data?.rows?.length > 0) {
      // Store all potential addresses in the state
      state.potentialAddresses = data.rows;
      // Logic to populate the address selector (DOM manipulation, handled by app.js/renderer)
      console.log("Multiple addresses found. Populate dropdown.");
      updateStatus("CHOOSE_ADDRESS", "success");
    } else {
      updateStatus("NO_DATA", "error");
      state.epcError = "NO_EPC_FOR_POSTCODE";
    }
  } else {
    updateStatus("UNSUPPORTED_INPUT", "error");
  }
}

/**
 * Selects an address from the dropdown and initiates the audit.
 * @param {number} index - The index of the selected address.
 * @param {object} state - The global application state object.
 * @param {object} modules - An object containing all module functions.
 */
async function selectAddress(index, state, modules) {
  if (index === null || !state.potentialAddresses || state.potentialAddresses.length === 0) return;
  
  const selectedAddress = state.potentialAddresses[index];
  // Initiate the audit with the selected address
  await initiateFinalAudit(selectedAddress, state, modules);
}

// Exporting the core functions for use in app.js
export {
  initiateFinalAudit,
  handleDiscovery,
  selectAddress,
  normalizeEpc
};