/**
 * £Per Audit Engine v11.17
 * - EPC via Worker proxy
 * - Schools via Ofsted scrape
 * - PPI via Land Registry SPARQL (Worker ?ppi=1&postcode=...)
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

// ------------------------------------------------------------
//  UI HELPERS
// ------------------------------------------------------------

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

  badge.classList.remove("epc-error", "epc-pending");

  if (state === "pending") {
    badge.classList.add("epc-pending");
    badge.innerText = "?";
    if (metaEl) metaEl.innerText = meta || "EPC_Query_Active";
  } else if (state === "error") {
    badge.classList.add("epc-error");
    badge.innerText = "!";
    if (metaEl) metaEl.innerText = meta || "EPC_Failed";
  } else if (state === "ok") {
    if (metaEl) metaEl.innerText = meta || "EPC_Resolved";
  }
}

// ------------------------------------------------------------
//  GENERIC PROXY FETCH (EPC / legacy)
// ------------------------------------------------------------

async function safeFetch(url) {
  try {
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    const data = await res.json().catch(() => null);

    if (!res.ok) return { error: `HTTP_${res.status}`, raw: data };
    if (data && data.error) return data;

    return data;
  } catch (e) {
    return { error: "NETWORK_EXCEPTION", message: e.message };
  }
}

// ------------------------------------------------------------
//  EPC FETCH
// ------------------------------------------------------------

async function fetchEpcByPostcode(pc) {
  const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(pc)}`;
  return await safeFetch(url);
}

async function fetchEpcByUprn(uprn) {
  const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${encodeURIComponent(uprn)}`;
  return await safeFetch(url);
}

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

// ------------------------------------------------------------
//  SCHOOLS MODULE — LIVE OFSTED SCRAPE VIA WORKER
// ------------------------------------------------------------

async function loadSchoolsFromOfsted(cleanPostcode) {
  const container = document.getElementById("schoolList");
  if (!container) return;

  container.innerHTML =
    "<div class='text-[10px] animate-pulse'>RESOLVING_NEAREST_SCHOOLS...</div>";

  try {
    const res = await fetch(
      `${PROXY_URL}?schools=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );
    const data = await res.json().catch(() => null);

    container.innerHTML = "";

    if (!res.ok || !data || data.error) {
      container.innerHTML =
        "<div class='text-red-500 text-[10px] p-2 uppercase'>SCHOOLS_MODULE_ERROR</div>";
      return data || { error: "SCHOOLS_MODULE_ERROR" };
    }

    const schools = Array.isArray(data.schools) ? data.schools : [];

    if (schools.length === 0) {
      container.innerHTML =
        "<div class='text-gray-500 text-[10px] p-2 italic'>NO_NEARBY_SCHOOLS_FOUND</div>";
      return { schools: [] };
    }

    schools.slice(0, 3).forEach((s) => {
      const div = document.createElement("div");
      div.className = "bg-black p-3 border border-gray-900 rounded shadow-inner";

      const distanceLabel =
        typeof s.distance_km === "number"
          ? `${s.distance_km.toFixed(1)}km`
          : s.distance_text || "DIST N/A";

      div.innerHTML = `
        <div class='text-[9px] text-blue-400 font-black uppercase truncate'>${s.name}</div>
        <div class='text-[11px] text-white font-bold mt-1'>${s.rating || "NOT_RATED"}</div>
        <div class='text-[9px] text-gray-500 uppercase tracking-tighter'>
          ${s.category || "SCHOOL"} • ${distanceLabel}
        </div>
        <div class='text-[9px] text-gray-600'>
          Latest report: ${s.latest_report || "N/A"} • URN: ${s.urn || "N/A"}
        </div>
      `;
      container.appendChild(div);
    });

    return data;
  } catch (e) {
    container.innerHTML =
      "<div class='text-red-500 text-[10px] p-2 uppercase'>SCHOOLS_MODULE_EXCEPTION</div>";
    return { error: "SCHOOLS_MODULE_EXCEPTION", message: e.message };
  }
}

// ------------------------------------------------------------
//  LAND REGISTRY PPI MODULE — VIA SPARQL (WORKER ?ppi=1)
// ------------------------------------------------------------

async function loadMarketData(pc) {
  const marketBody = document.getElementById("marketBody");
  const valMetric = document.getElementById("valMetric");

  if (marketBody) {
    marketBody.innerHTML =
      "<tr><td colspan='4' class='p-4 text-center animate-pulse'>ACCESSING_LAND_REGISTRY...</td></tr>";
  }

  try {
    const res = await fetch(
      `${PROXY_URL}?ppi=1&postcode=${encodeURIComponent(pc)}`
    );
    const data = await res.json().catch(() => null);

    if (!marketBody || !valMetric) return data;

    marketBody.innerHTML = "";

    if (!res.ok || !data || data.error) {
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-red-500 text-[10px]'>PPI_MODULE_ERROR</td></tr>";
      valMetric.innerText = "N/A";
      return data || { error: "PPI_MODULE_ERROR" };
    }

    const txs = Array.isArray(data.transactions) ? data.transactions : [];

    if (txs.length === 0) {
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-gray-700'>NO_PPI_DATA</td></tr>";
      valMetric.innerText = "N/A";
      return { transactions: [] };
    }

    txs
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .forEach((t) => {
        const row = document.createElement("tr");
        const addr = `${t.paon || ""} ${t.saon || ""} ${t.street || ""}`.trim();
        row.innerHTML = `
          <td class='p-4 text-gray-500'>${t.date || ""}</td>
          <td class='p-4 text-white font-medium'>${addr}</td>
          <td class='p-4 text-[9px] uppercase'>${t.category || "STANDARD"}</td>
          <td class='p-4 text-green-500 font-bold'>£${(t.amount || 0).toLocaleString()}</td>
        `;
        marketBody.appendChild(row);
      });

    const avg =
      txs.reduce((acc, curr) => acc + (curr.amount || 0), 0) /
      (txs.length || 1);
    valMetric.innerText = `£${Math.round(avg).toLocaleString()}`;

    return data;
  } catch (e) {
    if (marketBody) {
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-red-500 text-[10px]'>PPI_MODULE_EXCEPTION</td></tr>";
    }
    if (valMetric) valMetric.innerText = "N/A";
    return { error: "PPI_MODULE_EXCEPTION", message: e.message };
  }
}

// ------------------------------------------------------------
//  FINAL AUDIT ENGINE
// ------------------------------------------------------------

async function initiateFinalAudit(epcRaw) {
  document.getElementById("dashboard").classList.remove("hidden");
  setEpcState("pending", "EPC_Normalizing");

  const epc = normalizeEpc(epcRaw);

  document.getElementById("displayAddress").innerText =
    epc.address.toUpperCase();
  document.getElementById("displayUprn").innerText = epc.uprn;
  document.getElementById("epcBadge").innerText = epc.rating;

  const sqftMetric = document.getElementById("sqftMetric");
  if (epc.area > 0) {
    sqftMetric.innerText = `${Math.round(epc.area * 10.764)} SQFT (${epc.area}m²)`;
  } else {
    sqftMetric.innerText = "N/A";
  }

  const cleanPc = epc.postcode.replace(/\s+/g, "").toUpperCase();
  const spacedPc =
    cleanPc.length > 3
      ? cleanPc.slice(0, -3) + " " + cleanPc.slice(-3)
      : cleanPc;

  updateStatus("AUDIT_RUNNING", "loading");

  const results = await Promise.allSettled([
    loadMarketData(spacedPc),
    loadSchoolsFromOfsted(cleanPc),
  ]);

  const hadError = results.some(
    (r) => r.status === "rejected" || (r.value && r.value.error)
  );

  if (hadError) {
    updateStatus("AUDIT_COMPLETE_WITH_WARNINGS", "error");
    setEpcState("ok", "Modules_Partial");
  } else {
    updateStatus("AUDIT_COMPLETE", "success");
    setEpcState("ok", "All_Modules_Resolved");
  }
}

// ------------------------------------------------------------
//  DISCOVERY FLOWS
// ------------------------------------------------------------

async function discoverByPostcode(pc) {
  updateStatus("POSTCODE_LOOKUP", "loading");

  const data = await fetchEpcByPostcode(pc);

  if (!data || !data.rows || data.rows.length === 0) {
    updateStatus("NO_EPC_FOR_POSTCODE", "error");
    return;
  }

  const addresses = data.rows;
  const container = document.getElementById("addressSelectorContainer");
  const dropdown = document.getElementById("addressDropdown");

  dropdown.innerHTML = "";
  container.classList.remove("hidden");

  addresses.forEach((row, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = row.address;
    dropdown.appendChild(opt);
  });

  window.__EPC_ROWS__ = addresses;

  updateStatus("SELECT_ADDRESS", "success");
}

async function discoverByUprn(uprn) {
  updateStatus("UPRN_LOOKUP", "loading");

  const data = await fetchEpcByUprn(uprn);

  if (!data || !data.rows || data.rows.length === 0) {
    updateStatus("NO_EPC_FOR_UPRN", "error");
    return;
  }

  const epc = data.rows[0];

  updateStatus("EPC_RESOLVED", "success");
  await initiateFinalAudit(epc);
}

async function handleDiscovery() {
  const inputEl = document.getElementById("mainInput");
  const input = (inputEl?.value || "").trim();

  if (!input) {
    updateStatus("INPUT_REQUIRED", "error");
    return;
  }

  if (/^\d{6,12}$/.test(input)) {
    return discoverByUprn(input);
  }

  if (/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(input)) {
    const cleanPc = input.replace(/\s+/g, "").toUpperCase();
    const spacedPc = cleanPc.slice(0, -3) + " " + cleanPc.slice(-3);
    return discoverByPostcode(spacedPc);
  }

  if (input.includes("zoopla.co.uk")) {
    updateStatus("ZOOPLA_SCRAPE", "loading");
    const data = await safeFetch(input);

    if (data?.extractedUprn) {
      return discoverByUprn(data.extractedUprn);
    }

    updateStatus("NO_UPRN_FOUND", "error");
    return;
  }

  updateStatus("UNRECOGNISED_INPUT", "error");
}

function selectAddress() {
  const dropdown = document.getElementById("addressDropdown");
  const idx = dropdown ? dropdown.value : null;
  const rows = window.__EPC_ROWS__ || [];

  if (idx === null || !rows[idx]) {
    updateStatus("INVALID_SELECTION", "error");
    return;
  }

  const epc = rows[idx];
  document.getElementById("addressSelectorContainer").classList.add("hidden");

  initiateFinalAudit(epc);
}
