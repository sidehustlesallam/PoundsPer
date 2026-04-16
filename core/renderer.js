/**
 * £Per Renderer Core
 * - Handles all client-side DOM manipulation and UI updates based on the application state.
 * - This module should be called by core/engine.js after a successful audit.
 */

/**
 * Renders the final audit results to the dashboard.
 * @param {object} state - The global application state object (window.__PER_STATE__).
 * @param {object} modules - Object containing all module functions.
 */
export function renderDashboard(state, modules) {
  // 1. Update EPC Badge and State
  setEpcState(state.epc ? state.epc.rating : "error", state.epcError ? state.epcError : "");

  // 2. Update Map
  if (state.map) {
    state.map.updateLayers(state);
  }

  // 3. Update School List
  renderSchoolList(state.schools);

  // 4. Update PPI Table
  renderPpiTable(state.ppi);

  // 5. Update Environmental Risks (Flood/Radon)
  renderEnvironmentalRisks(state.flood, state.radon);

  // 6. Update general status
  updateStatus("AUDIT COMPLETE", "success");
}

/**
 * Renders the list of schools in the dedicated panel.
 * @param {Array} schools - Array of school objects.
 */
function renderSchoolList(schools) {
  const schoolListContainer = document.getElementById("schoolList");
  if (!schoolListContainer) return;

  schoolListContainer.innerHTML = ''; // Clear previous results

  if (schools.length === 0) {
    schoolListContainer.innerHTML = '<p class="text-gray-500 text-sm">No school data available for this location.</p>';
    return;
  }

  schools.forEach((school, index) => {
    const schoolCard = document.createElement("div");
    schoolCard.className = "p-4 bg-gray-900/50 border border-gray-800 rounded-md";
    schoolCard.innerHTML = `
      <h3 class="text-lg font-semibold text-sky-400">${school.name || 'Unknown School'}</h3>
      <p class="text-sm text-gray-400">${school.address || 'Address N/A'}</p>
      <p class="text-xs text-gray-500 mt-1">Ofsted Rating: ${school.rating || 'N/A'}</p>
    `;
    schoolListContainer.appendChild(schoolCard);
  });
}

/**
 * Renders the PPI transaction data into the table.
 * @param {Array} ppi - Array of PPI transaction objects.
 */
function renderPpiTable(ppi) {
  const marketBody = document.getElementById("marketBody");
  if (!marketBody) return;

  marketBody.innerHTML = ''; // Clear previous results

  if (ppi.length === 0) {
    marketBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No PPI transaction data found.</td></tr>';
    return;
  }

  ppi.forEach((transaction, index) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-gray-800/50 transition-colors";
    row.innerHTML = `
      <td class="py-3 text-sm text-gray-300">${transaction.date || 'N/A'}</td>
      <td class="py-3 text-sm text-gray-300">${transaction.type || 'N/A'}</td>
      <td class="py-3 text-sm text-gray-300">${transaction.amount ? `$${transaction.amount.toFixed(2)}` : 'N/A'}</td>
      <td class="py-3 text-sm text-gray-300">${transaction.description || 'N/A'}</td>
    `;
    marketBody.appendChild(row);
  });
}

/**
 * Renders environmental risk data (Flood and Radon).
 * @param {object} flood - Flood risk object.
 * @param {object} radon - Radon risk object.
 */
function renderEnvironmentalRisks(flood, radon) {
  // Flood Risk Card
  const floodCard = document.getElementById("floodRiskCard");
  if (floodCard) {
    if (flood) {
      floodCard.innerHTML = `
        <h3 class="text-xl font-semibold text-sky-400 mb-3">Flood Risk Assessment</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2 border-b border-gray-700">
            <span class="text-gray-400">Flood Zone:</span>
            <span class="text-lg font-bold text-yellow-400">${flood.zone || 'N/A'}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-700">
            <span class="text-gray-400">Risk Level:</span>
            <span class="text-lg font-bold text-green-400">${flood.riskLevel || 'N/A'}</span>
          </div>
        </div>
      `;
    } else {
      floodCard.innerHTML = '<p class="text-gray-500">Flood data unavailable.</p>';
    }
  }

  // Radon Risk Card
  const radonCard = document.getElementById("radonRiskCard");
  if (radonCard) {
    if (radon) {
      radonCard.innerHTML = `
        <h3 class="text-xl font-semibold text-sky-400 mb-3">Radon Gas Assessment</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2 border-b border-gray-700">
            <span class="text-gray-400">Risk Level:</span>
            <span class="text-lg font-bold text-red-400">${radon.riskLevel || 'N/A'}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-700">
            <span class="text-gray-400">Recommendation:</span>
            <span class="text-sm text-gray-300">${radon.recommendation || 'N/A'}</span>
          </div>
        </div>
      `;
    } else {
      radonCard.innerHTML = '<p class="text-gray-500">Radon data unavailable.</p>';
    }
  }
}