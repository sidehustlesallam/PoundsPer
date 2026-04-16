/**
 * £Per Worker v12.0
 * - EPC: tolerant proxy
 * - PPI: Land Registry SPARQL (POST support)
 * - Schools: Ofsted HTML scrape (User-Agent fix)
 * - Flood / Radon: env-configurable upstream APIs
 * - KV-backed caching for stability
 */

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim();
}

// --- KV CACHING HELPER ---
async function cachedJson(env, key, ttlSeconds, fetcher) {
  const kv = env.CACHE;
  if (kv) {
    const cached = await kv.get(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // fall through
      }
    }
  }

  const fresh = await fetcher();
  if (kv && fresh && !fresh.error) {
    await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });
  }
  return fresh;
}

// --- SCHOOLS MODULE: OFSTED SCRAPE ---
async function handleSchoolsRequest(url, env) {
  const postcode = url.searchParams.get("postcode");
  if (!postcode) return jsonResponse({ error: "POSTCODE_REQUIRED" }, 400);

  const cleanPc = postcode.replace(/\s+/g, "").toUpperCase();
  const cacheKey = `schools:${cleanPc}`;

  const result = await cachedJson(env, cacheKey, 6 * 60 * 60, async () => {
    const searchUrl = `https://reports.ofsted.gov.uk/search?q=&location=${encodeURIComponent(
      cleanPc
    )}&radius=3&status%5B%5D=1`;

    try {
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const html = await res.text();

      const results = [];
      const liRegex = /<li class="search-result">([\s\S]*?)<\/li>/g;
      let match;

      while ((match = liRegex.exec(html)) !== null) {
        const block = match[1];
        const nameMatch = block.match(
          /<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/
        );
        const ratingMatch = block.match(
          /Rating:\s*<strong>([\s\S]*?)<\/strong>/
        );
        const catMatch = block.match(
          /Category:\s*<strong>([\s\S]*?)<\/strong>/
        );
        const distMatch = block.match(
          /<strong[^>]*class="address-distance"[^>]*>([\s\S]*?)<\/strong>/
        );

        if (nameMatch) {
          results.push({
            name: cleanText(nameMatch[1]),
            rating: ratingMatch ? cleanText(ratingMatch[1]) : "NOT_RATED",
            category: catMatch ? cleanText(catMatch[1]) : "SCHOOL",
            distance_text: distMatch ? cleanText(distMatch[1]) : "N/A",
          });
        }
      }
      return { schools: results };
    } catch (e) {
      return { error: "SCRAPE_EXCEPTION", message: e.message };
    }
  });

  return jsonResponse(result);
}

// --- PPI MODULE: LAND REGISTRY SPARQL ---
async function handlePpiRequest(url, env) {
  const postcode = url.searchParams.get("postcode");
  if (!postcode) return jsonResponse({ error: "POSTCODE_REQUIRED" }, 400);

  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  const spacedPc = clean.slice(0, -3) + " " + clean.slice(-3);
  const cacheKey = `ppi:${spacedPc}`;

  const result = await cachedJson(env, cacheKey, 24 * 60 * 60, async () => {
    const sparql = `
      prefix lrppi: <http://landregistry.data.gov.uk/def/ppi/>
      prefix skos: <http://www.w3.org/2004/02/skos/core#>
      prefix lrcommon: <http://landregistry.data.gov.uk/def/common/>
      SELECT ?paon ?street ?amount ?date ?category
      WHERE {
        VALUES ?postcode {"${spacedPc}"^^<http://www.w3.org/2001/XMLSchema#string>}
        ?addr lrcommon:postcode ?postcode.
        ?transx lrppi:propertyAddress ?addr ;
                lrppi:pricePaid ?amount ;
                lrppi:transactionDate ?date ;
                lrppi:transactionCategory/skos:prefLabel ?category.
        OPTIONAL {?addr lrcommon:paon ?paon}
        OPTIONAL {?addr lrcommon:street ?street}
      } ORDER BY DESC(?date) LIMIT 10`;

    const res = await fetch(
      "https://landregistry.data.gov.uk/landregistry/query",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/sparql-query",
          Accept: "application/sparql-results+json",
          "User-Agent": "Mozilla/5.0",
        },
        body: sparql,
      }
    );

    const json = await res.json();
    const transactions = (json.results?.bindings || []).map((b) => ({
      paon: b.paon?.value || "",
      street: b.street?.value || "",
      amount: parseFloat(b.amount?.value) || 0,
      date: b.date?.value || "",
      category: b.category?.value || "",
    }));

    return { transactions };
  });

  return jsonResponse(result);
}

// --- FLOOD MODULE (ENV-CONFIGURABLE) ---
async function handleFloodRequest(url, env) {
  const postcode = url.searchParams.get("postcode");
  if (!postcode) return jsonResponse({ error: "POSTCODE_REQUIRED" }, 400);

  const cleanPc = postcode.replace(/\s+/g, "").toUpperCase();
  const cacheKey = `flood:${cleanPc}`;

  const result = await cachedJson(env, cacheKey, 12 * 60 * 60, async () => {
    const base = env.FLOOD_API_BASE || "";
    if (!base) {
      return {
        error: "FLOOD_API_NOT_CONFIGURED",
        risk_band: "UNKNOWN",
        source: "ENV_NOT_SET",
      };
    }

    try {
      const res = await fetch(`${base}?postcode=${encodeURIComponent(cleanPc)}`, {
        headers: {
          "User-Agent": "£PER-Flood-Worker",
          "Accept": "application/json",
          ...(env.FLOOD_API_KEY ? { Authorization: `Bearer ${env.FLOOD_API_KEY}` } : {}),
        },
      });
      const json = await res.json();

      // Expecting upstream to return something like { risk: "LOW" | "MEDIUM" | "HIGH" }
      const raw = (json.risk || json.risk_band || "UNKNOWN").toString().toUpperCase();
      let band = "UNKNOWN";
      if (raw.includes("LOW")) band = "LOW";
      else if (raw.includes("MEDIUM") || raw.includes("MODERATE")) band = "MEDIUM";
      else if (raw.includes("HIGH") || raw.includes("SIGNIFICANT")) band = "HIGH";

      return {
        risk_band: band,
        raw,
        source: "FLOOD_API",
      };
    } catch (e) {
      return { error: "FLOOD_EXCEPTION", message: e.message, risk_band: "UNKNOWN" };
    }
  });

  return jsonResponse(result);
}

// --- RADON MODULE (ENV-CONFIGURABLE) ---
async function handleRadonRequest(url, env) {
  const postcode = url.searchParams.get("postcode");
  if (!postcode) return jsonResponse({ error: "POSTCODE_REQUIRED" }, 400);

  const cleanPc = postcode.replace(/\s+/g, "").toUpperCase();
  const cacheKey = `radon:${cleanPc}`;

  const result = await cachedJson(env, cacheKey, 12 * 60 * 60, async () => {
    const base = env.RADON_API_BASE || "";
    if (!base) {
      return {
        error: "RADON_API_NOT_CONFIGURED",
        band: "UNKNOWN",
        source: "ENV_NOT_SET",
      };
    }

    try {
      const res = await fetch(`${base}?postcode=${encodeURIComponent(cleanPc)}`, {
        headers: {
          "User-Agent": "£PER-Radon-Worker",
          "Accept": "application/json",
          ...(env.RADON_API_KEY ? { Authorization: `Bearer ${env.RADON_API_KEY}` } : {}),
        },
      });
      const json = await res.json();

      // Expecting upstream to return something like { band: 1|2|3 } or "LOW/MEDIUM/HIGH"
      const raw = (json.band || json.risk || "UNKNOWN").toString().toUpperCase();
      let band = "UNKNOWN";
      if (raw.includes("1") || raw.includes("LOW")) band = "BAND_1";
      else if (raw.includes("2") || raw.includes("MEDIUM")) band = "BAND_2";
      else if (raw.includes("3") || raw.includes("HIGH")) band = "BAND_3";

      return {
        band,
        raw,
        source: "RADON_API",
      };
    } catch (e) {
      return { error: "RADON_EXCEPTION", message: e.message, band: "UNKNOWN" };
    }
  });

  return jsonResponse(result);
}

// --- PROXY MODULE: EPC ---
async function handleProxyRequest(url, env) {
  const target = url.searchParams.get("url");
  if (!target) return jsonResponse({ error: "URL_REQUIRED" }, 400);

  const headers = { Accept: "application/json" };
  if (target.includes("epc.opendatacommunities.org") && env.EPC_TOKEN) {
    headers["Authorization"] = `Basic ${env.EPC_TOKEN}`;
  }

  const res = await fetch(target, { headers });
  const text = await res.text();

  try {
    return jsonResponse(JSON.parse(text), res.status);
  } catch {
    return new Response(text, { status: res.status, headers: jsonHeaders });
  }
}

// --- MAIN ROUTER ---
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    if (url.searchParams.get("schools") === "1") return await handleSchoolsRequest(url, env);
    if (url.searchParams.get("ppi") === "1") return await handlePpiRequest(url, env);
    if (url.searchParams.get("flood") === "1") return await handleFloodRequest(url, env);
    if (url.searchParams.get("radon") === "1") return await handleRadonRequest(url, env);
    if (url.searchParams.get("url")) return await handleProxyRequest(url, env);

    return jsonResponse({ error: "INVALID_ENDPOINT" }, 404);
  },
};
