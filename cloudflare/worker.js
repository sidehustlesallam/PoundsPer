export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    if (url.searchParams.has("url")) {
      const target = url.searchParams.get("url");
      if (!target) return json({ error: "Missing target url" }, 400);
      const res = await fetch(target, { headers: { Authorization: "Basic " + env.EPC_TOKEN } });
      return withCors(new Response(await res.text(), { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" } }));
    }

    if (url.searchParams.get("epc") === "search") {
      const postcode = normPostcode(url.searchParams.get("postcode"));
      const uprn = (url.searchParams.get("uprn") || "").trim();
      if (!postcode && !uprn) return json({ error: "Missing postcode or uprn" }, 400);

      const epc = await fetchEpcSearch({ postcode, uprn, env });
      if (epc.error) return json(epc, 502);
      return json({ rows: epc.rows });
    }

    if (url.searchParams.get("epc") === "certificate") {
      const rrn = url.searchParams.get("rrn");
      if (!rrn) return json({ error: "Missing rrn" }, 400);
      const epcBase = env.EPC_API_BASE || "https://epc.opendatacommunities.org/api/v1/domestic";
      const data = await fetchJsonWithAuth(`${epcBase}/certificate/${encodeURIComponent(rrn)}`, env.EPC_TOKEN);
      if (data.error) return json(data, 502);
      const row = Array.isArray(data.rows) ? data.rows[0] || null : null;
      if (!row) return json({ error: "EPC certificate not found" }, 404);
      return json(row);
    }

    if (url.searchParams.get("ppi") === "1") {
      const postcode = normPostcode(url.searchParams.get("postcode"));
      if (!postcode) return json({ error: "Missing postcode" }, 400);

      const ppi = await fetchPpiRows(postcode);
      if (ppi.error) return json(ppi, 502);

      const epc = await fetchEpcSearch({ postcode, env });
      const rows = enrichPpiRowsWithEpc(ppi.rows.slice(0, 5), epc.rows || [], postcode);
      const summary = summarise(rows);
      return json({ rows, ...summary });
    }

    if (url.searchParams.get("schools") === "1") {
      const postcode = normPostcode(url.searchParams.get("postcode"));
      if (!postcode) return json({ error: "Missing postcode" }, 400);

      const providers = await scrapeSchools(postcode);
      return json({ providers });
    }

    if (url.searchParams.get("hpi") === "1") {
      const saleDate = url.searchParams.get("saleDate");
      const factor = estimateHpiFactor(saleDate);
      return json({ factor, note: "Estimated HPI factor (fallback model)" });
    }

    if (url.searchParams.get("flood") === "1" || url.searchParams.get("risk") === "flood") {
      return json({ summary: "Placeholder flood data", river: "N/A", surface: "N/A", groundwater: "N/A" });
    }

    if (url.searchParams.get("radon") === "1" || url.searchParams.get("risk") === "radon") {
      return json({ level: "Unknown", note: "Radon placeholder" });
    }

    if (url.searchParams.get("utilities") === "1") {
      const postcode = normPostcode(url.searchParams.get("postcode"));
      if (!postcode) return json({ error: "Missing postcode" }, 400);
      const util = await utilitiesByPostcode(postcode);
      return json(util);
    }

    return json({ error: "Invalid request" }, 400);
  }
};

async function fetchEpcSearch({ postcode, uprn, env }) {
  const epcBase = env.EPC_API_BASE || "https://epc.opendatacommunities.org/api/v1/domestic";
  const target = new URL(`${epcBase}/search`);
  if (postcode) target.searchParams.set("postcode", postcode);
  if (uprn) target.searchParams.set("uprn", uprn);
  const data = await fetchJsonWithAuth(target.toString(), env.EPC_TOKEN);
  if (data.error) return data;
  return { rows: Array.isArray(data.rows) ? data.rows : [] };
}

async function fetchPpiRows(postcode) {
  const sparql = `
    PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    SELECT ?paon ?street ?amount ?date WHERE {
      ?trans lrppi:propertyAddress ?addr ; lrppi:pricePaid ?amount ; lrppi:transactionDate ?date .
      ?addr lrppi:postcode "${postcode}"^^xsd:string ; lrppi:paon ?paon ; lrppi:street ?street .
    }
    ORDER BY DESC(?date)
    LIMIT 5
  `;

  const target = "https://landregistry.data.gov.uk/app/ppd/ppd_data.sparql?query=" + encodeURIComponent(sparql);
  const res = await fetch(target, { headers: { Accept: "application/sparql-results+json, application/json" } });
  const raw = await safeJsonResponse(res);

  if (!raw?.results?.bindings) {
    return { error: "PPI_UPSTREAM_INVALID", detail: "SPARQL endpoint did not return JSON bindings" };
  }

  return {
    rows: raw.results.bindings.map((b) => ({
      paon: b.paon?.value || "",
      street: b.street?.value || "",
      amount: Number(b.amount?.value || 0),
      date: b.date?.value || ""
    }))
  };
}

function enrichPpiRowsWithEpc(rows, epcRows, postcode) {
  return rows.map((row) => {
    const match = epcRows.find((e) => {
      const paon = String(row.paon || "").toLowerCase();
      const street = String(row.street || "").toLowerCase();
      const addr = [e.address, e.address1, e.address2, e.address3].filter(Boolean).join(" ").toLowerCase();
      return addr.includes(paon) && addr.includes(street);
    });

    const floorArea = Number(match?.total_floor_area || 0) || null;
    const floorAreaSqft = floorArea ? round(floorArea * 10.7639, 2) : null;

    return {
      ...row,
      postcode,
      floorArea,
      floorAreaSqft,
      rrn: match?.lmk_key || null,
      uprn: match?.uprn || null
    };
  });
}

function summarise(rows) {
  const prices = rows.map((r) => Number(r.amount)).filter(Number.isFinite);
  const ppsqm = rows.map((r) => (r.floorArea ? r.amount / r.floorArea : null)).filter(Number.isFinite);
  const ppsqft = rows.map((r) => (r.floorAreaSqft ? r.amount / r.floorAreaSqft : null)).filter(Number.isFinite);

  return {
    averagePrice: prices.length ? round(prices.reduce((a, b) => a + b, 0) / prices.length, 0) : null,
    averagePricePerSqm: ppsqm.length ? round(ppsqm.reduce((a, b) => a + b, 0) / ppsqm.length, 2) : null,
    averagePricePerSqft: ppsqft.length ? round(ppsqft.reduce((a, b) => a + b, 0) / ppsqft.length, 2) : null
  };
}

async function scrapeSchools(postcode) {
  const target = `https://www.compare-school-performance.service.gov.uk/schools-by-postcode?postcode=${postcode}`;
  const res = await fetch(target);
  const html = await res.text();

  const rows = [...html.matchAll(/<a[^>]+school-link[^>]*>(.*?)<\/a>[\s\S]*?school-type[^>]*>(.*?)<[^>]*>[\s\S]*?overall-effectiveness[^>]*>(.*?)<\//gi)];
  if (!rows.length) {
    return [{ name: "No schools parsed", type: "Unknown", rating: "Unknown" }];
  }

  return rows.slice(0, 3).map((m) => ({
    name: stripHtml(m[1]),
    type: stripHtml(m[2]),
    rating: stripHtml(m[3])
  }));
}

function estimateHpiFactor(saleDate) {
  const sale = saleDate ? new Date(saleDate) : null;
  if (!sale || Number.isNaN(sale.getTime())) return 1;
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - sale.getFullYear()) * 12 + (now.getMonth() - sale.getMonth()));
  const monthlyGrowth = 0.0025; // ~3% annualized fallback
  return round(Math.pow(1 + monthlyGrowth, months), 4);
}

async function utilitiesByPostcode(postcode) {
  const postcodesRes = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
  const json = await safeJsonResponse(postcodesRes);
  const district = json?.result?.admin_district || "Unknown";
  const area = postcode.slice(0, 2);

  const waterMap = {
    EC: "Thames Water", WC: "Thames Water", SW: "Thames Water", NW: "Thames Water",
    SE: "Thames Water", N1: "Thames Water", B: "Severn Trent", M: "United Utilities",
    L: "United Utilities", LS: "Yorkshire Water", BS: "Bristol Water", CF: "Dŵr Cymru"
  };

  return {
    council: district,
    water: waterMap[area] || "Check local supplier",
    broadband: "Up to 1 Gbps (area-dependent estimate)"
  };
}

function normPostcode(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

function json(obj, status = 200) {
  return withCors(new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }));
}

async function fetchJsonWithAuth(url, token) {
  try {
    const res = await fetch(url, { headers: { Authorization: "Basic " + token, Accept: "application/json" } });
    const data = await safeJsonResponse(res);
    if (!data) return { error: "INVALID_JSON", status: res.status };
    if (!res.ok) return { error: "UPSTREAM_ERROR", status: res.status, data };
    return data;
  } catch (err) {
    return { error: "NETWORK_EXCEPTION", message: err.message };
  }
}

async function safeJsonResponse(res) {
  try { return await res.json(); } catch { return null; }
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function round(value, dp = 0) {
  if (value == null || Number.isNaN(value)) return null;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}