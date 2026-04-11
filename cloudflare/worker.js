export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // ============================================================
    //  EPC PROXY (unchanged — frontend uses ?url=)
    // ============================================================
    if (url.searchParams.has("url")) {
      const target = url.searchParams.get("url");

      const res = await fetch(target, {
        headers: {
          Authorization: "Basic " + env.EPC_TOKEN,
        },
      });

      const data = await res.text();

      return new Response(data, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ============================================================
    //  PPI (REAL) — v14 format: ?ppi=1&postcode=NW90AA
    // ============================================================
    if (url.searchParams.get("ppi") === "1") {
      const postcode = url.searchParams.get("postcode");
      if (!postcode) {
        return json({ error: "Missing postcode" });
      }

      // Build Land Registry SPARQL URL (same as v13)
      const clean = postcode.replace(/\s+/g, "").toUpperCase();

      const target =
        "https://landregistry.data.gov.uk/app/ppd/ppd_data.sparql?query=" +
        encodeURIComponent(`
          PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
          PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

          SELECT ?paon ?street ?amount ?date
          WHERE {
            ?trans lrppi:propertyAddress ?addr ;
                    lrppi:pricePaid ?amount ;
                    lrppi:transactionDate ?date .
            ?addr lrppi:postcode "${clean}"^^xsd:string ;
                  lrppi:paon ?paon ;
                  lrppi:street ?street .
          }
          ORDER BY DESC(?date)
          LIMIT 5
        `);

      const res = await fetch(target);
      const data = await res.text();

      return jsonRaw(data, res);
    }

    // ============================================================
    //  SCHOOLS (REAL) — v14 format: ?schools=1&postcode=NW90AA
    // ============================================================
    if (url.searchParams.get("schools") === "1") {
      const postcode = url.searchParams.get("postcode");
      if (!postcode) return json({ error: "Missing postcode" });

      // Build Ofsted search URL (same as v13)
      const clean = postcode.replace(/\s+/g, "").toUpperCase();
      const target = `https://www.compare-school-performance.service.gov.uk/schools-by-postcode?postcode=${clean}`;

      const res = await fetch(target);
      const html = await res.text();

      // Extract first school block (same logic as v13)
      const nameMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const name = nameMatch ? nameMatch[1].trim() : "Unknown";

      const ratingMatch = html.match(/Overall effectiveness<\/th>\s*<td[^>]*>(.*?)<\/td>/i);
      const rating = ratingMatch ? ratingMatch[1].trim() : "Not found";

      const phaseMatch = html.match(/Phase<\/th>\s*<td[^>]*>(.*?)<\/td>/i);
      const phase = phaseMatch ? phaseMatch[1].trim() : "Unknown";

      const addressMatch = html.match(/Address<\/th>\s*<td[^>]*>(.*?)<\/td>/i);
      const address = addressMatch ? addressMatch[1].trim() : "Unknown";

      return json({
        name,
        rating,
        phase,
        address,
      });
    }

    // ============================================================
    //  HPI (PLACEHOLDER)
    // ============================================================
    if (url.searchParams.get("hpi") === "1") {
      return json({
        factor: 1.0,
        note: "HPI placeholder",
      });
    }

    // ============================================================
    //  FLOOD (PLACEHOLDER)
    // ============================================================
    if (url.searchParams.get("flood") === "1") {
      return json({
        summary: "Placeholder flood data",
        river: "N/A",
        surface: "N/A",
        groundwater: "N/A",
      });
    }

    // ============================================================
    //  RADON (PLACEHOLDER)
    // ============================================================
    if (url.searchParams.get("radon") === "1") {
      return json({
        level: "Unknown",
        note: "Radon placeholder",
      });
    }

    // ============================================================
    //  UTILITIES (PLACEHOLDER)
    // ============================================================
    if (url.searchParams.get("utilities") === "1") {
      return json({
        broadband: "Unknown",
        water: "Unknown",
        council: "Unknown",
        energy: "Unknown",
      });
    }

    // ============================================================
    //  DEFAULT
    // ============================================================
    return json({ error: "Invalid request" }, 400);
  },
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function jsonRaw(text, res) {
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}