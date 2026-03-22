/**
 * £Per | Property Audit Engine - v11.4
 * Logic: Independent Module Loading (Anti-Crash)
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/"; 

async function initiateFinalAudit(epcRecord) {
    updateStatus("STARTING MULTI-POINT AUDIT...", "loading");
    
    // 1. Reveal Dashboard Immediately (even if empty)
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('displayAddress').innerText = epcRecord?.address?.toUpperCase() || "MANUAL SEARCH";
    document.getElementById('displayUprn').innerText = epcRecord?.uprn || "N/A";
    document.getElementById('epcBadge').innerText = epcRecord?.['current-energy-rating'] || "?";

    const pc = epcRecord?.postcode || document.getElementById('mainInput').value.trim();
    const cleanPc = pc.replace(/\s/g, '');
    const formattedPc = pc.includes(' ') ? pc : pc.slice(0, -3) + ' ' + pc.slice(-3);

    // 2. Load Market Data (Independent)
    loadMarketData(formattedPc);

    // 3. Load Environmental Data (Independent)
    loadEnvData(cleanPc);

    // 4. Load Geo/School Context (Independent)
    loadGeoData(cleanPc);

    updateStatus("AUDIT STREAMING...", "success");
}

async function loadMarketData(pc) {
    const marketBody = document.getElementById('marketBody');
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(pc)}&_limit=25`)}`);
        const data = await res.json();
        const items = data?.result?.items || [];
        
        marketBody.innerHTML = "";
        if (items.length > 0) {
            items.sort((a,b) => new Date(b.latestTransaction.date) - new Date(a.latestTransaction.date));
            let total = 0;
            items.slice(0, 5).forEach(s => {
                total += s.latestTransaction.pricePaid;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="p-4 text-gray-500">${s.latestTransaction.date}</td>
                    <td class="p-4 text-white font-medium">${s.paon || ''} ${s.street || ''}</td>
                    <td class="p-4 uppercase text-gray-500 text-[9px]">${s.propertyType?.label || 'UNIT'}</td>
                    <td class="p-4 font-bold text-green-500">£${s.latestTransaction.pricePaid.toLocaleString()}</td>
                `;
                marketBody.appendChild(row);
            });
            document.getElementById('valMetric').innerText = `AVG: £${Math.round(total/Math.min(items.length,5)).toLocaleString()}`;
        } else {
            marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-gray-700 font-mono'>NO MARKET RECORDS</td></tr>";
        }
    } catch (e) {
        marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-red-900 font-mono text-[9px]'>MARKET_API_OFFLINE</td></tr>";
    }
}

async function loadEnvData(pc) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://environment.data.gov.uk/flood-monitoring/id/stations?postcode=${pc}`)}`);
        const data = await res.json();
        const isRisk = data?.items?.length > 0;
        const el = document.getElementById('floodStatus');
        el.innerText = isRisk ? "MONITORING_ACTIVE" : "NEGATIVE";
        el.className = isRisk ? "indicator-red" : "indicator-green";
    } catch (e) {
        document.getElementById('floodStatus').innerText = "ERROR";
    }
}

async function loadGeoData(pc) {
    const container = document.getElementById('schoolList');
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(`https://api.getthedata.com/postcode/${pc}`)}`);
        const geo = await res.json();
        if (geo?.data) {
            container.innerHTML = "";
            const points = [
                { k: "CONSTITUENCY", v: geo.data.parliamentary_constituency },
                { k: "DISTRICT", v: geo.data.admin_district },
                { k: "WARD", v: geo.data.admin_ward }
            ];
            points.forEach(p => {
                const div = document.createElement('div');
                div.className = "bg-black p-3 border border-gray-900 rounded";
                div.innerHTML = `<div class="text-[9px] text-gray-500 uppercase font-black">${p.k}</div><div class="text-[11px] text-white font-bold mt-1">${p.v || 'N/A'}</div>`;
                container.appendChild(div);
            });
        }
    } catch (e) {
        container.innerHTML = "<div class='text-gray-800 text-[10px] uppercase'>GEO_API_OFFLINE</div>";
    }
}

// Ensure handleDiscovery handles EPC failure without crashing
async function handleDiscovery() {
    const input = document.getElementById('mainInput').value.trim();
    document.getElementById('addressSelectorContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    if (/^\d{1,12}$/.test(input)) {
        await fetchByUprn(input);
    } else if (input.match(/[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/i)) {
        const pc = input.match(/[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/i)[0].toUpperCase().replace(/\s/g, '');
        // FALLBACK: We start the audit with just the postcode if the EPC search fails
        try {
            updateStatus("EPC_SEARCH...", "loading");
            const target = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc}`;
            const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(target)}`);
            const data = await res.json();
            
            if (data?.rows?.length > 0) {
                currentEpcRows = data.rows;
                renderAddressList(currentEpcRows);
            } else {
                throw new Error("EPC_EMPTY");
            }
        } catch (e) {
            updateStatus("EPC_MISSING - LOADING MARKET ONLY", "error");
            // If EPC fails, we bypass the dropdown and load the dashboard with just the postcode
            initiateFinalAudit({ postcode: pc, address: "Unknown Property", uprn: "N/A" });
        }
    }
}
