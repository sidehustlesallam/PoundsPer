/**
 * £Per | Property Audit Engine - v10.3
 * Logic: Anti-Crash JSON Parsing & Multi-Point Recovery
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
const EPC_AUTH = "sidehustlesallam@gmail.com:8e8bcb44ea70c2ca63b3116dd63a1a307ba3159d";

let currentEpcRows = [];

// --- 1. CORE DISCOVERY ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("ERROR: INVALID_POSTCODE_STRING", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase();
    updateStatus(`SCANNING_REGISTRY: ${pc}...`, "loading");

    try {
        const epcTarget = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g, '')}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(epcTarget)}`, {
            headers: { "Authorization": "Basic " + btoa(EPC_AUTH) }
        });

        const data = await safeParse(res);
        if (!data || !data.rows) throw new Error("NULL_DATA_FROM_PROXY");

        currentEpcRows = data.rows;
        populateAddressDropdown(data.rows);
        updateStatus("RESOLVE_UNIT_TO_PROCEED", "success");
    } catch (err) {
        updateStatus(`CRITICAL_FAIL: ${err.message}`, "error");
    }
}

// --- 2. MULTI-FETCH ORCHESTRATOR ---
async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const epc = currentEpcRows[index];
    const pc = epc.postcode;
    
    updateStatus("INITIATING_MULTI_POINT_AUDIT...", "loading");

    const [lr, flood, conn, schools, radon] = await Promise.all([
        safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=25`),
        safeFetch(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`),
        safeFetch(`https://api.getthedata.com/broadband/postcode/${pc.replace(/\s/g, '')}`),
        safeFetch(`https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`),
        safeFetch(`https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`)
    ]);

    renderForensicUI(epc, lr?.result?.items || [], flood?.items || [], conn?.data, schools?.data, radon?.data);
    updateStatus("AUDIT_RENDERED", "success");
}

// --- 3. HELPER: SAFE DATA HANDLING ---
async function safeParse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Non-JSON Response Detected:", text);
        // If it's HTML, the API is blocking us
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
            throw new Error("GOV_API_FIREWALL_BLOCK");
        }
        throw new Error("MALFORMED_JSON_RESPONSE");
    }
}

async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        return await safeParse(res);
    } catch (e) {
        console.warn(`Module Failed: ${url}`, e.message);
        return null; // Return null so the rest of the app can load
    }
}

// --- 4. RENDERER ---
function renderForensicUI(epc, sales, flood, conn, schools, radon) {
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displaySize').innerText = Math.round(area);

    // Val
    let totalSqm = 0, count = 0;
    sales.forEach(s => { if (s.latestTransaction && area > 0) { totalSqm += (s.latestTransaction.pricePaid / area); count++; }});
    document.getElementById('valMetric').innerText = count > 0 ? `£${Math.round(totalSqm/count).toLocaleString()}` : "N/A";

    // Geo
    const floodStatus = document.getElementById('floodStatus');
    floodStatus.innerText = flood.length > 0 ? "STATION_DETECTED" : "NEGATIVE";
    floodStatus.className = flood.length > 0 ? "indicator-red" : "indicator-green";

    const isRadonHigh = radon && parseFloat(radon.radon_potential_percentage) >= 1;
    const radonStatus = document.getElementById('radonStatus');
    radonStatus.innerText = radon ? (isRadonHigh ? `AFFECTED_${radon.radon_potential_percentage}%` : "NEGATIVE") : "NO_DATA";
    radonStatus.className = isRadonHigh ? "indicator-red" : "indicator-green";

    const riskLevel = document.getElementById('riskLevel');
    if (flood.length > 0 || isRadonHigh) {
        riskLevel.innerText = ">> WARNING: GEO-ENVIRONMENTAL HAZARDS PRESENT.";
        riskLevel.className = "text-[10px] p-3 rounded data-mono leading-relaxed bg-red-900/10 text-red-400 border border-red-900/30";
    } else {
        riskLevel.innerText = ">> STABLE: NO CRITICAL GEO-HAZARDS RECORDED.";
        riskLevel.className = "text-[10px] p-3 rounded data-mono leading-relaxed bg-green-900/10 text-green-400 border border-green-900/30";
    }

    // Conn & Schools
    document.getElementById('broadbandSpeed').innerHTML = conn ? `
        <p>MAX: <span class="text-white">${conn.average_download_speed_mbps} Mbps</span></p>
        <p>TYPE: <span class="text-gray-500">${conn.full_fibre_availability === 'Y' ? 'FULL_FIBRE' : 'VDSL'}</span></p>` : "N/A";

    document.getElementById('schoolList').innerHTML = schools ? schools.slice(0,3).map(s => `
        <div class="flex justify-between border-b border-gray-900 pb-1">
            <span>${s.institution_name.substring(0,18)}</span>
            <span class="${s.ofsted_rating_name?.includes('Outstanding') ? 'text-green-400' : 'text-gray-600'}">[${(s.ofsted_rating_name || "NA").substring(0,4)}]</span>
        </div>`).join('') : "NO_DATA";

    // EPC
    document.getElementById('epcBadge').innerText = `[${epc['current-energy-rating']}]`;
    document.getElementById('epcRatingRaw').innerText = epc['current-energy-rating'];
    document.getElementById('epcPotentialRaw').innerText = epc['potential-energy-rating'];
    document.getElementById('epcHeating').innerText = epc['mainheating-description'] || "UNSPECIFIED";

    document.getElementById('dashboard').classList.remove('hidden');
}

function populateAddressDropdown(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- RESOLVE ADDRESS --</option>';
    rows.sort((a,b) => a.address.localeCompare(b.address, undefined, {numeric: true})).forEach((row, i) => {
        const opt = document.createElement('option'); opt.value = i; opt.textContent = row.address; dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}
