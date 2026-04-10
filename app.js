/**
 * £Per Audit Engine v12.0
 * - Specialist Worker Modules: PPI (SPARQL), Schools (Ofsted), Flood, Radon
 * - MapLibre spatial layer
 * - Blueprint-style UI
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

// --- GLOBAL STATE ---
window.__PER_STATE__ = {
  epc: null,
  schools: [],
  ppi: [],
  flood: null,
  radon: null,
  map: null,
  mapLayers: {
    epc: null,
    schools: null,
    ppi: null,
    flood: null,
    radon: null,
  },
  activeLayers: {
    epc: true,
    schools: true,
    ppi: true,
    flood: true,
    radon: true,
  },
};

// --- UI HELPERS ---
function updateStatus(msg, type) {
  const text = document.getElementById("statusText");
  const dot = document.getElementById("statusDot");
  if (text) text.innerText = msg.toUpperCase();
  if (!dot) return;

  let cls = "w-1.5 h-1.5 rounded-full ";
  if (type === "loading") cls += "bg-sky-400 animate-pulse";
  else if (type === "error") cls += "bg-red-600 shadow-[0_0_8px_rgba(248,113,113,0.8)]";
  else cls += "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]";
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
    if (metaEl) metaEl.innerText = "EPC_QUERY_ACTIVE";
  } else if (state === "error") {
    badge.classList.add("bg-red-500");
    badge.innerText = "!";
    if (metaEl) metaEl.innerText = meta || "EPC_ERROR";
  } else if (state === "ready") {
    if (metaEl && meta) metaEl.innerText = meta;
  }
}

// --- GENERIC PROXY FETCH ---
async function safeFetch(url) {
  try {
    const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    const text = await res.text();
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
  const lat = parseFloat(epc.latitude || epc["latitude"]) || null;
  const lon = parseFloat(epc.longitude || epc["longitude"]) || null;

  return {
    address: (epc.address || "").toString(),
    uprn: epc.uprn || "N/A",
    postcode: (epc.postcode || "").toString(),
    area,
    rating: epc["current-energy-rating"] || "?",
    latitude: lat,
    longitude: lon,
  };
}

// --- SCHOOLS MODULE (Worker Route) ---
async function loadSchoolsFromOfsted(cleanPostcode) {
  const container = document.getElementById("schoolList");
  if (!container) return;
  container.innerHTML = "<div class='text-[10px] animate-pulse text-sky-400'>SCRAPING_OFSTED_DATA...</div>";

  try {
    const res = await fetch(`${PROXY_URL}?schools=1&postcode=${encodeURIComponent(cleanPostcode)}`);
    const data = await res.json();
    container.innerHTML = "";

    const schools = data.schools || [];
    window.__PER_STATE__.schools = schools;

    if (schools.length > 0) {
      schools.slice(0, 3).forEach((s) => {
        const div = document.createElement("div");
        div.className = "bg-black/80 p-3 border border-sky-900/40 rounded-sm";
        div.innerHTML = `
          <div class='text-[9px] text-sky-400 font-black uppercase tracking-[0.12em]'>${s.name}</div>
          <div class='text-[11px] text-white font-bold mt-1'>${s.rating || "NOT_RATED"}</div>
          <div class='text-[9px] text-gray-500 mt-1'>${s.category} • ${s.distance_text || ""}</div>
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

// --- MARKET DATA (Worker SPARQL Route) ---
async function loadMarketData(pc) {
  const marketBody = document.getElementById("marketBody");
  const valMetric = document.getElementById("valMetric");
  if (marketBody)
    marketBody.innerHTML =
      "<tr><td colspan='4' class='p-4 text-center animate-pulse text-[10px] text-sky-400'>QUERYING_SPARQL...</td></tr>";

  try {
    const res = await fetch(`${PROXY_URL}?ppi=1&postcode=${encodeURIComponent(pc)}`);
    const data = await res.json();
    if (!marketBody) return;
    marketBody.innerHTML = "";

    const txs = data.transactions || [];
    window.__PER_STATE__.ppi = txs;

    if (txs.length > 0) {
      txs
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .forEach((t) => {
          const row = document.createElement("tr");
          const addr = `${t.paon || ""} ${t.street || ""}`.trim();
          row.innerHTML = `
            <td class='p-4 text-gray-500 text-[10px]'>${t.date.split("T")[0]}</td>
            <td class='p-4 text-white font-medium text-[10px]'>${addr}</td>
            <td class='p-4 text-green-500 font-bold text-[10px]'>£${t.amount.toLocaleString()}</td>
          `;
          marketBody.appendChild(row);
        });
      const avg = txs.reduce((acc, curr) => acc + curr.amount, 0) / txs.length;
      if (valMetric) valMetric.innerText = `£${Math.round(avg).toLocaleString()}`;
    } else {
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-gray-700 text-[10px]'>NO_PPI_DATA</td></tr>";
    }
  } catch (e) {
    if (marketBody)
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-red-500 text-[10px]'>PPI_ERROR</td></tr>";
  }
}

// --- FLOOD / RADON (Worker Routes) ---
async function loadFloodRisk(cleanPostcode) {
  const el = document.getElementById("floodStatus");
  if (el) {
    el.className = "font-bold text-sky-400 animate-pulse";
    el.innerText = "RESOLVING...";
  }

  try {
    const res = await fetch(`${PROXY_URL}?flood=1&postcode=${encodeURIComponent(cleanPostcode)}`);
    const data = await res.json();
    window.__PER_STATE__.flood = data;

    if (!el) return;
    el.classList.remove("animate-pulse", "indicator-green", "indicator-red", "indicator-amber");

    const band = (data.risk_band || "UNKNOWN").toUpperCase();
    if (band === "LOW") {
      el.classList.add("indicator-green");
      el.innerText = "LOW_RISK";
    } else if (band === "MEDIUM") {
      el.classList.add("indicator-amber");
      el.innerText = "MEDIUM_RISK";
    } else if (band === "HIGH") {
      el.classList.add("indicator-red");
      el.innerText = "HIGH_RISK";
    } else {
      el.classList.add("indicator-amber");
      el.innerText = "UNKNOWN";
    }
  } catch (e) {
    if (!el) return;
    el.classList.remove("animate-pulse");
    el.classList.add("indicator-red");
    el.innerText = "FLOOD_OFFLINE";
  }
}

async function loadRadonRisk(cleanPostcode) {
  const el = document.getElementById("radonStatus");
  if (el) {
    el.className = "font-bold text-sky-400 uppercase animate-pulse";
    el.innerText = "RESOLVING...";
  }

  try {
    const res = await fetch(`${PROXY_URL}?radon=1&postcode=${encodeURIComponent(cleanPostcode)}`);
    const data = await res.json();
    window.__PER_STATE__.radon = data;

    if (!el) return;
    el.classList.remove("animate-pulse", "indicator-green", "indicator-red", "indicator-amber");

    const band = (data.band || "UNKNOWN").toUpperCase();
    if (band === "BAND_1") {
      el.classList.add("indicator-green");
      el.innerText = "BAND_1 (LOW)";
    } else if (band === "BAND_2") {
      el.classList.add("indicator-amber");
      el.innerText = "BAND_2 (MEDIUM)";
    } else if (band === "BAND_3") {
      el.classList.add("indicator-red");
      el.innerText = "BAND_3 (HIGH)";
    } else {
      el.classList.add("indicator-amber");
      el.innerText = "UNKNOWN";
    }
  } catch (e) {
    if (!el) return;
    el.classList.remove("animate-pulse");
    el.classList.add("indicator-red");
    el.innerText = "RADON_OFFLINE";
  }
}

// --- MAPLAYER / MAPLIBRE ---
function initMapIfNeeded(epc) {
  if (!epc || epc.latitude == null || epc.longitude == null) return;
  const state = window.__PER_STATE__;
  if (state.map) return;

  const center = [epc.longitude, epc.latitude];

  const map = new maplibregl.Map({
    container: "map",
    style: "https://demotiles.maplibre.org/style.json",
    center,
    zoom: 14,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", () => {
    state.map = map;

    map.addSource("epc-point", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "epc-point-layer",
      type: "circle",
      source: "epc-point",
      paint: {
        "circle-radius": 6,
        "circle-color": "#38bdf8",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0f172a",
      },
    });

    map.addSource("schools-point", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "schools-point-layer",
      type: "circle",
      source: "schools-point",
      paint: {
        "circle-radius": 4,
        "circle-color": "#22c55e",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0f172a",
      },
    });

    map.addSource("ppi-point", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "ppi-point-layer",
      type: "circle",
      source: "ppi-point",
      paint: {
        "circle-radius": 3,
        "circle-color": "#f97316",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0f172a",
      },
    });

    state.mapLayers.epc = "epc-point-layer";
    state.mapLayers.schools = "schools-point-layer";
    state.mapLayers.ppi = "ppi-point-layer";
    state.mapLayers.flood = null;
    state.mapLayers.radon = null;

    updateMapLayers();
  });
}

function updateMapLayers() {
  const state = window.__PER_STATE__;
  const map = state.map;
  if (!map) return;

  const epc = state.epc;
  const schools = state.schools || [];
  const ppi = state.ppi || [];

  if (epc && epc.latitude != null && epc.longitude != null) {
    const epcSource = map.getSource("epc-point");
    if (epcSource) {
      epcSource.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [epc.longitude, epc.latitude],
            },
            properties: {
              title: epc.address,
              rating: epc.rating,
            },
          },
        ],
      });
    }
  }

  const schoolSource = map.getSource("schools-point");
  if (schoolSource) {
    schoolSource.setData({
      type: "FeatureCollection",
      features: schools.map((s, idx) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [epc.longitude + 0.002 * (idx + 1), epc.latitude + 0.002 * (idx + 1)],
        },
        properties: {
          title: s.name,
          rating: s.rating,
        },
      })),
    });
  }

  const ppiSource = map.getSource("ppi-point");
  if (ppiSource) {
    ppiSource.setData({
      type: "FeatureCollection",
      features: ppi.map((t, idx) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [epc.longitude - 0.002 * (idx + 1), epc.latitude - 0.002 * (idx + 1)],
        },
        properties: {
          amount: t.amount,
        },
      })),
    });
  }

  Object.entries(state.mapLayers).forEach(([key, layerId]) => {
    if (!layerId) return;
    const visible = state.activeLayers[key];
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  });
}

window.toggleLayer = function (layerKey) {
  const state = window.__PER_STATE__;
  state.activeLayers[layerKey] = !state.activeLayers[layerKey];

  const buttons = document.querySelectorAll(`[data-layer="${layerKey}"]`);
  buttons.forEach((btn) => {
    if (state.activeLayers[layerKey]) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  updateMapLayers();
};

// --- FINAL AUDIT ---
async function initiateFinalAudit(epcRaw) {
  document.getElementById("dashboard").classList.remove("hidden");
  const epc = normalizeEpc(epcRaw);
  window.__PER_STATE__.epc = epc;

  document.getElementById("displayAddress").innerText = epc.address.toUpperCase();
  document.getElementById("displayUprn").innerText = epc.uprn;
  document.getElementById("epcBadge").innerText = epc.rating;

  const sqftMetric = document.getElementById("sqftMetric");
  sqftMetric.innerText =
    epc.area > 0 ? `${Math.round(epc.area * 10.764)} SQFT (${epc.area}m²)` : "N/A";

  const cleanPc = epc.postcode.replace(/\s+/g, "").toUpperCase();
  updateStatus("AUDIT_ACTIVE", "loading");
  setEpcState("ready", "EPC_RESOLVED");

  await Promise.all([
    loadMarketData(epc.postcode),
    loadSchoolsFromOfsted(cleanPc),
    loadFloodRisk(cleanPc),
    loadRadonRisk(cleanPc),
  ]);

  initMapIfNeeded(epc);
  updateMapLayers();

  updateStatus("AUDIT_COMPLETE", "success");
}

// --- DISCOVERY LOGIC ---
window.handleDiscovery = async function () {
  const input = document.getElementById("mainInput").value.trim();
  if (!input) return updateStatus("INPUT_REQUIRED", "error");

  document.getElementById("addressSelectorContainer").classList.add("hidden");

  if (/^\d{6,12}$/.test(input)) {
    updateStatus("UPRN_LOOKUP", "loading");
    setEpcState("pending");
    const data = await safeFetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/search?uprn=${input}`
    );
    if (data?.rows?.length > 0) initiateFinalAudit(data.rows[0]);
    else {
      updateStatus("UPRN_NOT_FOUND", "error");
      setEpcState("error", "UPRN_NOT_FOUND");
    }
  } else if (/[A-Z]{1,2}\d/i.test(input)) {
    const pcMatch = input.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    if (!pcMatch) return updateStatus("INVALID_POSTCODE", "error");

    updateStatus("POSTCODE_SCAN", "loading");
    setEpcState("pending");
    const pc = pcMatch[0].toUpperCase();
    const data = await safeFetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${pc.replace(
        /\s/g,
        ""
      )}`
    );

    if (data?.rows?.length > 0) {
      window.__EPC_ROWS__ = data.rows;
      const container = document.getElementById("addressSelectorContainer");
      const dropdown = document.getElementById("addressDropdown");
      dropdown.innerHTML = "<option value=''>-- SELECT PROPERTY --</option>";
      data.rows.forEach((r, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = r.address;
        dropdown.appendChild(opt);
      });
      container.classList.remove("hidden");
      updateStatus("CHOOSE_ADDRESS", "success");
      setEpcState("ready", "MULTIPLE_MATCHES");
    } else {
      updateStatus("NO_DATA", "error");
      setEpcState("error", "NO_EPC_FOR_POSTCODE");
    }
  } else {
    updateStatus("UNSUPPORTED_INPUT", "error");
  }
};

window.selectAddress = function () {
  const idx = document.getElementById("addressDropdown").value;
  if (idx === "" || !window.__EPC_ROWS__) return;
  document.getElementById("addressSelectorContainer").classList.add("hidden");
  initiateFinalAudit(window.__EPC_ROWS__[idx]);
};
