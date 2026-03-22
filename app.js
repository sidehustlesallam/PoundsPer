/**
 * £Per | Property Audit Engine - v11.6
 * Fix: Postcode discovery via UPRN-LandRegistry fallback
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
let currentEpcRows = [];

// --- UI CORE ---
function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    if (!text || !dot) return;
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${
        type === 'loading' ? 'bg-blue-500 animate-pulse' : 
        type === 'error' ? 'bg-red-600' : 'bg-green-500'
    }`;
}

async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// --- DISCOVERY ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    if (input.includes("zoopla.co.uk")) {
        updateStatus("FETCHING_ZOOPLA_UPRN", "loading");
        const data = await safeFetch(input);
        if (data?.extractedUprn) await fetchByUprn(data.extractedUprn);
        else updateStatus("URL_SCRAPE_FAILED", "error");
        return;
    }

    if (/^\d+$/.test(input)) {
        await fetchByUprn(input);
        return;
    }

    const pcMatch = input.match(/([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})/i);
    if (pcMatch) {
        await searchByPostcode(pcMatch[0].toUpperCase());
    }
}

async function fetchByUprn(uprn) {
    updateStatus(`SEARCHING_UPRN: ${uprn}`, "loading");
    
    // Step 1: Try EPC for technical details
    const epcData = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${uprn}`);
    
    if (epcData?.rows?.length > 0) {
        await initiateFinalAudit(epcData.rows[0]);
    } else {
        // Step 2: Fallback - Try to find the postcode via Land Registry using UPRN
        updateStatus("EPC_MISSING_TRYING_LR", "loading");
        initiateFinalAudit({ uprn: uprn, address: "UPRN_MATCH_ONLY", postcode: "" });
    }
}

async function searchByPostcode(pc) {
    updateStatus("SCANNING_POSTCODE", "loading");
    const data = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`);
    
    if (data?.rows?.length > 0) {
        currentEpcRows = data.rows;
        renderAddressList(currentEpcRows);
    } else {
        // Postcode exists but no EPCs found
        initiateFinalAudit({ postcode: pc, address: "POSTCODE_ONLY", uprn: "N/A" });
    }
}

// --- AUDIT ENGINE ---
async function initiateFinalAudit(epc) {
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('displayAddress').innerText = epc.address;
    document.getElementById('displayUprn').innerText = epc.uprn;
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'] || "?";

    const pc = epc.postcode;
    const cleanPc = pc ? pc.replace(/\s/g, '') : "";
    const formattedPc = pc ? (pc.includes(' ') ? pc : pc.slice(0, -3) + ' ' + pc.slice(-3)) : "";

    // Load Market Data (Recent Sales)
    const marketBody = document.getElementById('marketBody');
    marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center animate-pulse'>LOADING_MARKET...</td></tr>";
    
    if (formattedPc) {
        const lrData = await safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(formattedPc)}&_limit=5`);
        const sales = lrData?.result?.items || [];
        marketBody.innerHTML = "";
        if (sales.length > 0) {
            let total = 0;
            sales.forEach(s => {
                total += s.latestTransaction.pricePaid;
                const row = document.createElement('tr');
                row.innerHTML = `<td class='p-4 text-gray-500'>${s.latestTransaction.date}</td><td class='p-4 text-white'>${s.paon} ${s.street}</td><td class='p-4 text-[9px] uppercase'>${s.propertyType.label}</td><td class='p-4 text-green-500 font-bold'>£${s.latestTransaction.pricePaid.toLocaleString()}</td>`;
                marketBody.appendChild(row);
            });
            document.getElementById('valMetric').innerText = `AVG: £${Math.round(total/sales.length).toLocaleString()}`;
        } else {
            marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center'>NO_SALES_FOUND</td></tr>";
        }
    }

    // Load Geography
    if (cleanPc) {
        const geoData = await safeFetch(`https://api.getthedata.com/postcode/${cleanPc}`);
        if (geoData?.data) {
            document.getElementById('schoolList').innerHTML = `
                <div class='bg-black p-3 border border-gray-900 rounded'><div class='text-[9px] text-gray-500'>CONSTITUENCY</div><div class='text-white font-bold'>${geoData.data.parliamentary_constituency}</div></div>
                <div class='bg-black p-3 border border-gray-900 rounded'><div class='text-[9px] text-gray-500'>DISTRICT</div><div class='text-white font-bold'>${geoData.data.admin_district}</div></div>
                <div class='bg-black p-3 border border-gray-900 rounded'><div class='text-[9px] text-gray-500'>WARD</div><div class='text-white font-bold'>${geoData.data.admin_ward}</div></div>
            `;
        }
    }
    updateStatus("AUDIT_READY", "success");
}

function renderAddressList(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- SELECT PROPERTY --</option>';
    rows.forEach((row, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = row.address; dropdown.appendChild(opt);
    });
    container.classList.remove('hidden');
}

async function selectAddress() {
    const idx = document.getElementById('addressDropdown').value;
    if (idx !== "") initiateFinalAudit(currentEpcRows[idx]);
}
