/**
 * £Per | Property Audit Engine - v10.5 (Secure)
 * Security: Credentials moved to Cloudflare Vault
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 

let currentEpcRows = [];

async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    
    if (!pcMatch) {
        updateStatus("ERROR: INVALID_POSTCODE", "error");
        return;
    }

    const pc = pcMatch[0].toUpperCase();
    updateStatus(`SCANNING_REGISTRY: ${pc}...`, "loading");

    try {
        // We no longer send the 'Authorization' header here.
        // The Worker will see this URL and inject the header for us.
        const epcTarget = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g, '')}`;
        
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(epcTarget)}`);
        const data = await safeParse(res);
        
        if (!data || !data.rows || data.rows.length === 0) throw new Error("NO_RECORDS_FOUND");

        currentEpcRows = data.rows;
        populateAddressDropdown(data.rows);
        updateStatus("RESOLVE_UNIT_TO_PROCEED", "success");
    } catch (err) {
        updateStatus(`CRITICAL_FAIL: ${err.message}`, "error");
    }
}

async function selectAddress() {
    const index = document.getElementById('addressDropdown').value;
    if (index === "") return;

    const epc = currentEpcRows[index];
    const pc = epc.postcode;
    
    updateStatus("RUNNING_MULTI_POINT_AUDIT...", "loading");

    // Standard fetches for other modules
    const [lr, flood, conn, schools, radon] = await Promise.all([
        safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=25`),
        safeFetch(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`),
        safeFetch(`https://api.getthedata.com/broadband/postcode/${pc.replace(/\s/g, '')}`),
        safeFetch(`https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`),
        safeFetch(`https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`)
    ]);

    renderForensicUI(epc, lr?.result?.items || [], flood?.items || [], conn?.data, schools?.data, radon?.data);
    updateStatus("AUDIT_COMPLETE", "success");
}

// --- UTILITIES ---
async function safeParse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        if (text.includes("<html")) throw new Error("API_REJECTED_BY_GOV_SERVER");
        throw new Error("MALFORMED_DATA");
    }
}

async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        return await safeParse(res);
    } catch (e) { return null; }
}

function renderForensicUI(epc, sales, flood, conn, schools, radon) {
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "NOT_ASSIGNED";
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(epc.address + ' ' + epc.postcode)}`;

    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displaySize').innerText = Math.round(area);

    let totalSqm = 0, count = 0;
    sales.forEach(s => { if (s.latestTransaction && area > 0) { totalSqm += (s.latestTransaction.pricePaid / area); count++; }});
    document.getElementById('valMetric').innerText = count > 0 ? `£${Math.round(totalSqm/count).toLocaleString()}` : "N/A";

    const floodStatus = document.getElementById('floodStatus');
    floodStatus.innerText = (flood && flood.length > 0) ? "DETECTED" : "NEGATIVE";
    floodStatus.className = (flood && flood.length > 0) ? "indicator-red" : "indicator-green";

    const isRadonHigh = radon && parseFloat(radon.radon_potential_percentage) >= 1;
    document.getElementById('radonStatus').innerText = radon ? (isRadonHigh ? `AFFECTED_${radon.radon_potential_percentage}%` : "NEGATIVE") : "N/A";
    document.getElementById('radonStatus').className = isRadonHigh ? "indicator-red" : "indicator-green";

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
