/**
 * £Per | Property Audit Engine - v10.8 (Master Build)
 * Features: Zoopla UPRN Extraction, Land Registry Sold Prices, 
 * EPC Discovery, and Environmental Risk Audit.
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 

let currentEpcRows = [];

// --- 1. ENTRY POINT (POSTCODE OR URL) ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    // Reset UI State
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('historySection').classList.add('hidden');

    // PATH A: ZOOPLA URL DETECTION
    if (input.includes("zoopla.co.uk")) {
        updateStatus("SCRAPING ZOOPLA SOURCE...", "loading");
        try {
            // Worker fetches HTML and extracts UPRN via Regex
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
            // Unique UPRN found -> Run audit immediately
            await initiateFinalAudit(data.rows[0]);
        } else {
            throw new Error("UPRN_NOT_IN_REGISTRY");
        }
    } catch (e) {
        updateStatus(`UPRN_ERROR: ${e.message}`, "error");
    }
}

// --- 3. ADDRESS SELECTION (POSTCODE PATH ONLY) ---
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
        // Parallel fetch for secondary data points
        const [lr, flood, radon] = await Promise.all([
            safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=50`),
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
    // Header Info
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    
    const mapQuery = encodeURIComponent(`${epc.address}, ${epc.postcode}`);
    document.getElementById('mapLink').href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    // EPC Metrics
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'];
    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displaySize').innerText = Math.round(area);
    document.getElementById('epcHeating').innerText = epc['mainheating-description'] || "DATA_NOT_PROVIDED";

    // Filter Sales History for specific house
    const subjectHouse = epc.address.split(' ')[0].toUpperCase();
    const houseSales = sales.filter(s => s.paon && s.paon.toUpperCase() === subjectHouse);

    // Dynamic Valuation Calculation
    let val = "N/A";
    if (houseSales.length > 0 && area > 0) {
        let totalSqm = 0, count = 0;
        houseSales.forEach(s => {
            if (s.latestTransaction) {
                totalSqm += (s.latestTransaction.pricePaid / area);
                count++;
            }
        });
        val = count > 0 ? `£${Math.round(totalSqm / count).toLocaleString()}` : "N/A";
    }
    document.getElementById('valMetric').innerText = val;

    // --- SOLD PRICE TABLE LOGIC ---
    const historyBody = document.getElementById('historyBody');
    const historySection = document.getElementById('historySection');
    historyBody.innerHTML = ""; 

    if (houseSales.length > 0) {
        // Sort: Newest transactions at the top
        houseSales.sort((a, b) => new Date(b.latestTransaction.date) - new Date(a.latestTransaction.date));
        
        houseSales.forEach(item => {
            const row = document.createElement('tr');
            row.className = "hover:bg-white/5 transition-colors";
            row.innerHTML = `
                <td class="p-4 text-white">${item.latestTransaction.date}</td>
                <td class="p-4 font-bold text-green-400">£${item.latestTransaction.pricePaid.toLocaleString()}</td>
                <td class="p-4 text-gray-500">${item.propertyType.label} / ${item.estateType.label}</td>
                <td class="p-4 text-[9px] text-gray-700 uppercase font-mono">${item.latestTransaction.transactionId.split('-')[0]}...</td>
            `;
            historyBody.appendChild(row);
        });
        historySection.classList.remove('hidden');
    }

    // Environmental Risk UI
    const floodEl = document.getElementById('floodStatus');
    floodEl.innerText = flood.length > 0 ? "STATION_DETECTED" : "NEGATIVE";
    floodEl.className = flood.length > 0 ? "indicator-red" : "indicator-green";

    const radonEl = document.getElementById('radonStatus');
    const isRadonHigh = radon && parseFloat(radon.radon_potential_percentage) >= 1;
    radonEl.innerText = isRadonHigh ? "AFFECTED_AREA" : "NEGATIVE";
    radonEl.className = isRadonHigh ? "indicator-red" : "indicator-green";

    // Final Reveal
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
}

// --- UTILS ---
async function safeParse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        if (text.includes("<html")) throw new Error("API_ACCESS_DENIED_BY_GOV_FIREWALL");
        throw new Error("JSON_PARSE_ERROR");
    }
}

async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        return await safeParse(res);
    } catch (e) { 
        console.warn(`Fetch failed for: ${url}`);
        return null; 
    }
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${
        type === 'loading' ? 'bg-blue-500 animate-pulse' : 
        type === 'error' ? 'bg-red-600' : 
        'bg-green-500 shadow-[0_0_8px_green]'
    }`;
}
