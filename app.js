/**
 * £Per | Property Truth Engine v9.5
 * Orchestrates: EPC, HMLR, Environment Agency, Radon, Schools, & Connectivity.
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
const EPC_AUTH = "sidehustlesallam@gmail.com:8e8bcb44ea70c2ca63b3116dd63a1a307ba3159d";

let currentEpcRows = [];

// --- 1. ENTRY HANDLER ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    // Extract Postcode from string or URL
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("Enter a valid UK postcode or property URL", "error");
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
        
        if (!data.rows || data.rows.length === 0) throw new Error("No property data found in register.");

        currentEpcRows = data.rows;
        populateAddressDropdown(data.rows);
        updateStatus("Select target address to proceed.", "success");
    } catch (err) { updateStatus(err.message, "error"); }
}

// --- 2. ADDRESS SELECTOR ---
function populateAddressDropdown(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- Click to select exact property --</option>';
    
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true})).forEach((row, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = row.address;
        dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

// --- 3. THE ORCHESTRATOR ---
async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const epc = currentEpcRows[index];
    const pc = epc.postcode;
    
    updateStatus("Retrieving multi-point intelligence...", "loading");

    try {
        const lrTarget = `https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=50`;
        const floodTarget = `https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`;

        const [lrRes, floodRes, connData, schoolData, radonData] = await Promise.all([
            fetch(`${PROXY_URL}?url=${encodeURIComponent(lrTarget)}`),
            fetch(`${PROXY_URL}?url=${encodeURIComponent(floodTarget)}`),
            fetchConnectivity(pc),
            fetchSchools(pc),
            fetchRadon(pc)
        ]);

        const lrData = await lrRes.json();
        const floodData = await floodRes.json();

        renderUI(epc, lrData.result.items, floodData.items, connData, schoolData, radonData);
        updateStatus("Truth Synchronized.", "success");
    } catch (err) { updateStatus("Sync Error: " + err.message, "error"); }
}

// --- 4. INDIVIDUAL TRUTH MODULES ---
async function fetchConnectivity(pc) {
    const target = `https://api.getthedata.com/broadband/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const d = await res.json();
        return d.data ? { speed: d.data.average_download_speed_mbps, type: d.data.full_fibre_availability === "Y" ? "Full Fibre" : "Superfast", isUltra: d.data.ultrafast_availability === "Y" } : null;
    } catch (e) { return null; }
}

async function fetchSchools(pc) {
    const target = `https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const d = await res.json();
        return d.data ? d.data.slice(0, 3).map(s => ({ name: s.institution_name, rating: s.ofsted_rating_name || "Unrated", dist: parseFloat(s.distance_miles).toFixed(1) })) : null;
    } catch (e) { return null; }
}

async function fetchRadon(pc) {
    const target = `https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const d = await res.json();
        return d.data ? { pc: d.data.radon_potential_percentage, high: parseFloat(d.data.radon_potential_percentage) >= 1 } : null;
    } catch (e) { return null; }
}

// --- 5. RENDER ENGINE ---
function renderUI(epc, sales, flood, conn, schools, radon) {
    document.getElementById('displayAddress').innerText = epc.address;
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    // Scale & EPC
    const area = parseFloat(epc['total-floor-area']);
    document.getElementById('displaySize').innerText = Math.round(area);
    const badge = document.getElementById('epcBadge');
    badge.innerText = epc['current-energy-rating'];
    badge.className = `text-4xl font-black epc-${epc['current-energy-rating'].toLowerCase()}`;

    // Valuation
    let totalSqm = 0, count = 0;
    sales.forEach(s => { if (s.latestTransaction && area > 0) { totalSqm += (s.latestTransaction.pricePaid / area); count++; }});
    document.getElementById('valMetric').innerText = count > 0 ? `£${Math.round(totalSqm/count).toLocaleString()}` : "N/A";

    // Risk UI
    const floodStatus = document.getElementById('floodStatus');
    floodStatus.innerText = flood.length > 0 ? "Station Active" : "No Nearby Stations";
    floodStatus.className = flood.length > 0 ? "text-orange-400 font-bold" : "text-green-500 font-bold";
    
    const radonStatus = document.getElementById('radonStatus');
    radonStatus.innerText = radon ? (radon.high ? `${radon.pc}% Potential` : "Low (<1%)") : "N/A";
    radonStatus.className = radon && radon.high ? "text-orange-400 font-bold" : "text-green-500 font-bold";

    const riskBadge = document.getElementById('riskLevel');
    const isRisk = flood.length > 0 || (radon && radon.high);
    riskBadge.innerText = isRisk ? "WARNING" : "STABLE";
    riskBadge.className = `text-[9px] px-2 py-0.5 rounded border font-bold ${isRisk ? 'bg-orange-950 text-orange-400 border-orange-800' : 'bg-green-950 text-green-500 border-green-800'}`;

    // Connectivity
    document.getElementById('broadbandSpeed').innerHTML = conn ? `
        <div class="flex items-baseline gap-2 text-white"><span class="text-xl font-bold">${conn.speed}</span><span class="text-[9px] text-slate-500 uppercase">Mbps</span></div>
        <div class="text-[9px] font-bold uppercase ${conn.isUltra ? 'text-green-400' : 'text-slate-500'}">${conn.type}</div>` : "--";

    // Schools
    document.getElementById('schoolList').innerHTML = schools ? schools.map(s => `
        <div class="flex justify-between items-center text-[10px] border-l border-slate-700 pl-2">
            <span class="truncate w-32 font-bold">${s.name}</span>
            <span class="${s.rating.includes('Outstanding') ? 'text-green-400' : 'text-slate-400'} font-black">${s.rating.split(' ')[0]}</span>
        </div>`).join('') : "No local data.";

    document.getElementById('dashboard').classList.remove('hidden');
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg;
    dot.className = `w-2 h-2 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-ping' : type === 'error' ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-green-500 shadow-[0_0_10px_green]'}`;
}
