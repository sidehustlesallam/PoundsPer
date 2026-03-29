const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

window.handleDiscovery = async function() {
    const input = document.getElementById("mainInput").value.trim();
    if (!input) return;
    document.getElementById("addressSelectorContainer").classList.add("hidden");
    updateStatus("SCANNING_ASSET", "loading");

    const pcMatch = input.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    if (pcMatch) {
        const pc = pcMatch[0].toUpperCase();
        const data = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g,'')}`);
        if (data?.rows?.length > 0) {
            window.__EPC_ROWS__ = data.rows;
            const dropdown = document.getElementById("addressDropdown");
            dropdown.innerHTML = "<option value=''>-- SELECT PROPERTY --</option>";
            data.rows.forEach((r, i) => {
                const opt = document.createElement("option");
                opt.value = i; opt.textContent = r.address;
                dropdown.appendChild(opt);
            });
            document.getElementById("addressSelectorContainer").classList.remove("hidden");
        }
    }
};

window.selectAddress = function() {
    const idx = document.getElementById("addressDropdown").value;
    if (idx !== "") initiateFinalAudit(window.__EPC_ROWS__[idx]);
};

async function initiateFinalAudit(epc) {
    document.getElementById("dashboard").classList.remove("hidden");
    const m2 = parseFloat(epc["total-floor-area"]) || 0;
    const sqftStr = m2 > 0 ? `${Math.round(m2 * 10.764)} SQFT` : "N/A";

    document.getElementById("displayAddress").innerText = epc.address.toUpperCase();
    document.getElementById("displayUprn").innerText = epc.uprn;
    document.getElementById("epcBadge").innerText = epc["current-energy-rating"] || "?";
    document.getElementById("sqftMetric").innerText = sqftStr;

    updateStatus("AUDIT_COMPLETE", "success");
    loadMarketData(epc.postcode, sqftStr, epc.address);
    loadSchools(epc.postcode.replace(/\s/g,''));
}

async function loadMarketData(pc, sqftLabel, currentAddr) {
    const body = document.getElementById("marketBody");
    body.innerHTML = "<tr><td colspan='4' class='p-8 text-center animate-pulse'>LOADING_10_PROPERTY_HISTORY...</td></tr>";

    const res = await fetch(`${PROXY_URL}?ppi=1&postcode=${encodeURIComponent(pc)}`);
    const data = await res.json();
    body.innerHTML = "";

    (data.transactions || []).forEach(t => {
        const row = document.createElement("tr");
        const fullAddr = `${t.paon} ${t.street}`.toUpperCase();
        // Check if this sale row matches the property we are auditing
        const isTarget = currentAddr.toUpperCase().includes(t.paon.toUpperCase());
        
        row.className = "border-b border-gray-900/50 hover:bg-white/5 transition-all";
        row.innerHTML = `
            <td class='p-4 text-gray-500'>${t.date.split('T')[0]}</td>
            <td class='p-4 text-white'>${fullAddr}</td>
            <td class='p-4 text-center'>${isTarget ? `<span class='text-blue-500 font-bold'>${sqftLabel}</span>` : `<span class='text-gray-700 text-[9px]'>MATCH_REQUIRED</span>`}</td>
            <td class='p-4 text-right text-green-500 font-bold'>£${t.amount.toLocaleString()}</td>
        `;
        body.appendChild(row);
    });
}

async function loadSchools(pc) {
    const container = document.getElementById("schoolList");
    container.innerHTML = "<div class='p-2 animate-pulse'>FETCHING_OFSTED...</div>";
    const res = await fetch(`${PROXY_URL}?schools=1&postcode=${pc}`);
    const data = await res.json();
    container.innerHTML = "";

    (data.schools || []).slice(0, 3).forEach(s => {
        const div = document.createElement("div");
        div.className = "bg-black p-4 border border-gray-900 rounded";
        // Color coding for ratings
        const color = s.rating.includes("Outstanding") ? "text-green-400" : s.rating.includes("Good") ? "text-yellow-400" : "text-white";
        div.innerHTML = `<div class='text-[9px] text-blue-500 font-black'>${s.name}</div>
                         <div class='${color} text-[11px] font-bold mt-1'>${s.rating}</div>
                         <div class='text-gray-500 text-[9px] mt-1 uppercase'>${s.category} • ${s.distance_text}</div>`;
        container.appendChild(div);
    });
}

async function safeFetch(url) {
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    return await res.json();
}

function updateStatus(msg, type) {
    document.getElementById("statusText").innerText = msg.toUpperCase();
    document.getElementById("statusDot").className = `w-1.5 h-1.5 rounded-full ${type === 'loading' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`;
}
