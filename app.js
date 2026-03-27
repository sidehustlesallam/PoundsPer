/**
 * £Per Audit Engine v11.9
 * Hardened:
 * - Structured error handling
 * - Promise.allSettled for module isolation
 * - EPC safety wrapper
 * - Multi-format postcode routing
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

// --- STATUS & UI HELPERS ---

function updateStatus(msg, type) {
  const text = document.getElementById("statusText");
  const dot = document.getElementById("statusDot");
  if (text) text.innerText = msg.toUpperCase();

  if (!dot) return;

  let cls = "w-1.5 h-1.5 rounded-full ";
  if (type === "loading") {
    cls += "bg-blue-500 animate-pulse";
  } else if (type === "error") {
    cls += "bg-red-600";
  } else {
    cls += "bg-green-500 shadow-[0_0_8px_green]";
  }
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

// --- NETWORK LAYER ---

async function safeFetch(url) {
  console.log(`%c SCANNING: ${url}`, "color: #3b82f6; font-weight: bold;");
  try {
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("HTTP error:", res.status, data);
      return { error: `HTTP_${res.status}`, raw: data };
    }

    // Worker may still return structured error with 200
    if (data && data.error) {
      console.warn("Upstream logical error:", data);
      return data;
    }

    return data;
  } catch (e) {
    console.error(`Audit Failure for ${url}:`, e);
    return { error: "NETWORK_EXCEPTION", message: e.message };
  }
}

// --- EPC SAFETY WRAPPER (placeholder EPC object) ---

function normalizeEpc(epcRaw) {
  const epc = epcRaw || {};
  const area = parseFloat(epc["total-floor-area"]) || 0;

  return {
    address: (epc.address || "").toString() || "UNKNOWN_ADDRESS",
    uprn: epc.uprn || "N/A",
    postcode: (epc.postcode || "").toString(),
    area,
    rating: epc["current-energy-rating"] || "?",
  };
}

// --- CORE AUDIT ENGINE ---

async function initiateFinalAudit(epcRaw) {
  document.getElementById("dashboard").classList.remove("hidden");
  setEpcState("pending", "EPC_Normalizing");

  const epc = normalizeEpc(epcRaw);

  // 1. SET SUBJECT METRICS
  const addressEl = document.getElementById("displayAddress");
  const uprnEl = document.getElementById("displayUprn");
  const epcBadge = document.getElementById("epcBadge");
  const sqftMetric = document.getElementById("sqftMetric");

  if (addressEl) addressEl.innerText = epc.address.toUpperCase();
  if (uprnEl) uprnEl.innerText = epc.uprn || "N/A";
  if (epcBadge) epcBadge.innerText = epc.rating || "?";

  if (sqftMetric) {
    if (epc.area > 0) {
      sqftMetric.innerText = `${Math.round(epc.area * 10.764)} SQFT (${epc.area}m²)`;
    } else {
      sqftMetric.innerText = "N/A";
    }
  }

  // 2. POSTCODE NORMALIZATION
  let rawPc = epc.postcode || "";
  let cleanPc = rawPc.replace(/\s+/g, "").toUpperCase(); // SW1A1AA
  let spacedPc =
    cleanPc.length > 3
      ? cleanPc.slice(0, -3) + " " + cleanPc.slice(-3)
      : cleanPc; // SW1A 1AA
  let outwardPc = spacedPc.split(" ")[0] || cleanPc; // SW1A

  console.log(
    `Normalized Postcodes: Clean[${cleanPc}] Spaced[${spacedPc}] Outward[${outwardPc}]`
  );

  // 3. FIRE MODULES (isolated via allSettled)
  updateStatus("AUDIT_RUNNING", "loading");

  const results = await Promise.allSettled([
    loadMarketData(spacedPc),
    loadSchoolsData(cleanPc),
    // future: loadFloodData(outwardPc), loadRadonData(outwardPc), etc.
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

// --- MODULE: LAND REGISTRY PPI ---

async function loadMarketData(pc) {
  const marketBody = document.getElementById("marketBody");
  const valMetric = document.getElementById("valMetric");

  if (marketBody) {
    marketBody.innerHTML =
      "<tr><td colspan='4' class='p-4 text-center animate-pulse'>ACCESSING_LAND_REGISTRY...</td></tr>";
  }

  const url = `https://landregistry.data.gov.uk/data/ppi/address.json?postcode=${encodeURIComponent(
    pc
  )}&_limit=10`;
  const data = await safeFetch(url);

  if (!marketBody || !valMetric) return data;

  marketBody.innerHTML = "";

  if (data && !data.error) {
    const items = data?.result?.items || [];

    if (items.length > 0) {
      items
        .sort(
          (a, b) =>
            new Date(b.latestTransaction.date) -
            new Date(a.latestTransaction.date)
        )
        .slice(0, 5)
        .forEach((s) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td class='p-4 text-gray-500'>${s.latestTransaction.date}</td>
            <td class='p-4 text-white font-medium'>${s.paon || ""} ${
            s.street || ""
          }</td>
            <td class='p-4 text-[9px] uppercase'>${
              s.propertyType?.label || "UNIT"
            }</td>
            <td class='p-4 text-green-500 font-bold'>£${(
              s.latestTransaction.pricePaid || 0
            ).toLocaleString()}</td>
          `;
          marketBody.appendChild(row);
        });

      const avg =
        items.reduce(
          (acc, curr) => acc + (curr.latestTransaction.pricePaid || 0),
          0
        ) / items.length;
      valMetric.innerText = `£${Math.round(avg).toLocaleString()}`;
    } else {
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-gray-700'>NO_RECENT_PPI_DATA</td></tr>";
      valMetric.innerText = "N/A";
    }
  } else {
    console.warn("PPI module error:", data);
    marketBody.innerHTML =
      "<tr><td colspan='4' class='p-4 text-center text-red-500 text-[10px]'>PPI_MODULE_ERROR</td></tr>";
    valMetric.innerText = "N/A";
  }

  return data;
}

// --- MODULE: SCHOOLS DATA ---

async function loadSchoolsData(pc) {
  const container = document.getElementById("schoolList");
  if (!container) return;

  container.innerHTML =
    "<div class='text-[10px] animate-pulse'>POLLING_OFSTED...</div>";

  const url = `https://api.getthedata.com/schools/postcode/${pc}`;
  const data = await safeFetch(url);

  container.innerHTML = "";

  if (data && !data.error && Array.isArray(data.data) && data.data.length > 0) {
    const schools = data.data;
    schools.slice(0, 3).forEach((s) => {
      const div = document.createElement("div");
      div.className = "bg-black p-3 border border-gray-900 rounded shadow-inner";
      div.innerHTML = `
        <div class='text-[9px] text-blue-400 font-black uppercase truncate'>${
          s.school_name
        }</div>
        <div class='text-[11px] text-white font-bold mt-1'>${
          s.ofsted_rating || "NOT_RATED"
        }</div>
        <div class='text-[9px] text-gray-600 uppercase tracking-tighter'>${
          s.school_type || "SCHOOL"
        } • AGES ${s.age_range || "??"}</div>
      `;
      container.appendChild(div);
    });
  } else if (data && !data.error) {
    container.innerHTML =
      "<div class='text-gray-800 text-[10px] p-2 italic'>DATA_SHIELD_ACTIVE: NO_LOCAL_SCHOOLS</div>";
  } else {
    console.warn("Schools module error:", data);
    container.innerHTML =
      "<div class='text-red-500 text-[10px] p-2 uppercase'>SCHOOLS_MODULE_ERROR</div>";
  }

  return data;
}

// --- DISCOVERY ENTRYPOINTS (STUBS) ---

// You can wire these to Zoopla / EPC / UPRN flows as before.
// For now, we keep a minimal placeholder so v11.9 is drop-in compatible.

async function handleDiscovery() {
  const input = document.getElementById("mainInput");
  const value = (input?.value || "").trim();

  if (!value) {
    updateStatus("INPUT_REQUIRED", "error");
    return;
  }

  updateStatus("DISCOVERY_RUNNING", "loading");
  setEpcState("pending", "Awaiting_EPC_Source");

  // For now, treat input as "we already have an EPC-like object"
  // In your real flow, you’d:
  // - detect Zoopla URL -> call Worker -> get UPRN -> EPC API
  // - detect postcode -> EPC search
  // - detect UPRN -> direct EPC lookup
  const mockEpc = {
    address: value,
    uprn: "SIMULATED_UPRN",
    postcode: "SW1A 1AA",
    "total-floor-area": 80,
    "current-energy-rating": "C",
  };

  await initiateFinalAudit(mockEpc);
}

function selectAddress() {
  // Placeholder for multi-address selection logic
  // Keep function defined to avoid breaking existing references
  console.log("selectAddress() invoked - implement address selection logic.");
}
