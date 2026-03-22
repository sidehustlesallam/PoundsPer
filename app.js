/**
 * £Per | Property Audit Engine - v11.5
 * Fix: Restored updateStatus, added safe JSON handling
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
let currentEpcRows = [];

// --- 1. UI HELPERS (Critical Fix) ---
function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    if (!text || !dot) return;
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${
        type === 'loading' ? 'bg-blue-500 animate-pulse' : 
        type === 'error' ? 'bg-red-600' : 'bg-green-500 shadow-[0_0_8px_green]'
    }`;
}

async function safeParse(res) {
    try {
        const text = await res.text();
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Fail:", e);
        return null;
    }
}

// --- 2. DISCOVERY ---
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    // Path A: Zoopla URL
    if (input.includes("zoopla.co.uk")) {
        updateStatus("SCRAPING ZOOPLA...", "loading");
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(input)}`);
        const data = await safeParse(res);
        if (data?.extractedUprn) {
            await fetchByUprn(data.extractedUprn);
        } else {
            updateStatus("UPRN NOT FOUND IN URL", "error");
        }
        return;
    }

    // Path B: UPRN Direct
    if (/^\d+$/.test(input)) {
        await fetchByUprn(input);
        return;
    }

    // Path C: Postcode
    const pcMatch = input.match(/([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
    if (pcMatch) {
        const pc = pcMatch[0].toUpperCase().replace(/\s/g, '');
        await searchByPostcode(pc);
    }
}

async function fetchByUprn(uprn) {
    updateStatus(`QUERYING UPRN: ${uprn}`, "loading");
    const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${uprn}`;
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
    const data = await safeParse(res);
    
    if (data?.rows?.length > 0) {
        initiateFinalAudit(data.rows[0]);
    } else {
        updateStatus("EPC DATA MISSING", "error");
        // Fallback: Start audit with empty EPC record
        initiateFinalAudit({ uprn: uprn, address: "Manual Entry", postcode: "" });
    }
}

async function searchByPostcode(pc) {
    updateStatus("SCANNING REGISTRY...", "loading");
    const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`;
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
    const data = await safeParse(res);

    if (data?.rows?.length > 0) {
        currentEpcRows = data.rows;
        renderAddressList(currentEpcRows);
        updateStatus("SELECT ADDRESS", "success");
    } else {
        updateStatus("NO EPC FOUND", "error");
        initiateFinalAudit({ postcode: pc, address: "Postcode Search", uprn: "N/A" });
    }
}

// --- 3. MODULE LOADING ---
function renderAddressList(rows) {
    const container = document.getElementById('addressSelectorContainer');
    const dropdown = document.getElementById('addressDropdown');
    dropdown.innerHTML = '<option value="">-- SELECT UNIT --</option>';
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

async function initiateFinalAudit(epc) {
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('displayAddress').innerText = epc.address;
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'] || "?";

    const pc = epc.postcode;
    if (!pc) return;

    // Load Market
    const marketBody = document.getElementById('marketBody');
    marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center animate-pulse'>LOADING...</td></tr>";
    
    const formattedPc = pc.includes(' ') ? pc : pc.slice(0, -3) + ' ' + pc.slice(-3);
    const lrRes = await fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(formattedPc)}&_limit=5`)}`);
    const lrData = await safeParse(lrRes);
    
    marketBody.innerHTML = "";
    const sales = lrData?.result?.items || [];
    if (sales.length > 0) {
        sales.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `<td class='p-4 text-gray-500'>${s.latestTransaction.date}</td><td class='p-4 text-white'>${s.paon} ${s.street}</td><td class='p-4 uppercase'>${s.propertyType.label}</td><td class='p-4 text-green-500 font-bold'>£${s.latestTransaction.pricePaid.toLocaleString()}</td>`;
            marketBody.appendChild(row);
        });
    }

    // Load Geo/Constituency
    const schoolList = document.getElementById('schoolList');
    const geoRes = await fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://api.getthedata.com/postcode/${pc.replace(/\s/g,'')}`)}`);
    const geoData = await safeParse(geoRes);
    if (geoData?.data) {
        schoolList.innerHTML = `
            <div class='bg-black p-3 border border-gray-900 rounded'><div class='text-[9px] text-gray-500'>WARD</div><div class='text-white font-bold'>${geoData.data.admin_ward}</div></div>
            <div class='bg-black p-3 border border-gray-900 rounded'><div class='text-[9px] text-gray-500'>DISTRICT</div><div class='text-white font-bold'>${geoData.data.admin_district}</div></div>
            <div class='bg-black p-3 border border-gray-900 rounded'><div class='text-[9px] text-gray-500'>CONSTITUENCY</div><div class='text-white font-bold'>${geoData.data.parliamentary_constituency}</div></div>
        `;
    }
    updateStatus("AUDIT LOADED", "success");
}
