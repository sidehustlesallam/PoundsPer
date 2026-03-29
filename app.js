/**
 * £Per Audit Engine v11.18
 * - Optimized for Specialist Worker Modules: PPI (SPARQL) & Schools (Ofsted Scrape)
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

// --- UI HELPERS ---
function updateStatus(msg, type) {
    const text = document.getElementById("statusText");
    const dot = document.getElementById("statusDot");
    if (text) text.innerText = msg.toUpperCase();
    if (!dot) return;

    let cls = "w-1.5 h-1.5 rounded-full ";
    if (type === "loading") cls += "bg-blue-500 animate-pulse";
    else if (type === "error") cls += "bg-red-600";
    else cls += "bg-green-500 shadow-[0_0_8px_green]";
    dot.className = cls;
}

function setEpcState(state, meta = "") {
    const badge = document.getElementById("epcBadge");
    const metaEl = document.getElementById("epcMeta");
    if (!badge) return;

    badge.classList.remove("bg-red-500", "animate-pulse");

    if (state === "pending") {
        badge.classList.add("animate-pulse");
        badge.innerText = "?";
    } else if (state === "error") {
        badge.classList.add("bg-red-500");
        badge.innerText = "!";
    }
}

// --- GENERIC PROXY FETCH ---
async function safeFetch(url) {
    try {
        const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
        const text = await res.text();
        // Guard against empty/HTML responses crashing JSON.parse
        if (!text || text.startsWith("<!DOCTYPE")) return { error: "INVALID_RESPONSE" };
        return JSON.parse(text);
    } catch (e) {
        return { error: "NETWORK_EXCEPTION", message: e.message };
    }
}

// --- EPC MODULES ---
function normalizeEpc(epcRaw) {
    const epc = epcRaw || {};
    const area = parseFloat(epc["total-floor-area"]) || 0;
    return {
        address: (epc.address || "").toString(),
        uprn: epc.uprn || "N/A",
        postcode: (epc.postcode || "").toString(),
        area,
        rating: epc["current-energy-rating"] || "?",
    };
}

// --- SCHOOLS MODULE (Specialist Worker Route) ---
async function loadSchoolsFromOfsted(cleanPostcode) {
    const container = document.getElementById("schoolList");
    if (!container) return;
    container.innerHTML = "<div class='text-[10px] animate-pulse'>SCRAPING_OFSTED_DATA...</div>";

    try {
        const res = await fetch(`${PROXY_URL}?schools=1&postcode=${encodeURIComponent(cleanPostcode)}`);
        const data = await res.json();
        container.innerHTML = "";

        if (data.schools && data.schools.length > 0) {
            data.schools.slice(0, 3).forEach((s) => {
                const div = document.createElement("div");
                div.className = "bg-black p-3 border border-gray-900 rounded mb-2";
                div.innerHTML = `
                    <div class='text-[9px] text-blue-400 font-black uppercase'>${s.name}</div>
                    <div class='text-[11px] text-white font-bold mt-1'>${s.rating || "NOT_RATED"}</div>
                    <div class='text-[9px] text-gray-500 mt-1'>${s.category} • ${s.distance_text || ''}</div>
                `;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = "<div class='text-gray-600 text-[10px]'>NO_LOCAL_SCHOOLS_FOUND</div>";
        }
    } catch (e) {
        container.innerHTML = "<div class='text-red-500 text-[10px]'>SCHOOLS_OFFLINE</div>";
    }
}

// --- MARKET DATA (Specialist SPARQL Route) ---
async function loadMarketData(pc) {
    const marketBody = document.getElementById("marketBody");
    const valMetric = document.getElementById("valMetric");
    if (marketBody) marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center animate-pulse text-[10px]'>QUERYING_SPARQL...</td></tr>";

    try {
        const res = await fetch(`${PROXY_URL}?ppi=1&postcode=${encodeURIComponent(pc)}`);
        const data = await res.json();
        if (!marketBody) return;
        marketBody.innerHTML = "";

        const txs = data.transactions || [];
        if (txs.length > 0) {
            txs.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach((t) => {
                const row = document.createElement("tr");
                const addr = `${t.paon || ""} ${t.street || ""}`.trim();
                row.innerHTML = `
                    <td class='p-4 text-gray-500 text-[10px]'>${t.date.split('T')[0]}</td>
                    <td class='p-4 text-white font-medium text-[10px]'>${addr}</td>
                    <td class='p-4 text-green-500 font-bold text-[10px]'>£${t.amount.toLocaleString()}</td>
                `;
                marketBody.appendChild(row);
            });
            const avg = txs.reduce((acc, curr) => acc + curr.amount, 0) / txs.length;
            if (valMetric) valMetric.innerText = `£${Math.round(avg).toLocaleString()}`;
        } else {
            marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-gray-700 text-[10px]'>NO_PPI_DATA</td></tr>";
        }
    } catch (e) {
        if (marketBody) marketBody.innerHTML = "<tr><td colspan='4' class='p-4 text-center text-red-500'>PPI_ERROR</td></tr>";
    }
}

// --- FINAL AUDIT ---
async function initiateFinalAudit(epcRaw) {
    document.getElementById("dashboard").classList.remove("hidden");
    const epc = normalizeEpc(epcRaw);

    document.getElementById("displayAddress").innerText = epc.address.toUpperCase();
    document.getElementById("displayUprn").innerText = epc.uprn;
    document.getElementById("epcBadge").innerText = epc.rating;

    const sqftMetric = document.getElementById("sqftMetric");
    sqftMetric.innerText = epc.area > 0 ? `${Math.round(epc.area * 10.764)} SQFT (${epc.area}m²)` : "N/A";

    const cleanPc = epc.postcode.replace(/\s+/g, "").toUpperCase();
    updateStatus("AUDIT_ACTIVE", "loading");

    await Promise.all([
        loadMarketData(epc.postcode),
        loadSchoolsFromOfsted(cleanPc)
    ]);

    updateStatus("AUDIT_COMPLETE", "success");
}

// --- DISCOVERY LOGIC ---
window.handleDiscovery = async function() {
    const input = document.getElementById("mainInput").value.trim();
    if (!input) return updateStatus("INPUT_REQUIRED", "error");

    // Clear previous
    document.getElementById("addressSelectorContainer").classList.add("hidden");

    if (/^\d{6,12}$/.test(input)) {
        updateStatus("UPRN_LOOKUP", "loading");
        const data = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${input}`);
        if (data?.rows?.length > 0) initiateFinalAudit(data.rows[0]);
        else updateStatus("UPRN_NOT_FOUND", "error");
    } 
    else if (/[A-Z]{1,2}\d/i.test(input)) {
        const pcMatch = input.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
        if (!pcMatch) return updateStatus("INVALID_POSTCODE", "error");
        
        updateStatus("POSTCODE_SCAN", "loading");
        const pc = pcMatch[0].toUpperCase();
        const data = await safeFetch(`https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(/\s/g,'')}`);
        
        if (data?.rows?.length > 0) {
            window.__EPC_ROWS__ = data.rows;
            const container = document.getElementById("addressSelectorContainer");
            const dropdown = document.getElementById("addressDropdown");
            dropdown.innerHTML = "<option value=''>-- SELECT PROPERTY --</option>";
            data.rows.forEach((r, i) => {
                const opt = document.createElement("option");
                opt.value = i; opt.textContent = r.address;
                dropdown.appendChild(opt);
            });
            container.classList.remove("hidden");
            updateStatus("CHOOSE_ADDRESS", "success");
        } else {
            updateStatus("NO_DATA", "error");
        }
    }
};

window.selectAddress = function() {
    const idx = document.getElementById("addressDropdown").value;
    if (idx === "" || !window.__EPC_ROWS__) return;
    document.getElementById("addressSelectorContainer").classList.add("hidden");
    initiateFinalAudit(window.__EPC_ROWS__[idx]);
};
