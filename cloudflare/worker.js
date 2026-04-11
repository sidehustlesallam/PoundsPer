// worker.js — £PER v14 Structured Worker API (v26)

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const params = url.searchParams;

      // -------------------------------------------------------
      // ROUTING
      // -------------------------------------------------------
      if (params.has("epc")) {
        return await handleEpc(params);
      }

      if (params.has("ppi")) {
        return await handlePpi(params);
      }

      if (params.has("hpi")) {
        return await handleHpi(params);
      }

      if (params.has("schools")) {
        return await handleSchools(params);
      }

      if (params.has("risk")) {
        return await handleRisk(params);
      }

      if (params.has("utilities")) {
        return await handleUtilities(params);
      }

      return json({ error: "NO_ROUTE", message: "No valid query parameters" });
    } catch (err) {
      return json({ error: "WORKER_EXCEPTION", message: err.message });
    }
  }
};

// -------------------------------------------------------
// EPC HANDLER
// -------------------------------------------------------
async function handleEpc(params) {
  const mode = params.get("epc"); // "search" or "certificate"

  const EPC_BASE = "https://epc.opendatacommunities.org/api/v1";
  const AUTH =
    "Basic c2lkZWh1c3RsZXNhbGxhbUBnbWFpbC5jb206OGU4YmNiNDRlYTcwYzJjYTYzYjMxMTZkZDYzYTFhMzA3YmEzMTU5ZA==";

  let target = null;

  if (mode === "search") {
    const postcode = params.get("postcode");
    const uprn = params.get("uprn");

    if (postcode) {
      const clean = postcode.replace(/\s+/g, "").toUpperCase();
      target = `${EPC_BASE}/domestic/search?postcode=${clean}`;
    } else if (uprn) {
      target = `${EPC_BASE}/domestic/search?uprn=${uprn}`;
    } else {
      return json({ error: "MISSING_PARAM", message: "postcode or uprn required" });
    }
  }

  if (mode === "certificate") {
    const rrn = params.get("rrn");
    if (!rrn) return json({ error: "MISSING_PARAM", message: "rrn required" });

    target = `${EPC_BASE}/domestic/certificate/${encodeURIComponent(rrn)}`;
  }

  if (!target) {
    return json({ error: "INVALID_EPC_MODE", message: "Unknown EPC mode" });
  }

  const res = await fetch(target, {
    headers: {
      Authorization: AUTH,
      Accept: "application/json"
    }
  });

  const text = await res.text();
  try {
    return json(JSON.parse(text));
  } catch {
    return json({ error: "INVALID_JSON", raw: text });
  }
}

// -------------------------------------------------------
// PPI / HPI / Schools / Risk / Utilities handlers
// (stubs — you can fill in your logic later)
// -------------------------------------------------------
async function handlePpi(params) {
  return json({ ok: true, type: "ppi", params: Object.fromEntries(params) });
}

async function handleHpi(params) {
  return json({ ok: true, type: "hpi", params: Object.fromEntries(params) });
}

async function handleSchools(params) {
  return json({ ok: true, type: "schools", params: Object.fromEntries(params) });
}

async function handleRisk(params) {
  return json({ ok: true, type: "risk", params: Object.fromEntries(params) });
}

async function handleUtilities(params) {
  return json({ ok: true, type: "utilities", params: Object.fromEntries(params) });
}

// -------------------------------------------------------
// JSON helper
// -------------------------------------------------------
function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
