/**
 * £Per Audit Engine v13.2
 * - Correct £/m² conversion (real + HPI tables)
 * - HPI uses EPC local authority reliably
 * - MapLibre guarded so map failure doesn’t break audit
 */

const PROXY_URL = "https://lingering-snow-ccff.sidehustlesallam.workers.dev/";

// STATE
window.__PER_STATE__ = {
  epc: null,
  epcDetail: null,
  ppi: [],
  ppiEnriched: [],
  schools: [],
  flood: null,
  radon: null,
  map: null,
  mapMarker: null,
  epcRowsByPostcode: {},
};

// UI
function updateStatus(msg, type) {
  const text = document.getElementById("statusText");
  const dot = document.getElementById("statusDot");
  if (text) text.innerText = msg.toUpperCase();
  if (!dot) return;

  let cls = "w-1.5 h-1.5 rounded-full ";
  if (type === "loading") cls += "bg-sky-400 animate-pulse";
  else if (type === "error")
    cls += "bg-red-600 shadow-[0_0_8px_rgba(248,113,113,0.8)]";
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

// EPC proxy fetch
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

// EPC normalisation
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
    localAuthority: epc["local-authority-label"] || epc["local-authority"] || null,
  };
}

// SCHOOLS
async function loadSchoolsFromOfsted(cleanPostcode) {
  const container = document.getElementById("schoolList");
  if (!container) return;
  container.innerHTML =
    "<div class='text-[10px] animate-pulse text-sky-400'>SCRAPING_OFSTED_DATA...</div>";

  try {
    const res = await fetch(
      `${PROXY_URL}?schools=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );
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
      container.innerHTML =
        "<div class='text-gray-600 text-[10px]'>NO_LOCAL_SCHOOLS_FOUND</div>";
    }
  } catch (e) {
    container.innerHTML =
      "<div class='text-red-500 text-[10px]'>SCHOOLS_OFFLINE</div>";
  }
}

// FLOOD / RADON
async function loadFloodRisk(cleanPostcode) {
  const el = document.getElementById("floodStatus");
  if (el) {
    el.className = "font-bold text-sky-400 animate-pulse";
    el.innerText = "RESOLVING...";
  }

  try {
    const res = await fetch(
      `${PROXY_URL}?flood=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );
    const data = await res.json();
    window.__PER_STATE__.flood = data;

    if (!el) return;
    el.classList.remove(
      "animate-pulse",
      "indicator-green",
      "indicator-red",
      "indicator-amber"
    );

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
  } catch {
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
    const res = await fetch(
      `${PROXY_URL}?radon=1&postcode=${encodeURIComponent(cleanPostcode)}`
    );
    const data = await res.json();
    window.__PER_STATE__.radon = data;

    if (!el) return;
    el.classList.remove(
      "animate-pulse",
      "indicator-green",
      "indicator-red",
      "indicator-amber"
    );

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
  } catch {
    if (!el) return;
    el.classList.remove("animate-pulse");
    el.classList.add("indicator-red");
    el.innerText = "RADON_OFFLINE";
  }
}

// EPC rows by postcode (single fetch, reused)
async function getEpcRowsForPostcode(postcode) {
  const state = window.__PER_STATE__;
  const cleanPc = postcode.replace(/\s+/g, "").toUpperCase();
  if (state.epcRowsByPostcode[cleanPc]) return state.epcRowsByPostcode[cleanPc];

  const data = await safeFetch(
    `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${cleanPc}`
  );
  const rows = data?.rows || [];
  state.epcRowsByPostcode[cleanPc] = rows;
  return rows;
}

// EPC AREA LOOKUP FOR PPI (postcode-only + PAON)
async function lookupEpcAreaFromPostcode(paon, postcode) {
  if (!paon || !postcode) return null;
  const rows = await getEpcRowsForPostcode(postcode);
  if (!rows.length) return null;

  const paonStr = paon.toString().toUpperCase().trim();
  const match = rows.find((r) => {
    const addr = (r.address || "").toUpperCase();
    return addr.startsWith(paonStr + " ") || addr === paonStr;
  });

  if (!match || !match["total-floor-area"]) return null;

  const sqm = parseFloat(match["total-floor-area"]);
  if (!sqm || sqm <= 0) return null;

  return {
    sqm,
    sqft: sqm * 10.764,
  };
}

// HPI helpers
function setHpiTablesUnavailable(reason) {
  const techBody = document.getElementById("hpiTechBody");
  const simpleBody = document.getElementById("hpiSimpleBody");
  const hpiMarketAvg = document.getElementById("hpiMarketAvg");
  const hpiAreaAvg = document.getElementById("hpiAreaAvg");

  if (techBody)
    techBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-700 italic">HPI_UNAVAILABLE (${reason})</td></tr>`;
  if (simpleBody)
    simpleBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-700 italic">HPI_UNAVAILABLE (${reason})</td></tr>`;
  if (hpiMarketAvg) hpiMarketAvg.innerText = "--";
  if (hpiAreaAvg) hpiAreaAvg.innerText = "--";
}

async function computeHpiTables(enrichedTxs, laName) {
  const techBody = document.getElementById("hpiTechBody");
  const simpleBody = document.getElementById("hpiSimpleBody");
  const hpiMarketAvg = document.getElementById("hpiMarketAvg");
  const hpiAreaAvg = document.getElementById("hpiAreaAvg");

  if (techBody)
    techBody.innerHTML =
      '<tr><td colspan="8" class="p-4 text-center text-sky-400 text-[10px]">COMPUTING_HPI...</td></tr>';
  if (simpleBody)
    simpleBody.innerHTML =
      '<tr><td colspan="4" class="p-4 text-center text-sky-400 text-[10px]">COMPUTING_HPI...</td></tr>';

  try {
    const rows = [];
    let totalAdjPrice = 0;
    let totalAdjPpSqft = 0;
    let countAdjArea = 0;

    for (const t of enrichedTxs) {
      const dateStr = t.date.split("T")[0];
      const month = dateStr.slice(0, 7);

      const hpiRes = await fetch(
        `${PROXY_URL}?hpi=1&la=${encodeURIComponent(laName)}&month=${encodeURIComponent(
          month
        )}`
      );
      const hpi = await hpiRes.json();
      if (hpi.error || !hpi.factor) continue;

      const factor = hpi.factor;
      const adjPrice = t.amount * factor;

      let ppSqft = null;
      let adjPpSqft = null;
      if (t.areaSqft && t.areaSqft > 0) {
        ppSqft = t.amount / t.areaSqft;
        adjPpSqft = adjPrice / t.areaSqft;
        totalAdjPpSqft += adjPpSqft;
        countAdjArea += 1;
      }

      totalAdjPrice += adjPrice;

      rows.push({
        ...t,
        dateStr,
        factor,
        adjPrice,
        ppSqft,
        adjPpSqft,
      });
    }

    if (rows.length === 0) {
      setHpiTablesUnavailable("NO_VALID_HPI_ROWS");
      return;
    }

    if (techBody) techBody.innerHTML = "";
    if (simpleBody) simpleBody.innerHTML = "";

    rows.forEach((r) => {
      const techRow = document.createElement("tr");
      const areaLabel =
        r.areaSqm && r.areaSqft
          ? `${Math.round(r.areaSqft).toLocaleString()} sqft (${r.areaSqm} m²)`
          : "N/A";
      const ppSqftLabel = r.ppSqft
        ? `£${Math.round(r.ppSqft).toLocaleString()}`
        : "N/A";
      const adjPpSqftLabel = r.adjPpSqft
        ? `£${Math.round(r.adjPpSqft).toLocaleString()}`
        : "N/A";

      techRow.innerHTML = `
        <td class='p-2 text-gray-500'>${r.dateStr}</td>
        <td class='p-2 text-white'>${r.addrCore}</td>
        <td class='p-2 text-green-500 font-bold'>£${r.amount.toLocaleString()}</td>
        <td class='p-2 text-sky-400'>${areaLabel}</td>
        <td class='p-2 text-gray-300'>${ppSqftLabel}</td>
        <td class='p-2 text-amber-400'>${r.factor.toFixed(3)}</td>
        <td class='p-2 text-emerald-400 font-bold'>£${Math.round(
          r.adjPrice
        ).toLocaleString()}</td>
        <td class='p-2 text-gray-100'>${adjPpSqftLabel}</td>
      `;
      techBody.appendChild(techRow);

      const simpleRow = document.createElement("tr");
      const delta = r.adjPrice - r.amount;
      const deltaLabel = `${delta >= 0 ? "+" : "-"}£${Math.abs(
        Math.round(delta)
      ).toLocaleString()}`;
      simpleRow.innerHTML = `
        <td class='p-2 text-white'>${r.addrCore}</td>
        <td class='p-2 text-green-500 font-bold'>£${r.amount.toLocaleString()}</td>
        <td class='p-2 text-emerald-400 font-bold'>£${Math.round(
          r.adjPrice
        ).toLocaleString()}</td>
        <td class='p-2 ${
          delta >= 0 ? "text-emerald-400" : "text-red-400"
        } font-bold'>${deltaLabel}</td>
      `;
      simpleBody.appendChild(simpleRow);
    });

    const avgAdjPrice = totalAdjPrice / rows.length;
    if (hpiMarketAvg)
      hpiMarketAvg.innerText = `£${Math.round(avgAdjPrice).toLocaleString()}`;

    if (countAdjArea > 0) {
      const avgAdjPpSqft = totalAdjPpSqft / countAdjArea;
      const avgAdjPpM2 = avgAdjPpSqft * 10.764; // ✅ FIXED
      if (hpiAreaAvg)
        hpiAreaAvg.innerText = `£${Math.round(
          avgAdjPpSqft
        ).toLocaleString()} /SQFT ( £${Math.round(
          avgAdjPpM2
        ).toLocaleString()} /M² )`;
    } else {
      if (hpiAreaAvg) hpiAreaAvg.innerText = "N/A";
    }
  } catch {
    setHpiTablesUnavailable("HPI_EXCEPTION");
  }
}

// PPI + EPC AREA + AREA_AVG
async function loadMarketData(pc) {
  const marketBody = document.getElementById("marketBody");
  const valMetric = document.getElementById("valMetric");
  const areaMetric = document.getElementById("areaMetric");
  if (marketBody)
    marketBody.innerHTML =
      "<tr><td colspan='4' class='p-4 text-center animate-pulse text-[10px] text-sky-400'>QUERYING_SPARQL...</td></tr>";

  try {
    const res = await fetch(
      `${PROXY_URL}?ppi=1&postcode=${encodeURIComponent(pc)}`
    );
    const data = await res.json();
    if (!marketBody) return;
    marketBody.innerHTML = "";

    const txs = data.transactions || [];
    window.__PER_STATE__.ppi = txs;

    if (txs.length === 0) {
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-gray-700 text-[10px]'>NO_PPI_DATA</td></tr>";
      if (valMetric) valMetric.innerText = "--";
      if (areaMetric) areaMetric.innerText = "--";
      return;
    }

    const state = window.__PER_STATE__;
    const laName =
      state.epc?.localAuthority ||
      state.epcDetail?.["local-authority-label"] ||
      null;

    let totalPrice = 0;
    let totalPpSqft = 0;
    let countWithArea = 0;
    const enriched = [];

    for (const t of txs) {
      const addrCore = `${t.paon || ""} ${t.street || ""}`.trim();

      let areaSqm = null;
      let areaSqft = null;

      try {
        const area = await lookupEpcAreaFromPostcode(t.paon, pc);
        if (area) {
          areaSqm = area.sqm;
          areaSqft = area.sqft;
        }
      } catch {}

      const dateStr = t.date.split("T")[0];
      const rowEl = document.createElement("tr");
      const areaLabel =
        areaSqm && areaSqft
          ? `${Math.round(areaSqft).toLocaleString()} sqft (${areaSqm} m²)`
          : "N/A";

      rowEl.innerHTML = `
        <td class='p-4 text-gray-500 text-[10px]'>${dateStr}</td>
        <td class='p-4 text-white font-medium text-[10px]'>${addrCore}</td>
        <td class='p-4 text-green-500 font-bold text-[10px]'>£${t.amount.toLocaleString()}</td>
        <td class='p-4 text-sky-400 font-medium text-[10px]'>${areaLabel}</td>
      `;
      marketBody.appendChild(rowEl);

      totalPrice += t.amount;

      let ppSqft = null;
      if (areaSqft && areaSqft > 0) {
        ppSqft = t.amount / areaSqft;
        totalPpSqft += ppSqft;
        countWithArea += 1;
      }

      enriched.push({
        ...t,
        addrCore,
        areaSqm,
        areaSqft,
        ppSqft,
      });
    }

    window.__PER_STATE__.ppiEnriched = enriched;

    const avgPrice = totalPrice / txs.length;
    if (valMetric) valMetric.innerText = `£${Math.round(avgPrice).toLocaleString()}`;

    if (countWithArea > 0) {
      const avgPpSqft = totalPpSqft / countWithArea;
      const avgPpM2 = avgPpSqft * 10.764; // ✅ FIXED
      if (areaMetric)
        areaMetric.innerText = `£${Math.round(
          avgPpSqft
        ).toLocaleString()} /SQFT ( £${Math.round(
          avgPpM2
        ).toLocaleString()} /M² )`;
    } else {
      if (areaMetric) areaMetric.innerText = "N/A";
    }

    if (laName) {
      await computeHpiTables(enriched, laName);
    } else {
      setHpiTablesUnavailable("NO_LOCAL_AUTHORITY");
    }
  } catch {
    if (marketBody)
      marketBody.innerHTML =
        "<tr><td colspan='4' class='p-4 text-center text-red-500 text-[10px]'>PPI_ERROR</td></tr>";
  }
}

// MAP
function initMap(epc) {
  if (!epc || epc.latitude == null || epc.longitude == null) return;
  if (typeof maplibregl === "undefined") {
    console.warn("MapLibre not available; skipping map init");
    return;
  }

  const state = window.__PER_STATE__;

  if (!state.map) {
    const map = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: [epc.longitude, epc.latitude],
      zoom: 15,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      state.map = map;
      const marker = new maplibregl.Marker({
        color: "#38bdf8",
      })
        .setLngLat([epc.longitude, epc.latitude])
        .addTo(map);
      state.mapMarker = marker;
    });
  } else {
    state.map.setCenter([epc.longitude, epc.latitude]);
    state.map.setZoom(15);
    if (state.mapMarker) {
      state.mapMarker.setLngLat([epc.longitude, epc.latitude]);
    } else {
      state.mapMarker = new maplibregl.Marker({ color: "#38bdf8" })
        .setLngLat([epc.longitude, epc.latitude])
        .addTo(state.map);
    }
  }
}

// FINAL AUDIT
async function initiateFinalAudit(epcSearchRow) {
  document.getElementById("dashboard").classList.remove("hidden");
  setEpcState("pending");

  let epcDetail = epcSearchRow;
  try {
    const rrn = epcSearchRow.rrn || epcSearchRow["rrn"];
    if (rrn) {
      const detail = await safeFetch(
        `https://epc.opendatacommunities.org/api/v1/domestic/certificate/${encodeURIComponent(
          rrn
        )}`
      );
      if (!detail.error) epcDetail = detail;
    }
  } catch {}

  const epc = normalizeEpc(epcDetail);
  window.__PER_STATE__.epc = epc;
  window.__PER_STATE__.epcDetail = epcDetail;

  document.getElementById("displayAddress").innerText =
    epc.address.toUpperCase();
  document.getElementById("displayUprn").innerText = epc.uprn;
  document.getElementById("epcBadge").innerText = epc.rating;

  const sqftMetric = document.getElementById("sqftMetric");
  sqftMetric.innerText =
    epc.area > 0
      ? `${Math.round(epc.area * 10.764)} SQFT (${epc.area}m²)`
      : "N/A";

  const cleanPc = epc.postcode.replace(/\s+/g, "").toUpperCase();
  updateStatus("AUDIT_ACTIVE", "loading");
  setEpcState("ready", "EPC_RESOLVED");

  await Promise.all([
    loadMarketData(epc.postcode),
    loadSchoolsFromOfsted(cleanPc),
    loadFloodRisk(cleanPc),
    loadRadonRisk(cleanPc),
  ]);

  initMap(epc);
  updateStatus("AUDIT_COMPLETE", "success");
}

// DISCOVERY
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
