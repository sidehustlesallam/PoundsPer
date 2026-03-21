/**
 * £Per | Property Truth Engine - Core Logic v9.4
 * Modules: EPC, Land Registry (PPI), Environment Agency, GetTheData (Broadband & Schools)
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
const EPC_AUTH = "sidehustlesallam@gmail.com:8e8bcb44ea70c2ca63b3116dd63a1a307ba3159d";

let currentEpcRows = [];

// --- 1. SEARCH ENTRY POINT ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("Invalid input. Provide a UK postcode or URL.", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase();
    updateStatus(`Mapping sector: ${pc}...`, "loading");

    try {
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
        updateStatus("Choose a property to continue.", "success");

    } catch (err) {
        updateStatus(err.message, "error");
    }
}

// --- 2. UI: ADDRESS SELECTOR ---
function populateAddressDropdown(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- Select specific house/flat address --</option>';
    
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true})).forEach((row, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = row.address;
        dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

// --- 3. DATA ORCHESTRATOR ---
async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const selectedEpc = currentEpcRows[index];
    const pc = selectedEpc.postcode;
    
    updateStatus("Retrieving multi-point intelligence...", "loading");

    try {
        const lrTarget = `https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=50`;
        const floodTarget = `https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`;

        const [lrRes, floodRes, connData, schoolData] = await Promise.all([
            fetch(`${PROXY_URL}?url=${encodeURIComponent(lrTarget)}`),
            fetch(`${PROXY_URL}?url=${encodeURIComponent(floodTarget)}`),
            fetchConnectivity(pc),
            fetchSchools(pc)
        ]);

        const lrData = await lrRes.json();
        const floodData = await floodRes.json();

        renderFinalUI(selectedEpc, lrData.result.items, floodData.items, connData, schoolData);
        updateStatus("Analysis Complete.", "success");

    } catch (err) {
        updateStatus("Engine Error: " + err.message, "error");
    }
}

// --- 4. DATA FETCH: CONNECTIVITY ---
async function fetchConnectivity(pc) {
    const target = `https://api.getthedata.com/broadband/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data.status === "success" && data.data) {
            return {
                maxDownload: data.data.average_download_speed_mbps || "N/A",
                type: data.data.full_fibre_availability === "Y" ? "Full Fibre (FTTP)" : "Standard/Superfast",
                isUltrafast: data.data.ultrafast_availability === "Y"
            };
        }
        return null;
    } catch (e) { return null; }
}

// --- 5. DATA FETCH: SCHOOLS ---
async function fetchSchools(pc) {
    const target = `https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data.status === "success" && data.data) {
            return data.data.slice(0, 3).map(s => ({
                name: s.institution_name,
                phase: s.statutory_low_age < 11 ? "Primary" : "Secondary",
                rating: s.ofsted_rating_name || "Unrated",
                distance: s.distance_miles ? parseFloat(s.distance_miles).toFixed(1) : "?"
            }));
        }
        return null;
    } catch (e) { return null; }
}

// --- 6. DATA RENDERING ---
function renderFinalUI(epc, sales, floodStations, connectivity, schools) {
    // Basic Details
    document.getElementById('displayAddress').innerText = epc.address;
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    // EPC / Size
    const area = parseFloat(epc['total-floor-area']);
    document.getElementById('displaySize').innerText = Math.round(area);
    const epcBadge = document.getElementById('epcBadge');
    const rating = epc['current-energy-rating'];
    epcBadge.innerText = rating;
    epcBadge.className = `text-4xl font-black epc-${rating.toLowerCase()}`;

    // Valuation Logic
    let totalSqmPrice = 0, count = 0;
    sales.forEach(s => {
        if (s.latestTransaction && area > 0) {
            totalSqmPrice += (s.latestTransaction.pricePaid / area);
            count++;
        }
    });
    const avgVal = count > 0 ? Math.round(totalSqmPrice / count) : 0;
    document.getElementById('valMetric').innerText = avgVal > 0 ? `£${avgVal.toLocaleString()}` : "N/A";

    // Environmental Risk
    const floodEl = document.getElementById('floodRisk');
    if (floodStations && floodStations.length > 0) {
        floodEl.innerText = "Monitoring Zone";
        floodEl.className = "text-xl font-bold mt-2 text-orange-400 italic";
    } else {
        floodEl.innerText = "Low Direct Risk";
        floodEl.className = "text-xl font-bold mt-2 text-green-400 italic";
    }

    // Connectivity
    const broadbandEl = document.getElementById('broadbandSpeed');
    if (connectivity) {
        broadbandEl.innerHTML = `
            <div class="flex items-baseline gap-2">
                <span class="text-xl font-bold text-white">${connectivity.maxDownload}</span>
                <span class="text-xs text-slate-500 font-normal">Mbps Avg</span>
            </div>
            <div class="text-[10px] ${connectivity.isUltrafast ? 'text-green-400' : 'text-slate-500'} font-bold uppercase tracking-widest mt-1">
                ${connectivity.type}
            </div>`;
    }

    // Schools
    const schoolEl = document.getElementById('schoolList');
    if (schools && schools.length > 0) {
        schoolEl.innerHTML = schools.map(s => `
            <div class="flex justify-between items-center border-l-2 border-slate-800 pl-3 group hover:border-blue-500 transition-all">
                <div>
                    <div class="text-[11px] font-bold text-white truncate w-40">${s.name}</div>
                    <div class="text-[9px] text-slate-500 uppercase">${s.phase} • ${s.distance} mi</div>
                </div>
                <div class="text-[9px] font-black px-2 py-1 rounded bg-slate-800/50 ${s.rating.includes('Outstanding') ? 'text-green-400 border border-green-500/20' : 'text-slate-400'}">
                    ${s.rating.split(' ')[0]}
                </div>
            </div>`).join('');
    } else {
        schoolEl.innerHTML = `<div class="text-xs text-slate-600 italic">No school data found.</div>`;
    }

    document.getElementById('dashboard').classList.remove('hidden');
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg;
    dot.className = `w-2 h-2 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-ping' : type === 'error' ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}
