// worker.js
/**
 * £Per Worker v13.1
 * - EPC proxy
 * - PPI: Land Registry SPARQL (5 most recent)
 * - Schools: Ofsted HTML scrape (rating fix)
 * - Flood / Radon
 * - HPI: UKHPI SPARQL (LA + UK fallback)
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

async function cachedJson(env, key, ttlSeconds, fetcher) {
  const kv = env.CACHE;
  if (kv) {
    const cached = await kv.get(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
  }
  const fresh = await fetcher();
  if (kv && fresh && !fresh.error) {
    await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });
  }
  return fresh;
}

// SCHOOLS
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

        const ratingMatch =
          block.match(/rating-grade[^>]*>([^<]+)</i) ||
          block.match(/Overall effectiveness[\s\S]*?<strong[^>]*>([^<]+)</i) ||
          block.match(/Inspection\s+grade[\s\S]*?<strong[^>]*>([^<]+)</i) ||
          block.match(/rating-text[^>]*>([^<]+)</i) ||
          block.match(/class="[^"]*rating[^"]*"[\s\S]*?<strong[^>]*>([^<]+)</i);

        const catMatch =
          block.match(/Category:\s*<strong>([\s\S]*?)<\/strong>/) ||
          block.match(/Phase of education[\s\S]*?<strong[^>]*>([^<]+)</i);

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

// PPI (5 most recent)
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
      } ORDER BY DESC(?date) LIMIT 5`;

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

// FLOOD
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
          Accept: "application/json",
          ...(env.FLOOD_API_KEY
            ? { Authorization: `Bearer ${env.FLOOD_API_KEY}` }
            : {}),
        },
      });
      const json = await res.json();

      const raw = (json.risk || json.risk_band || "UNKNOWN")
        .toString()
        .toUpperCase();
      let band = "UNKNOWN";
      if (raw.includes("LOW")) band = "LOW";
      else if (raw.includes("MEDIUM") || raw.includes("MODERATE"))
        band = "MEDIUM";
      else if (raw.includes("HIGH") || raw.includes("SIGNIFICANT"))
        band = "HIGH";

      return {
        risk_band: band,
        raw,
        source: "FLOOD_API",
      };
    } catch (e) {
      return {
        error: "FLOOD_EXCEPTION",
        message: e.message,
        risk_band: "UNKNOWN",
      };
    }
  });

  return jsonResponse(result);
}

// RADON
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
          Accept: "application/json",
          ...(env.RADON_API_KEY
            ? { Authorization: `Bearer ${env.RADON_API_KEY}` }
            : {}),
        },
      });
      const json = await res.json();

      const raw = (json.band || json.risk || "UNKNOWN")
        .toString()
        .toUpperCase();
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
      return {
        error: "RADON_EXCEPTION",
        message: e.message,
        band: "UNKNOWN",
      };
    }
  });

  return jsonResponse(result);
}

// HPI
function slugifyRegionName(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function queryUkhpiForRegionMonth(regionSlug, month) {
  const uri = `http://landregistry.data.gov.uk/data/ukhpi/region/${regionSlug}/month/${month}`;
  const sparql = `
    prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    prefix ukhpi: <http://landregistry.data.gov.uk/def/ukhpi/>
    SELECT DISTINCT ?regionName ?date ?ukhpi ?volume
    WHERE {
      VALUES ?regionMonth { <${uri}> }
      ?regionMonth
        ukhpi:refRegion ?region;
        ukhpi:refMonth ?date;
        ukhpi:housePriceIndex ?ukhpi.
      OPTIONAL { ?regionMonth ukhpi:salesVolume ?volume }
      ?region rdfs:label ?regionName .
      FILTER (langMatches(lang(?regionName), "EN"))
    }`;

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

  if (!res.ok) return null;
  const json = await res.json();
  const b = json.results?.bindings?.[0];
  if (!b) return null;

  return {
    regionName: b.regionName?.value || "",
    date: b.date?.value || "",
    hpi: parseFloat(b.ukhpi?.value) || null,
    volume: b.volume ? parseInt(b.volume.value, 10) : null,
  };
}

async function handleHpiRequest(url, env) {
  const la = url.searchParams.get("la");
  const month = url.searchParams.get("month");
  if (!la || !month) return jsonResponse({ error: "LA_AND_MONTH_REQUIRED" }, 400);

  const cacheKey = `hpi:${la}:${month}`;
  const result = await cachedJson(env, cacheKey, 24 * 60 * 60, async () => {
    const regionSlug = slugifyRegionName(la);
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}`;

    let sale = await queryUkhpiForRegionMonth(regionSlug, month);
    let todayHpi = await queryUkhpiForRegionMonth(regionSlug, todayMonth);

    if (!sale || !todayHpi) {
      const ukSlug = "united-kingdom";
      if (!sale) sale = await queryUkhpiForRegionMonth(ukSlug, month);
      if (!todayHpi)
        todayHpi = await queryUkhpiForRegionMonth(ukSlug, todayMonth);
    }

    if (!sale || !todayHpi || !sale.hpi || !todayHpi.hpi) {
      return { error: "HPI_UNAVAILABLE" };
    }

    const factor = todayHpi.hpi / sale.hpi;

    return {
      saleHPI: sale.hpi,
      todayHPI: todayHpi.hpi,
      factor,
      region: sale.regionName || la,
      saleMonth: month,
      todayMonth,
    };
  });

  return jsonResponse(result);
}

// EPC PROXY
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

// ROUTER
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    if (url.searchParams.get("schools") === "1")
      return await handleSchoolsRequest(url, env);
    if (url.searchParams.get("ppi") === "1")
      return await handlePpiRequest(url, env);
    if (url.searchParams.get("flood") === "1")
      return await handleFloodRequest(url, env);
    if (url.searchParams.get("radon") === "1")
      return await handleRadonRequest(url, env);
    if (url.searchParams.get("hpi") === "1")
      return await handleHpiRequest(url, env);
    if (url.searchParams.get("url"))
      return await handleProxyRequest(url, env);

    return jsonResponse({ error: "INVALID_ENDPOINT" }, 404);
  },
};
