/**
 * £Per | Property Truth Engine - Logic V9.2
 * Supports: URL Parsing, Postcode-to-Address Dropdown, & Data Aggregation
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
const EPC_AUTH = "sidehustlesallam@gmail.com:8e8bcb44ea70c2ca63b3116dd63a1a307ba3159d";

let currentEpcRows = []; // Stores the addresses found for the current postcode

// --- 1. INITIAL ENTRY POINT ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    // Reset UI
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    // Simple Regex for Postcode
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("Please enter a valid UK postcode or property URL", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase();
    updateStatus(`Locating addresses in ${pc}...`, "loading");

    try {
        // Fetch EPC records first to get the list of addresses
        const epcTarget = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g, '')}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(epcTarget)}`, {
            headers: { "Authorization": "Basic " + btoa(EPC_AUTH) }
        });
        const data = await res.json();
        
        if (!data.rows || data.rows.length === 0) {
            throw new Error("No address data found for this postcode.");
        }

        currentEpcRows = data.rows;
        populateAddressDropdown(data.rows);
        updateStatus("Select an address to reveal details", "success");

    } catch (err) {
        updateStatus(err.message, "error");
    }
}

// --- 2. POPULATE DROPDOWN ---
function populateAddressDropdown(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    
    // Clear old options
    dropdown.innerHTML = '<option value="">-- Click to select the exact house/flat --</option>';
    
    // Add new options (sorted by house number)
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true})).forEach((row, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = row.address;
        dropdown.appendChild(opt);
    });

    container.classList.remove('hidden');
}

// --- 3. FINAL DATA FETCH (When address is selected) ---
async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const selectedEpc = currentEpcRows[index];
    const pc = selectedEpc.postcode;
    
    updateStatus("Retrieving Market & Environmental Truths...", "loading");

    try {
        // Fetch Land Registry & Environmental in parallel
        const lrTarget = `https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=50`;
        const floodTarget = `https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`;

        const [lrRes, floodRes] = await Promise.all([
            fetch(`${PROXY_URL}?url=${encodeURIComponent(lrTarget)}`),
            fetch(`${PROXY_URL}?url=${encodeURIComponent(floodTarget)}`)
        ]);

        const lrData = await lrRes.json();
        const floodData = await floodRes.json();

        renderFinalUI(selectedEpc, lrData.result.items, floodData.items);
        updateStatus("Data Synced", "success");

    } catch (err) {
        updateStatus("Analysis failed: " + err.message, "error");
    }
}

// --- 4. RENDER TO DASHBOARD ---
function renderFinalUI(epc, sales, floodStations) {
    // 1. Address & Map
    document.getElementById('displayAddress').innerText = epc.address;
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    // 2. Size & EPC
    document.getElementById('displaySize').innerText = Math.round(epc['total-floor-area']);
    const epcBadge = document.getElementById('epcBadge');
    epcBadge.innerText = epc['current-energy-rating'];
    epcBadge.className = `text-4xl font-black epc-${epc['current-energy-rating'].toLowerCase()}`;

    // 3. Market Value (£/m2)
    let totalSqmPrice = 0, count = 0;
    sales.forEach(s => {
        if (s.latestTransaction) {
            // We'd ideally match the exact house, but for context we use street average
            totalSqmPrice += (s.latestTransaction.pricePaid / epc['total-floor-area']);
            count++;
        }
    });
    
    const avgVal = count > 0 ? Math.round(totalSqmPrice / count) : "N/A";
    document.getElementById('valMetric').innerText = count > 0 ? `£${avgVal.toLocaleString()}` : "N/A";

    // 4. Environmental
    const floodEl = document.getElementById('floodRisk');
    if (floodStations.length > 0) {
        floodEl.innerText = "Monitoring Active";
        floodEl.className = "text-xl font-bold mt-2 text-orange-400 italic";
    } else {
        floodEl.innerText = "Low Direct Risk";
        floodEl.className = "text-xl font-bold mt-2 text-green-400 italic";
    }

    document.getElementById('dashboard').classList.remove('hidden');
}

function updateStatus(msg, type) {
    const statusText = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    statusText.innerText = msg;
    dot.className = `w-2 h-2 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-ping' : type === 'error' ? 'bg-red-500' : 'bg-green-500'}`;
}
