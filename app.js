const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 
let currentEpcRows = [];

function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    if (!text || !dot) return;
    text.innerText = msg.toUpperCase();
    dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}

async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (e) {
        console.error("JSON Guard Triggered:", e);
        return null;
    }
}

async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    if (/^\d+$/.test(input)) {
        await fetchByUprn(input);
    } else {
        const pcMatch = input.match(/([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})/i);
        if (pcMatch) await searchByPostcode(pcMatch[0].toUpperCase());
    }
}

async function fetchByUprn(uprn) {
    updateStatus("FETCHING_EPC", "loading");
    const data = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${uprn}`);
    if (data?.rows?.length > 0) initiateFinalAudit(data.rows[0]);
    else updateStatus("EPC_NOT_FOUND", "error");
}

async function searchByPostcode(pc) {
    updateStatus("SCANNING_POSTCODE", "loading");
    const data = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g,'')}`);
    if (data?.rows?.length > 0) {
        currentEpcRows = data.rows;
        renderAddressList(currentEpcRows);
    } else {
        initiateFinalAudit({ postcode: pc, address: "POSTCODE_ONLY", uprn: "N/A" });
    }
}

async function initiateFinalAudit(epc) {
    document.getElementById('dashboard').classList.remove('hidden');
    
    // EPC METRICS
    const m2 = parseFloat(epc['total-floor-area']) || 0;
    const sqft = Math.round(m2 * 10.764);
    
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'] || "?";
    document.getElementById('sqftMetric').innerText = m2 > 0 ? `${sqft} SQFT (${m2}m²)` : "N/A";

    const pc = epc.postcode;
    if (pc) {
        loadMarketData(pc);
        loadSchoolsData(pc.replace(/\s/g, ''));
    }
    updateStatus("AUDIT_READY", "success");
}

async function loadMarketData(pc) {
    const marketBody = document.getElementById('marketBody');
    marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center animate-pulse'>LOADING_MARKET...</td></tr>";
    
    // Formatting postcode with space for Land Registry
    const formattedPc = pc.includes(' ') ? pc : pc.slice(0, -3) + ' ' + pc.slice(-3);
    const data = await safeFetch(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(formattedPc)}&_limit=10`);
    
    const items = data?.result?.items || [];
    marketBody.innerHTML = "";
    
    if (items.length > 0) {
        items.sort((a,b) => new Date(b.latestTransaction.date) - new Date(a.latestTransaction.date));
        items.slice(0, 5).forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class='p-4 text-gray-500'>${s.latestTransaction.date}</td>
                <td class='p-4 text-white'>${s.paon || ''} ${s.street || ''}</td>
                <td class='p-4 text-[9px] uppercase'>${s.propertyType?.label || 'UNIT'}</td>
                <td class='p-4 text-green-500 font-bold'>£${s.latestTransaction.pricePaid.toLocaleString()}</td>
            `;
            marketBody.appendChild(row);
        });
    } else {
        marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-gray-600'>NO_RECENT_SALES_FOUND</td></tr>";
    }
}

async function loadSchoolsData(pc) {
    const container = document.getElementById('schoolList');
    const data = await safeFetch(`https://api.getthedata.com/schools/postcode/${pc}`);
    const schools = data?.data || [];
    
    container.innerHTML = "";
    if (schools.length > 0) {
        schools.slice(0, 3).forEach(s => {
            const div = document.createElement('div');
            div.className = "bg-black p-3 border border-gray-900 rounded";
            div.innerHTML = `<div class='text-[9px] text-blue-400 font-black uppercase truncate'>${s.school_name}</div><div class='text-[10px] text-white font-bold mt-1'>${s.ofsted_rating || 'N/A'}</div><div class='text-[9px] text-gray-600'>AGES: ${s.age_range || 'N/A'}</div>`;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = "<div class='text-gray-800 text-[10px] p-2'>NO_LOCAL_SCHOOLS</div>";
    }
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
