/** * £Per Audit Engine v11.8 
 * Fix: Multi-format Postcode Routing & API Error Verbosity
 */
const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

// --- HELPERS ---
function updateStatus(msg, type) {
    const text = document.getElementById('statusText');
    const dot = document.getElementById('statusDot');
    if (text) text.innerText = msg.toUpperCase();
    if (dot) dot.className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : type === 'error' ? 'bg-red-600' : 'bg-green-500 shadow-[0_0_8px_green]'}`;
}

async function safeFetch(url) {
    console.log(`%c SCANNING: ${url}`, "color: #3b82f6; font-weight: bold;");
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error(`Audit Failure for ${url}:`, e);
        return null;
    }
}

// --- ENGINE ---
async function initiateFinalAudit(epc) {
    document.getElementById('dashboard').classList.remove('hidden');
    
    // 1. SET SUBJECT METRICS
    const area = parseFloat(epc['total-floor-area']) || 0;
    document.getElementById('displayAddress').innerText = epc.address.toUpperCase();
    document.getElementById('displayUprn').innerText = epc.uprn || "N/A";
    document.getElementById('epcBadge').innerText = epc['current-energy-rating'] || "?";
    document.getElementById('sqftMetric').innerText = area > 0 ? `${Math.round(area * 10.764)} SQFT (${area}m²)` : "N/A";

    // 2. POSTCODE NORMALIZATION
    let rawPc = epc.postcode || "";
    let cleanPc = rawPc.replace(/\s+/g, '').toUpperCase(); // SW1A1AA
    let spacedPc = cleanPc.length > 3 ? cleanPc.slice(0, -3) + " " + cleanPc.slice(-3) : cleanPc; // SW1A 1AA

    console.log(`Normalized Postcodes: Clean[${cleanPc}] Spaced[${spacedPc}]`);

    // 3. FIRE MODULES
    await Promise.all([
        loadMarketData(spacedPc),
        loadSchoolsData(cleanPc)
    ]);

    updateStatus("AUDIT_COMPLETE", "success");
}

async function loadMarketData(pc) {
    const marketBody = document.getElementById('marketBody');
    marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center animate-pulse'>ACCESSING_LAND_REGISTRY...</td></tr>";
    
    // Land Registry PPI API
    const url = `https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=10`;
    const data = await safeFetch(url);
    const items = data?.result?.items || [];

    marketBody.innerHTML = "";
    if (items.length > 0) {
        items.sort((a,b) => new Date(b.latestTransaction.date) - new Date(a.latestTransaction.date));
        items.slice(0, 5).forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class='p-4 text-gray-500'>${s.latestTransaction.date}</td>
                <td class='p-4 text-white font-medium'>${s.paon || ''} ${s.street || ''}</td>
                <td class='p-4 text-[9px] uppercase'>${s.propertyType?.label || 'UNIT'}</td>
                <td class='p-4 text-green-500 font-bold'>£${s.latestTransaction.pricePaid?.toLocaleString()}</td>
            `;
            marketBody.appendChild(row);
        });
        // Calc Avg
        const avg = items.reduce((acc, curr) => acc + curr.latestTransaction.pricePaid, 0) / items.length;
        document.getElementById('valMetric').innerText = `£${Math.round(avg).toLocaleString()}`;
    } else {
        marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-gray-700'>NO_RECENT_PPI_DATA</td></tr>";
        document.getElementById('valMetric').innerText = "N/A";
    }
}

async function loadSchoolsData(pc) {
    const container = document.getElementById('schoolList');
    container.innerHTML = "<div class='text-[10px] animate-pulse'>POLLING_OFSTED...</div>";

    // GetTheData Schools API
    const url = `https://api.getthedata.com/schools/postcode/${pc}`;
    const data = await safeFetch(url);
    const schools = data?.data || [];

    container.innerHTML = "";
    if (schools.length > 0 && Array.isArray(schools)) {
        schools.slice(0, 3).forEach(s => {
            const div = document.createElement('div');
            div.className = "bg-black p-3 border border-gray-900 rounded shadow-inner";
            div.innerHTML = `
                <div class='text-[9px] text-blue-400 font-black uppercase truncate'>${s.school_name}</div>
                <div class='text-[11px] text-white font-bold mt-1'>${s.ofsted_rating || 'NOT_RATED'}</div>
                <div class='text-[9px] text-gray-600 uppercase tracking-tighter'>${s.school_type || 'SCHOOL'} • AGES ${s.age_range || '??'}</div>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = "<div class='text-gray-800 text-[10px] p-2 italic'>DATA_SHIELD_ACTIVE: NO_LOCAL_SCHOOLS</div>";
    }
}

// Ensure handleDiscovery and searchByPostcode are still present in your file
