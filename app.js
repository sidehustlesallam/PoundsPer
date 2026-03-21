/**
 * £Per | Property Audit Engine - v10.7
 * Features: Zoopla UPRN Scraping + Postcode Fallback
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 

let currentEpcRows = [];

// --- 1. ENTRY POINT ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    // Reset UI State
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    // PATH A: ZOOPLA URL DETECTION
    if (input.includes("zoopla.co.uk")) {
        updateStatus("SCRAPING ZOOPLA SOURCE...", "loading");
        try {
            // Ask the worker to find the UPRN in the Zoopla HTML
            const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(input)}`);
            const data = await res.json();
            
            if (data.extractedUprn) {
                updateStatus(`UPRN IDENTIFIED: ${data.extractedUprn}`, "success");
                await fetchByUprn(data.extractedUprn);
            } else {
                throw new Error("UPRN_NOT_FOUND_IN_SOURCE");
            }
        } catch (e) {
            updateStatus(`SCRAPE_FAIL: ${e.message}`, "error");
            console.error(e);
        }
        return;
    }

    // PATH B: STANDARD POSTCODE DETECTION
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    if (pcMatch) {
        const pc = pcMatch[0].toUpperCase().replace(/\s/g, '');
        updateStatus(`SEARCHING POSTCODE: ${pc}...`, "loading");
        try {
            const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`;
            const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
            const data = await safeParse(res);
            
            if (!data || !data.rows || data.rows.length === 0) throw new Error("NO_RECORDS");

            currentEpcRows = data.rows;
            renderAddressList(currentEpcRows);
            updateStatus(`${currentEpcRows.length} UNITS FOUND`, "success");
        } catch (err) {
            updateStatus(`FAIL: ${err.message}`, "error");
        }
    } else {
        updateStatus("ERROR: PROVIDE POSTCODE OR ZOOPLA URL", "error");
    }
}

// --- 2. UPRN DIRECT QUERY ---
async function fetchByUprn(uprn) {
    updateStatus("QUERYING GOV DATABASE...", "loading");
    try {
        const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${uprn}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await safeParse(res);

        if (data.rows && data.rows.length > 0) {
            // Jump straight to dashboard for the unique UPRN record
            await initiateFinalAudit(data.rows[0]);
        } else {
            throw new Error("UPRN_NOT_IN_REGISTRY");
        }
    } catch (e) {
        updateStatus(`UPRN_ERROR: ${e.message}`, "error");
    }
}

// --- 3. ADDRESS SELECTION (POSTCODE PATH) ---
function renderAddressList(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true}));
    dropdown.innerHTML = '<option value="">-- CLICK TO SELECT UNIT --</option>';
    rows.forEach((row, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = row.address;
        dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth' });
}

async function selectAddress() {
    const idx = document.getElementById('addressDropdown').value;
    if (idx === "") return;
    await initiateFinalAudit(currentEpcRows[idx]);
}

// --- 4. DATA ORCHESTRATOR ---
async function initiateFinalAudit(epcRecord) {
    updateStatus("ORCHESTRATING FORENSIC DATA...", "loading");
    try {
        const pc = epcRecord.postcode;
        const [lr, flood, radon] = await Promise.all([
            safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=20`),
            safeFetch(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`),
            safeFetch(`https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`)
        ]);

        renderDashboard(epcRecord, lr?.result?.items || [], flood?.items || [], radon?.data);
        updateStatus("AUDIT_COMPLETE", "success");
    } catch (e) {
        updateStatus("PARTIAL_DATA_LOADED", "success");
        renderDashboard(epcRecord, [], [], null);
    }
}

// --- 5. UI RENDERER ---
function renderDashboard(epc, sales, flood, radon) {
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    
    // Improved Map link
    const mapQuery = encodeURIComponent(`${epc.address}, ${epc.postcode}`);
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    document.getElementById('epcBadge').innerText = epc['current-energy-rating'];
    
    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displaySize').innerText = Math.round(area);

    // Dynamic Valuation logic
    let val = "N/A";
    if (sales.length > 0 && area > 0) {
        let totalSqm = 0, count = 0;
        sales.forEach(s => {
            if (s.latestTransaction) {
                totalSqm += (s.latestTransaction.pricePaid / area);
                count++;
            }
        });
        val = count > 0 ? `£${Math.round(totalSqm / count).toLocaleString()}` : "N/A";
    }
    document.getElementById('valMetric').innerText = val;

    // Environmental Risk
    const floodEl = document.getElementById('floodStatus');
    floodEl.innerText = flood.length > 0 ? "STATION_NEARBY" : "NEGATIVE";
    floodEl.className = flood.length > 0 ? "indicator-red" : "indicator-green";

    const radonEl = document.getElementById('radonStatus');
    const isRadonHigh = radon && parseFloat(radon.radon_potential_percentage) >= 1;
    radonEl.innerText = isRadonHigh ? "AFFECTED_AREA" : "NEGATIVE";
    radonEl.className = isRadonHigh ? "indicator-red" : "indicator-green";

    document.getElementById('epcHeating').innerText = epc['mainheating-description'] || "INFRASTRUCTURE_DATA_MISSING";

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
        throw new Error("PARSE_ERROR");
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
