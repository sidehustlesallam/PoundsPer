export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    // ============================================================
    // EPC PROXY (legacy passthrough): ?url=<full-epc-url>
    // ============================================================
    if (url.searchParams.has("url")) {
      const target = url.searchParams.get("url");
      if (!target) return json({ error: "Missing target url" }, 400);

      const res = await fetch(target, {
        headers: { Authorization: "Basic " + env.EPC_TOKEN },
      });

      const data = await res.text();
      return withCors(
        new Response(data, {
          status: res.status,
          headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
        })
      );
    }

    // ============================================================
    // EPC structured API: ?epc=search&postcode=NW90AA | ?epc=search&uprn=...
    //                     ?epc=certificate&rrn=...
    // ============================================================
    if (url.searchParams.get("epc") === "search") {
      const postcode = url.searchParams.get("postcode");
      const uprn = url.searchParams.get("uprn");

      if (!postcode && !uprn) {
        return json({ error: "Missing postcode or uprn" }, 400);
      }

      const apiBase = env.EPC_API_BASE || "https://epc.opendatacommunities.org/api/v1/domestic";
      const target = new URL(`${apiBase}/search`);
      if (postcode) target.searchParams.set("postcode", postcode.replace(/\s+/g, "").toUpperCase());
      if (uprn) target.searchParams.set("uprn", uprn);

      const data = await fetchJsonWithAuth(target.toString(), env.EPC_TOKEN);
      if (data.error) return json(data, 502);

      return json({ rows: Array.isArray(data.rows) ? data.rows : [] });
    }

    if (url.searchParams.get("epc") === "certificate") {
      const rrn = url.searchParams.get("rrn");
      if (!rrn) return json({ error: "Missing rrn" }, 400);

      const apiBase = env.EPC_API_BASE || "https://epc.opendatacommunities.org/api/v1/domestic";
      const target = `${apiBase}/certificate/${encodeURIComponent(rrn)}`;

      const data = await fetchJsonWithAuth(target, env.EPC_TOKEN);
      if (data.error) return json(data, 502);

      const row = Array.isArray(data.rows) ? data.rows[0] || null : null;
      if (!row) return json({ error: "EPC certificate not found" }, 404);
      return json(row);
    }

    // ============================================================
    // PPI (REAL) — ?ppi=1&postcode=NW90AA
    // ============================================================
    if (url.searchParams.get("ppi") === "1") {
      const postcode = url.searchParams.get("postcode");
      if (!postcode) return json({ error: "Missing postcode" }, 400);

      const clean = postcode.replace(/\s+/g, "").toUpperCase();
      const sparql = `
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
        LIMIT 10
      `;

      const target =
        "https://landregistry.data.gov.uk/app/ppd/ppd_data.sparql?query=" +
        encodeURIComponent(sparql) +
        "&output=json";

      const res = await fetch(target, {
        headers: { Accept: "application/sparql-results+json, application/json" },
      });

      const raw = await safeJsonResponse(res);
      if (!raw) return json({ error: "PPI_UPSTREAM_INVALID" }, 502);

      const bindings = raw?.results?.bindings || [];
      const rows = bindings.map((b) => ({
        paon: b.paon?.value || "",
        street: b.street?.value || "",
        amount: Number(b.amount?.value || 0),
        date: b.date?.value || "",
      }));

      const amounts = rows.map((r) => r.amount).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      const median =
        amounts.length === 0
          ? null
          : amounts.length % 2 === 0
            ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
            : amounts[Math.floor(amounts.length / 2)];

      return json({ rows, median });
    }

    // ============================================================
    // SCHOOLS — ?schools=1&postcode=NW90AA
    // ============================================================
    if (url.searchParams.get("schools") === "1") {
      const postcode = url.searchParams.get("postcode");
      if (!postcode) return json({ error: "Missing postcode" }, 400);

      const clean = postcode.replace(/\s+/g, "").toUpperCase();
      const target = `https://www.compare-school-performance.service.gov.uk/schools-by-postcode?postcode=${clean}`;

      const res = await fetch(target);
      const html = await res.text();

      const nameMatch = html.match(/<h2[^>]*class="school-name"[^>]*>(.*?)<\/h2>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const name = stripHtml(nameMatch ? nameMatch[1] : "Unknown");

      const ratingMatch = html.match(/Overall effectiveness<\/th>\s*<td[^>]*>(.*?)<\/td>/i);
      const rating = stripHtml(ratingMatch ? ratingMatch[1] : "Not found");

      const phaseMatch = html.match(/Phase<\/th>\s*<td[^>]*>(.*?)<\/td>/i);
      const phase = stripHtml(phaseMatch ? phaseMatch[1] : "Unknown");

      return json({ name, rating, phase });
    }

    // ============================================================
    // HPI (placeholder)
    // ============================================================
    if (url.searchParams.get("hpi") === "1") {
      return json({ factor: 1.0, note: "HPI placeholder" });
    }

    // ============================================================
    // FLOOD/RADON/UTILITIES
    // ============================================================
    if (url.searchParams.get("flood") === "1" || url.searchParams.get("risk") === "flood") {
      return json({ summary: "Placeholder flood data", river: "N/A", surface: "N/A", groundwater: "N/A" });
    }

    if (url.searchParams.get("radon") === "1" || url.searchParams.get("risk") === "radon") {
      return json({ level: "Unknown", note: "Radon placeholder" });
    }

    if (url.searchParams.get("utilities") === "1") {
      return json({ broadband: "Unknown", water: "Unknown", council: "Unknown", energy: "Unknown" });
    }

    return json({ error: "Invalid request" }, 400);
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

function json(obj, status = 200) {
  return withCors(
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function fetchJsonWithAuth(url, token) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: "Basic " + token, Accept: "application/json" },
    });

    const data = await safeJsonResponse(res);
    if (!data) return { error: "INVALID_JSON", status: res.status };
    if (!res.ok) return { error: "UPSTREAM_ERROR", status: res.status, data };

    return data;
  } catch (err) {
    return { error: "NETWORK_EXCEPTION", message: err.message };
  }
}

async function safeJsonResponse(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}