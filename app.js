/**
 * £Per | Property Audit Engine - v11.3
 * Features: UPRN/PC Hybrid, Market Table (Sorted), Geo-Context
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
let currentEpcRows = [];

// --- 1. DISCOVERY ROUTER ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    // UI Reset
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    // Path A: UPRN Detection (1-12 digits)
    if (/^\d{1,12}$/.test(input)) {
        await fetchByUprn(input);
        return;
    }

    // Path B: Postcode Detection
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    if (pcMatch) {
        const pc = pcMatch[0].toUpperCase().replace(/\s/g, '');
        await searchByPostcode(pc);
    } else {
        updateStatus("INVALID INPUT: ENTER UPRN OR POSTCODE", "error");
    }
}

// --- 2. DATA ACQUISITION ---
async function fetchByUprn(uprn) {
    updateStatus(`UPRN_SCAN: ${uprn}`, "loading");
    try {
        const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${uprn}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await res.json();
        
        if (data?.rows?.length > 0) {
            await initiateFinalAudit(data.rows[0]);
        } else {
            // Check non-domestic as fallback
            const ndTarget = `https://epc.opendatacommunities.org/api/v1/non-domestic/search?uprn=${uprn}`;
            const ndRes = await fetch(`${PROXY_URL}?url=${encodeURIComponent(ndTarget)}`);
            const ndData = await ndRes.json();
            if (ndData?.rows?.length > 0) await initiateFinalAudit(ndData.rows[0]);
            else throw new Error("UPRN_NOT_FOUND");
        }
    } catch (e) { updateStatus("UPRN NOT IN REGISTER", "error"); }
}

async function searchByPostcode(pc) {
    updateStatus(`PC_SCAN: ${pc}`, "loading");
    try {
        const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data?.rows?.length > 0) {
            currentEpcRows = data.rows;
            renderAddressList(currentEpcRows);
            updateStatus(`${data.rows.length} UNITS RESOLVED`, "success");
        } else {
            throw new Error("NO_POSTCODE_DATA");
        }
    } catch (e) { updateStatus("POSTCODE NOT FOUND", "error"); }
}

// --- 3. FINAL AUDIT & API AGGREGATION ---
async function initiateFinalAudit(epc) {
    updateStatus("MINING REGISTRIES...", "loading");
    
    // Land Registry requires space: "SW1A 1AA"
    const pc = epc.postcode;
    const formattedPc = pc.includes(' ') ? pc : pc.slice(0, -3) + ' ' + pc.slice(-3);
    const cleanPc = pc.replace(/\s/g, '');

    try {
        const [lrRes, floodRes, geoRes] = await Promise.all([
            fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(formattedPc)}&_limit=25`)}`),
            fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(cleanPc)}`)}`),
            fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://api.getthedata.com/postcode/${cleanPc}`)}`)
        ]);

        const lr = await lrRes.json().catch(() => null);
        const flood = await floodRes.json().catch(() => null);
        const geo = await geoRes.json().catch(() => null);

        renderDashboard(epc, lr, flood, geo);
        updateStatus("AUDIT COMPLETE", "success");
    } catch (e) { 
        updateStatus("PARTIAL AUDIT LOADED", "success");
    }
}

// --- 4. DASHBOARD RENDERER ---
function renderDashboard(epc, lr, flood, geo) {
    // Basic Asset Info
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'] || "?";

    // Market Activity Table
    const marketBody = document.getElementById('marketBody');
    marketBody.innerHTML = "";
    const sales = lr?.result?.items || [];
    
    if (sales.length > 0) {
        sales.sort((a,b) => new Date(b.latestTransaction.date) - new Date(a.latestTransaction.date));
        let total = 0;
        sales.slice(0, 5).forEach(s => {
            const row = document.createElement('tr');
            const price = s.latestTransaction.pricePaid;
            total += price;
            row.innerHTML = `
                <td class="p-4 text-gray-500">${s.latestTransaction.date}</td>
                <td class="p-4 text-white font-medium">${s.paon || ''} ${s.street || ''}</td>
                <td class="p-4 uppercase text-gray-500 text-[9px]">${s.propertyType?.label || 'UNIT'}</td>
                <td class="p-4 font-bold text-green-500">£${price.toLocaleString()}</td>
            `;
            marketBody.appendChild(row);
        });
        document.getElementById('valMetric').innerText = `AVG: £${Math.round(total/Math.min(sales.length,5)).toLocaleString()}`;
    } else {
        marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-gray-700 font-mono text-[10px] uppercase'>Land Registry Return Empty for Sector</td></tr>";
        document.getElementById('valMetric').innerText = "N/A";
    }

    // Geo-Context (School/Area Fallback)
    const schoolContainer = document.getElementById('schoolList');
    schoolContainer.innerHTML = "";
    if (geo && geo.data) {
        const context = [
            { k: "CONSTITUENCY", v: geo.data.parliamentary_constituency },
            { k: "DISTRICT", v: geo.data.admin_district },
            { k: "WARD", v: geo.data.admin_ward }
        ];
        context.forEach(c => {
            const div = document.createElement('div');
            div.className = "bg-black p-3 border border-gray-900 rounded";
            div.innerHTML = `<div class="text-[9px] text-gray-500 font-black uppercase">${c.k}</div><div class="text-[11px] text-white font-bold mt-1">${c.v || 'N/A'}</div>`;
            schoolContainer.appendChild(div);
        });
    }

    // Hazards
    const floodStatus = flood?.items?.length > 0;
    const floodEl = document.getElementById('floodStatus');
    floodEl.innerText = floodStatus ? "MONITORING_ACTIVE" : "NEGATIVE";
    floodEl.className = floodStatus ? "indicator-red" : "indicator-green";

    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
}

// --- UTILS ---
function renderAddressList(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    rows.sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true}));
    dropdown.innerHTML = '<option value="">-- SELECT RESOLVED UNIT --</option>';
    rows.forEach((row, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = row.address; dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

async function selectAddress() {
    const idx = document.getElementById('addressDropdown').value;
    if (idx !== "") await initiateFinalAudit(currentEpcRows[idx]);
}

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}
