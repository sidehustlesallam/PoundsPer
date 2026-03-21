/**
 * £Per | Property Audit Engine - v10.1
 * Logic: Forensic Data Extraction & Insight Mapping
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
const EPC_AUTH = "sidehustlesallam@gmail.com:8e8bcb44ea70c2ca63b3116dd63a1a307ba3159d";

let currentEpcRows = [];

// --- 1. SEARCH ENTRY ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("ERROR: INVALID_INPUT_EXPECTED_PC_OR_URL", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase();
    updateStatus(`SCANNING_SECTOR: ${pc}...`, "loading");

    try {
        const epcTarget = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g, '')}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(epcTarget)}`, {
            headers: { "Authorization": "Basic " + btoa(EPC_AUTH) }
        });
        const data = await res.json();
        
        if (!data.rows || data.rows.length === 0) throw new Error("NULL_DATA: NO_EPC_RECORDS_FOUND");

        currentEpcRows = data.rows;
        populateAddressDropdown(data.rows);
        updateStatus("RESOLVE_ASSET_TO_CONTINUE", "success");
    } catch (err) { updateStatus(`CRITICAL_FAILURE: ${err.message}`, "error"); }
}

// --- 2. UI: ADDRESS RESOLVER ---
function populateAddressDropdown(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- RESOLVE_ADDRESS_--</option>';
    
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true})).forEach((row, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `UNIT_ID: ${row.address}`;
        dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

// --- 3. AUDIT ORCHESTRATOR ---
async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const epc = currentEpcRows[index];
    const pc = epc.postcode;
    
    updateStatus("INITIATING_FORENSIC_PULL...", "loading");

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

        renderForensicUI(epc, lrData.result.items, floodData.items, connData, schoolData, radonData);
        updateStatus("AUDIT_COMPLETE", "success");
    } catch (err) { updateStatus(`SYNC_INTERRUPTED: ${err.message}`, "error"); }
}

// --- 4. AUDIT MODULES ---
async function fetchConnectivity(pc) {
    const target = `https://api.getthedata.com/broadband/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const d = await res.json();
        return d.data ? { 
            speed: d.data.average_download_speed_mbps, 
            type: d.data.full_fibre_availability === "Y" ? "FTTP/FULL_FIBRE" : "FTTC/COPPER",
            isUltra: d.data.ultrafast_availability === "Y" 
        } : null;
    } catch (e) { return null; }
}

async function fetchSchools(pc) {
    const target = `https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`;
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const d = await res.json();
        return d.data ? d.data.slice(0, 3).map(s => ({ name: s.institution_name, rating: s.ofsted_rating_name || "UNRATED", dist: parseFloat(s.distance_miles).toFixed(1) })) : null;
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

// --- 5. RENDER ENGINE (V10 FORENSIC) ---
function renderForensicUI(epc, sales, flood, conn, schools, radon) {
    // Header
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('mapLink').href = `http://maps.google.com/?q=${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    // Column 1: Val & Size
    const area = parseFloat(epc['total-floor-area']);
    document.getElementById('displaySize').innerText = Math.round(area);
    
    let totalSqm = 0, count = 0;
    sales.forEach(s => { if (s.latestTransaction && area > 0) { totalSqm += (s.latestTransaction.pricePaid / area); count++; }});
    document.getElementById('valMetric').innerText = count > 0 ? `£${Math.round(totalSqm/count).toLocaleString()}` : "N/A";

    // Column 2: Environmental Indicators
    const floodStatus = document.getElementById('floodStatus');
    floodStatus.innerText = flood.length > 0 ? "DETECTED" : "NULL";
    floodStatus.className = flood.length > 0 ? "indicator-red" : "indicator-green";
    
    const radonStatus = document.getElementById('radonStatus');
    radonStatus.innerText = radon ? (radon.high ? `AFFECTED_${radon.pc}%` : "NEGATIVE") : "N/A";
    radonStatus.className = radon && radon.high ? "indicator-red" : "indicator-green";

    const riskLevel = document.getElementById('riskLevel');
    const isRisk = flood.length > 0 || (radon && radon.high);
    riskLevel.innerText = isRisk 
        ? ">> HAZARD_DETECTED: Environmental factors may impact insurance premium/mortgage lending." 
        : ">> NO_CRITICAL_HAZARDS: Asset appears geologically stable.";
    riskLevel.className = isRisk ? "mt-3 p-3 text-[10px] rounded leading-relaxed data-mono bg-red-900/10 text-red-400" : "mt-3 p-3 text-[10px] rounded leading-relaxed data-mono bg-green-900/10 text-green-400";

    // Column 3: Social & Conn
    document.getElementById('broadbandSpeed').innerHTML = conn ? `
        <p>MAX_SPEED: <span class="text-white">${conn.speed} Mbps</span></p>
        <p>PROTOCOL: <span class="${conn.isUltra ? 'text-green-400' : 'text-gray-500'}">${conn.type}</span></p>` : "NO_DATA";

    document.getElementById('schoolList').innerHTML = schools ? schools.map(s => `
        <div class="flex justify-between items-center border-b border-gray-900 pb-1">
            <span>${s.name.substring(0,20)}..</span>
            <span class="${s.rating.includes('Outstanding') ? 'text-green-400' : 'text-gray-500'}">[${s.rating.substring(0,4)}]</span>
        </div>`).join('') : "NO_DATA";

    // EPC Forensic Block
    const badge = document.getElementById('epcBadge');
    const rating = epc['current-energy-rating'];
    badge.innerText = `[${rating}]`;
    badge.className = `data-mono text-xl font-black px-3 py-1 rounded bg-white text-black`;

    document.getElementById('epcRatingRaw').innerText = rating;
    document.getElementById('epcPotentialRaw').innerText = epc['potential-energy-rating'];
    document.getElementById('epcHeating').innerText = epc['mainheating-description'] || "UNSPECIFIED";

    document.getElementById('dashboard').classList.remove('hidden');
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}
