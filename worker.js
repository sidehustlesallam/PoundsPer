/**
 * £Per Worker v11.17
 * - EPC: authenticated via email:api-key (Base64) + UA + CF overrides
 * - Schools: live Ofsted HTML scrape
 * - PPI: Land Registry SPARQL endpoint for price paid data
 */

const EPC_AUTH_HEADER = typeof EPC_TOKEN !== "undefined"
  ? `Basic ${EPC_TOKEN}`
  : null;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(str) {
  return str.replace(/<[^>]*>/g, "").trim();
}

// ------------------------------------------------------------
//  SCHOOLS MODULE — LIVE OFSTED SCRAPE
// ------------------------------------------------------------

async function handleSchoolsRequest(url) {
  const postcode = url.searchParams.get("postcode");
  if (!postcode) return jsonResponse({ error: "POSTCODE_REQUIRED" }, 400);

  const cleanPc = postcode.replace(/\s+/g, "").toUpperCase();

  const searchUrl =
    "https://reports.ofsted.gov.uk/search" +
    `?q=&location=${encodeURIComponent(cleanPc)}` +
    "&radius=3" +
    "&status%5B%5D=1";

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    cf: { scrapeShield: false },
  });

  const html = await res.text();

  if (!res.ok) {
    return jsonResponse(
      { error: "OFSTED_SEARCH_FAILED", status: res.status, body: html.slice(0, 5000) },
      502
    );
  }

  const results = [];
  const liRegex = /<li class="search-result">([\s\S]*?)<\/li>/g;
  let match;

  while ((match = liRegex.exec(html)) !== null) {
    const block = match[1];

    let name = "";
    let href = "";
    const nameMatch = block.match(
      /<h3[^>]*class="search-result__title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
    );
    if (nameMatch) {
      href = decodeHtmlEntities(nameMatch[1]);
      name = stripTags(decodeHtmlEntities(nameMatch[2]));
    }

    let category = "";
    const catMatch = block.match(/Category:\s*<strong>([\s\S]*?)<\/strong>/);
    if (catMatch) category = stripTags(decodeHtmlEntities(catMatch[1]));

    let address = "";
    const addrMatch = block.match(
      /<address[^>]*class="search-result__address"[^>]*>([\s\S]*?)<\/address>/
    );
    if (addrMatch) address = stripTags(decodeHtmlEntities(addrMatch[1]));

    let distanceText = "";
    let distanceKm = null;
    const distMatch = block.match(
      /<strong[^>]*class="address-distance"[^>]*>([\s\S]*?)<\/strong>/
    );
    if (distMatch) {
      distanceText = stripTags(decodeHtmlEntities(distMatch[1]));
      const milesMatch = distanceText.match(/([\d.]+)\s*miles?/i);
      if (milesMatch) {
        const miles = parseFloat(milesMatch[1]);
        if (!isNaN(miles)) distanceKm = miles * 1.60934;
      }
    }

    let rating = "";
    const ratingMatch = block.match(/Rating:\s*<strong>([\s\S]*?)<\/strong>/);
    if (ratingMatch) rating = stripTags(decodeHtmlEntities(ratingMatch[1]));

    let latestReport = "";
    const reportMatch = block.match(
      /Latest report:\s*<strong>\s*<time[^>]*>([\s\S]*?)<\/time>/
    );
    if (reportMatch) latestReport = stripTags(decodeHtmlEntities(reportMatch[1]));

    let urn = "";
    const urnMatch = block.match(/URN:\s*<strong>([\s\S]*?)<\/strong>/);
    if (urnMatch) urn = stripTags(decodeHtmlEntities(urnMatch[1]));

    if (!name) continue;

    results.push({
      name,
      urn,
      category,
      address,
      distance_text: distanceText,
      distance_km: distanceKm,
      rating,
      latest_report: latestReport,
      href,
    });
  }

  return jsonResponse({ schools: results });
}

// ------------------------------------------------------------
//  EPC / GENERIC PROXY
// ------------------------------------------------------------

async function handleProxyRequest(url) {
  const target = url.searchParams.get("url");
  if (!target) return jsonResponse({ error: "URL_REQUIRED" }, 400);

  const headers = {};

  if (target.includes("epc.opendatacommunities.org")) {
    if (EPC_AUTH_HEADER) headers["Authorization"] = EPC_AUTH_HEADER;
    headers["Accept"] = "application/json";
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
  }

  const res = await fetch(target, {
    headers,
    cf: {
      cacheEverything: false,
      scrapeShield: false,
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (data !== null) {
    return jsonResponse(data, res.status);
  }

  if (target.includes("epc.opendatacommunities.org")) {
    return jsonResponse(
      {
        error: "EPC_NON_JSON_RESPONSE",
        message: "EPC returned HTML instead of JSON. Usually EPC blocking Workers.",
        raw: text.slice(0, 5000),
      },
      502
    );
  }

  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "text/plain",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}

// ------------------------------------------------------------
//  PPI MODULE — LAND REGISTRY SPARQL
// ------------------------------------------------------------

async function handlePpiRequest(url) {
  const postcode = url.searchParams.get("postcode");
  if (!postcode) return jsonResponse({ error: "POSTCODE_REQUIRED" }, 400);

  const spacedPc =
    postcode.replace(/\s+/g, "").toUpperCase().slice(0, -3) +
    " " +
    postcode.replace(/\s+/g, "").toUpperCase().slice(-3);

  const sparql = `
prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
prefix owl: <http://www.w3.org/2002/07/owl#>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
prefix sr: <http://data.ordnancesurvey.co.uk/ontology/spatialrelations/>
prefix ukhpi: <http://landregistry.data.gov.uk/def/ukhpi/>
prefix lrppi: <http://landregistry.data.gov.uk/def/ppi/>
prefix skos: <http://www.w3.org/2004/02/skos/core#>
prefix lrcommon: <http://landregistry.data.gov.uk/def/common/>

SELECT ?paon ?saon ?street ?town ?county ?postcode ?amount ?date ?category
WHERE {
  VALUES ?postcode {"${spacedPc}"^^xsd:string}

  ?addr lrcommon:postcode ?postcode.

  ?transx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date ;
          lrppi:transactionCategory/skos:prefLabel ?category.

  OPTIONAL {?addr lrcommon:county ?county}
  OPTIONAL {?addr lrcommon:paon ?paon}
  OPTIONAL {?addr lrcommon:saon ?saon}
  OPTIONAL {?addr lrcommon:street ?street}
  OPTIONAL {?addr lrcommon:town ?town}
}
ORDER BY DESC(?date)
`;

  const res = await fetch("https://landregistry.data.gov.uk/landregistry/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      "Accept": "application/sparql-results+json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    body: sparql,
    cf: {
      cacheEverything: false,
      scrapeShield: false,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return jsonResponse(
      {
        error: "PPI_SPARQL_ERROR",
        status: res.status,
        body: text.slice(0, 5000),
      },
      502
    );
  }

  const json = await res.json().catch(() => null);
  if (!json || !json.results || !Array.isArray(json.results.bindings)) {
    return jsonResponse({ error: "PPI_BAD_RESPONSE", raw: json }, 502);
  }

  const bindings = json.results.bindings;

  const transactions = bindings.map((b) => {
    const get = (k) => (b[k] && b[k].value) || "";
    const amount = parseFloat(get("amount")) || 0;
    const date = get("date");
    return {
      paon: get("paon"),
      saon: get("saon"),
      street: get("street"),
      town: get("town"),
      county: get("county"),
      postcode: get("postcode"),
      amount,
      date,
      category: get("category"),
    };
  });

  return jsonResponse({ transactions });
}

// ------------------------------------------------------------
//  MAIN HANDLER
// ------------------------------------------------------------

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "Content-Type, Authorization",
          "access-control-allow-methods": "GET, OPTIONS",
        },
      });
    }

    if (url.searchParams.get("schools") === "1") {
      return await handleSchoolsRequest(url);
    }

    if (url.searchParams.get("ppi") === "1") {
      return await handlePpiRequest(url);
    }

    if (url.searchParams.get("url")) {
      return await handleProxyRequest(url);
    }

    return jsonResponse({ error: "INVALID_REQUEST" }, 400);
  },
};
