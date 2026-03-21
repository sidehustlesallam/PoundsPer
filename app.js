/**
 * £Per | Property Audit Engine - v10.6
 * Fixed: Address Resolution Visibility & UPRN Mapping
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 

let currentEpcRows = [];

// --- 1. SEARCH ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    // Reset UI
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    if (!pcMatch) {
        updateStatus("ERROR: ENTER VALID POSTCODE", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase().replace(/\s/g, '');
    updateStatus(`FETCHING RECORDS FOR ${pc}...`, "loading");

    try {
        const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        
        const data = await safeParse(res);
        
        if (!data || !data.rows || data.rows.length === 0) {
            throw new Error("NO_EPC_DATA_FOUND");
        }

        currentEpcRows = data.rows;
        
        // --- THE FIX: FORCING VISIBILITY ---
        renderAddressList(currentEpcRows);
        updateStatus(`${currentEpcRows.length} ASSETS FOUND`, "success");
        
    } catch (err) {
        updateStatus(`FAIL: ${err.message}`, "error");
        console.error(err);
    }
}

// --- 2. ADDRESS LIST RENDERER ---
function renderAddressList(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    
    // Sort logically (House numbers)
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true}));

    dropdown.innerHTML = '<option value="">-- CLICK TO SELECT ADDRESS --</option>';
    
    rows.forEach((row, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = row.address;
        dropdown.appendChild(opt);
    });

    // CRITICAL: Un-hide the container
    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth' });
}

// --- 3. FINAL AUDIT ---
async function selectAddress() {
    const idx = document.getElementById('addressDropdown').value;
    if (idx === "") return;

    const epc = currentEpcRows[idx];
    updateStatus("GENERATING AUDIT...", "loading");

    try {
        const pc = epc.postcode;
        // Parallel fetch for secondary data
        const [lr, flood, radon] = await Promise.all([
            safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=20`),
            safeFetch(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`),
            safeFetch(`https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`)
        ]);

        renderDashboard(epc, lr?.result?.items || [], flood?.items || [], radon?.data);
        updateStatus("AUDIT COMPLETE", "success");
    } catch (e) {
        updateStatus("PARTIAL AUDIT LOADED", "success");
        renderDashboard(epc, [], [], null);
    }
}

// --- 4. DASHBOARD RENDERER ---
function renderDashboard(epc, sales, flood, radon) {
    // Basic Details & UPRN
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    // Energy Badge
    const badge = document.getElementById('epcBadge');
    badge.innerText = epc['current-energy-rating'];
    
    // Size & Val
    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displaySize').innerText = Math.round(area);

    let val = "N/A";
    if (sales.length > 0 && area > 0) {
        let total = 0;
        sales.forEach(s => { if (s.latestTransaction) total += (s.latestTransaction.pricePaid / area); });
        val = `£${Math.round(total / sales.length).toLocaleString()}`;
    }
    document.getElementById('valMetric').innerText = val;

    // Hazards
    const floodEl = document.getElementById('floodStatus');
    floodEl.innerText = flood.length > 0 ? "STATION_NEARBY" : "NEGATIVE";
    floodEl.className = flood.length > 0 ? "indicator-red" : "indicator-green";

    const radonEl = document.getElementById('radonStatus');
    const isRadonHigh = radon && parseFloat(radon.radon_potential_percentage) >= 1;
    radonEl.innerText = isRadonHigh ? "AFFECTED_AREA" : "NEGATIVE";
    radonEl.className = isRadonHigh ? "indicator-red" : "indicator-green";

    document.getElementById('epcHeating').innerText = epc['mainheating-description'] || "SYSTEM DATA MISSING";

    // Reveal Dashboard
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
}

// --- UTILS ---
async function safeParse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        if (text.includes("<html")) throw new Error("API_ACCESS_DENIED");
        throw new Error("DATA_PARSE_ERROR");
    }
}

async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        return await safeParse(res);
    } catch (e) { return null; }
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}
