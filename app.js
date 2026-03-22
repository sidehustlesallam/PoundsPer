/**
 * £Per | Property Audit Engine - v11.0
 * Logic: UPRN/Postcode Hybrid + School API + Land Registry Table
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
let currentEpcRows = [];

async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    
    // Reset
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    // 1. Check if UPRN (10-12 digits)
    if (/^\d{10,12}$/.test(input)) {
        await fetchByUprn(input);
        return;
    }

    // 2. Check if Postcode
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    if (pcMatch) {
        const pc = pcMatch[0].toUpperCase().replace(/\s/g, '');
        await searchByPostcode(pc);
    } else {
        updateStatus("INVALID_INPUT", "error");
    }
}

async function searchByPostcode(pc) {
    updateStatus("SCANNING_POSTCODE...", "loading");
    try {
        const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await safeParse(res);
        if (data.rows && data.rows.length > 0) {
            currentEpcRows = data.rows;
            renderAddressList(currentEpcRows);
            updateStatus("SELECT_ADDRESS", "success");
        }
    } catch (e) { updateStatus("POSTCODE_FAIL", "error"); }
}

async function fetchByUprn(uprn) {
    updateStatus("UPRN_QUERY...", "loading");
    try {
        const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${uprn}`;
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
        const data = await safeParse(res);
        if (data.rows && data.rows.length > 0) {
            await initiateFinalAudit(data.rows[0]);
        }
    } catch (e) { updateStatus("UPRN_NOT_FOUND", "error"); }
}

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

async function initiateFinalAudit(epc) {
    updateStatus("AUDITING_ASSET...", "loading");
    const pc = epc.postcode;
    try {
        const [lr, flood, radon, schools] = await Promise.all([
            safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=25`),
            safeFetch(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${encodeURIComponent(pc)}`),
            safeFetch(`https://api.getthedata.com/radon/postcode/${pc.replace(/\s/g, '')}`),
            safeFetch(`https://api.getthedata.com/schools/postcode/${pc.replace(/\s/g, '')}`)
        ]);

        renderDashboard(epc, lr?.result?.items || [], flood?.items || [], radon?.data, schools?.data || []);
        updateStatus("AUDIT_COMPLETE", "success");
    } catch (e) { updateStatus("PARTIAL_LOAD", "success"); }
}

function renderDashboard(epc, sales, flood, radon, schools) {
    document.getElementById('displayAddress').innerText = epc.address;
    document.getElementById('displayUprn').innerText = epc.uprn;
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'];

    // 1. SCHOOLS (Top 3)
    const schoolContainer = document.getElementById('schoolList');
    schoolContainer.innerHTML = "";
    schools.slice(0, 3).forEach(s => {
        const div = document.createElement('div');
        div.className = "bg-black p-3 border border-gray-900 rounded";
        div.innerHTML = `
            <div class="text-[10px] text-blue-400 font-bold mb-1">${s.school_name.toUpperCase()}</div>
            <div class="text-[9px] text-gray-500">AGE: ${s.age_range || 'N/A'}</div>
            <div class="text-[9px] text-white mt-1">OFSTED: ${s.ofsted_rating || 'PENDING'}</div>
        `;
        schoolContainer.appendChild(div);
    });

    // 2. VALUATION & MARKET TABLE
    const marketBody = document.getElementById('marketBody');
    marketBody.innerHTML = "";
    
    // Sort all sales by date newest first
    sales.sort((a,b) => new Date(b.latestTransaction.date) - new Date(a.latestTransaction.date));
    
    let totalSqm = 0, count = 0;
    const area = parseFloat(epc['total-floor-area']) || 0;

    sales.slice(0, 5).forEach(item => {
        const row = document.createElement('tr');
        const price = item.latestTransaction.pricePaid;
        if (area > 0) { totalSqm += (price / area); count++; }
        
        row.innerHTML = `
            <td class="p-4">${item.latestTransaction.date}</td>
            <td class="p-4 text-white">${item.paon} ${item.street}</td>
            <td class="p-4 uppercase text-gray-500">${item.propertyType.label}</td>
            <td class="p-4 font-bold text-green-500">£${price.toLocaleString()}</td>
        `;
        marketBody.appendChild(row);
    });
    document.getElementById('valMetric').innerText = count > 0 ? `£${Math.round(totalSqm/count).toLocaleString()}/m²` : "N/A";

    // 3. HAZARDS
    document.getElementById('floodStatus').innerText = flood.length > 0 ? "YES" : "NO";
    document.getElementById('radonStatus').innerText = (radon && parseFloat(radon.radon_potential_percentage) >= 1) ? "HIGH" : "LOW";

    document.getElementById('dashboard').classList.remove('hidden');
}

// UTILS
async function safeParse(res) {
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { throw new Error("PARSE_ERROR"); }
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
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500'}`;
}
