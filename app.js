/**
 * £Per | Property Audit Engine - v10.2 (Fail-Safe)
 * Features: Error-swallowing, Direct-fetch fallbacks, and Status Logging
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
const EPC_AUTH = "sidehustlesallam@gmail.com:8e8bcb44ea70c2ca63b3116dd63a1a307ba3159d";

let currentEpcRows = [];

// --- 1. SEARCH ENTRY ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("ERROR: INVALID_POSTCODE_FORMAT", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase();
    updateStatus(`SCANNING_REGISTRY: ${pc}...`, "loading");

    try {
        // EPC is the only one that STRICTLY needs the worker due to Auth headers
        const epcTarget = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g, '')}`;
        const response = await fetch(`${PROXY_URL}?url=${encodeURIComponent(epcTarget)}`, {
            headers: { "Authorization": "Basic " + btoa(EPC_AUTH) }
        });

        // Check if response is actually JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Worker returned non-JSON:", text);
            throw new Error("PROXY_BLOCKED_BY_GOV_FIREWALL");
        }

        const data = await response.json();
        currentEpcRows = data.rows || [];
        
        if (currentEpcRows.length === 0) throw new Error("ZERO_RECORDS_FOUND");

        populateAddressDropdown(currentEpcRows);
        updateStatus("RESOLVE_UNIT_ID", "success");
    } catch (err) { 
        updateStatus(`CRITICAL: ${err.message}`, "error"); 
    }
}

// --- 2. ADDRESS RESOLVER ---
function populateAddressDropdown(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- RESOLVE_ADDRESS_--</option>';
    
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true})).forEach((row, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `UNIT: ${row.address}`;
        dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

// --- 3. THE FAIL-SAFE ORCHESTRATOR ---
async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const epc = currentEpcRows[index];
    const pc = epc.postcode;
    
    updateStatus("RUNNING_MULTI_POINT_AUDIT...", "loading");

    // We use a helper that tries the worker but returns null on failure 
    // instead of crashing the whole app.
    const [lrData, floodData, connData, schoolData, radonData] = await Promise.all([
        safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=20`),
        safeFetch(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`),
        safeFetch(`https://api.getthedata.com/broadband/postcode/${pc.replace(/\s/g, '')}`),
        safeFetch(`https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`),
        safeFetch(`https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`)
    ]);

    renderForensicUI(epc, lrData?.result?.items || [], floodData?.items || [], connData?.data, schoolData?.data, radonData?.data);
    updateStatus("AUDIT_RENDERED_WITH_POTENTIAL_GAPS", "success");
}

// --- 4. THE "SAFE FETCH" WRAPPER ---
async function safeFetch(targetUrl) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn(`Module failed: ${targetUrl}`);
        return null; 
    }
}

// --- 5. UPDATED RENDERER ---
function renderForensicUI(epc, sales, flood, conn, schools, radon) {
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    // Valuation & Scale
    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displaySize').innerText = Math.round(area);
    
    let avgSqm = "N/A";
    if (sales.length > 0 && area > 0) {
        let total = 0;
        sales.forEach(s => { if (s.latestTransaction) total += (s.latestTransaction.pricePaid / area); });
        avgSqm = `£${Math.round(total / sales.length).toLocaleString()}`;
    }
    document.getElementById('valMetric').innerText = avgSqm;

    // Environmental
    const floodStatus = document.getElementById('floodStatus');
    floodStatus.innerText = flood.length > 0 ? "HIGH_PROXIMITY" : "NEGATIVE";
    floodStatus.className = flood.length > 0 ? "indicator-red" : "indicator-green";

    const radonStatus = document.getElementById('radonStatus');
    const isRadonHigh = radon && parseFloat(radon.radon_potential_percentage) >= 1;
    radonStatus.innerText = radon ? (isRadonHigh ? `AFFECTED_${radon.radon_potential_percentage}%` : "NEGATIVE") : "DATA_OFFLINE";
    radonStatus.className = isRadonHigh ? "indicator-red" : "indicator-green";

    // Insight Logic
    const riskLevel = document.getElementById('riskLevel');
    if (flood.length > 0 || isRadonHigh) {
        riskLevel.innerText = ">> WARNING: GEO-HAZARDS DETECTED. CONSULT SURVEYOR.";
        riskLevel.className = "mt-3 p-3 text-[10px] rounded data-mono bg-red-900/20 text-red-400 border border-red-800";
    } else {
        riskLevel.innerText = ">> STABLE: NO CRITICAL ENVIRONMENTAL ANOMALIES.";
        riskLevel.className = "mt-3 p-3 text-[10px] rounded data-mono bg-green-900/10 text-green-400 border border-green-900/30";
    }

    // Connectivity
    document.getElementById('broadbandSpeed').innerHTML = conn ? `
        <p>MAX: <span class="text-white">${conn.average_download_speed_mbps} Mbps</span></p>
        <p>TECH: <span class="text-gray-500">${conn.full_fibre_availability === 'Y' ? 'FULL_FIBRE' : 'VDSL'}</span></p>` : "INFRA_DATA_OFFLINE";

    // Schools
    document.getElementById('schoolList').innerHTML = schools ? schools.slice(0,3).map(s => `
        <div class="flex justify-between items-center border-b border-gray-900 pb-1">
            <span>${s.institution_name.substring(0,18)}</span>
            <span class="text-gray-500">[${(s.ofsted_rating_name || "NA").substring(0,4)}]</span>
        </div>`).join('') : "EDUCATION_DATA_OFFLINE";

    // EPC
    const badge = document.getElementById('epcBadge');
    badge.innerText = `[${epc['current-energy-rating']}]`;
    document.getElementById('epcRatingRaw').innerText = epc['current-energy-rating'];
    document.getElementById('epcPotentialRaw').innerText = epc['potential-energy-rating'];
    document.getElementById('epcHeating').innerText = epc['mainheating-description'] || "NOT_RECORDED";

    document.getElementById('dashboard').classList.remove('hidden');
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg;
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500'}`;
}
