// worker.js
// Cloudflare Worker backend for £PER v14
//
// Responsibilities:
// - Generic proxy (?url=...)
// - PPI stub endpoint (?ppi=1&postcode=...)
// - HPI stub endpoint (?hpi=1&la=...&month=...)
// - Schools stub endpoint (?schools=1&postcode=...)
// - Utilities stub endpoint (?utilities=1&postcode=...)
// - Flood stub endpoint (?flood=1&postcode=...)
// - Radon stub endpoint (?radon=1&postcode=...)
//
// NOTE: External API calls are left as placeholders.
// Replace stubs with real fetches when you’re ready.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const params = url.searchParams;

    // 1) Generic proxy: ?url=...
    const targetUrl = params.get("url");
    if (targetUrl) {
      return proxyRequest(targetUrl, env);
    }

    // 2) PPI: ?ppi=1&postcode=...
    if (params.get("ppi")) {
      const postcode = params.get("postcode") || "";
      return jsonResponse(mockPpi(postcode));
    }

    // 3) HPI: ?hpi=1&la=...&month=...
    if (params.get("hpi")) {
      const la = params.get("la") || "";
      const month = params.get("month") || "";
      return jsonResponse(mockHpi(la, month));
    }

    // 4) Schools: ?schools=1&postcode=...
    if (params.get("schools")) {
      const postcode = params.get("postcode") || "";
      return jsonResponse(mockSchools(postcode));
    }

    // 5) Utilities: ?utilities=1&postcode=...
    if (params.get("utilities")) {
      const postcode = params.get("postcode") || "";
      return jsonResponse(mockUtilities(postcode));
    }

    // 6) Flood: ?flood=1&postcode=...
    if (params.get("flood")) {
      const postcode = params.get("postcode") || "";
      return jsonResponse(mockFlood(postcode));
    }

    // 7) Radon: ?radon=1&postcode=...
    if (params.get("radon")) {
      const postcode = params.get("postcode") || "";
      return jsonResponse(mockRadon(postcode));
    }

    return jsonResponse({ error: "NO_ROUTE" }, 404);
  },
};

// -----------------------------
// Generic proxy (for EPC, etc.)
// -----------------------------
async function proxyRequest(targetUrl, env) {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        // Example for EPC:
        // Authorization: "Basic " + env.EPC_API_KEY,
      },
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return jsonResponse(
      { error: "PROXY_ERROR", message: err.message || "Proxy failed" },
      500
    );
  }
}

// -----------------------------
// Helpers
// -----------------------------
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// -----------------------------
// STUB IMPLEMENTATIONS
// Replace with real APIs later
// -----------------------------

// PPI: returns 5 fake transactions
function mockPpi(postcode) {
  const today = new Date();
  const iso = (offsetMonths) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - offsetMonths);
    return d.toISOString();
  };

  return {
    transactions: [
      {
        date: iso(1),
        paon: "10",
        street: "Example Road",
        amount: 450000,
      },
      {
        date: iso(3),
        paon: "12",
        street: "Example Road",
        amount: 470000,
      },
      {
        date: iso(5),
        paon: "8",
        street: "Example Road",
        amount: 440000,
      },
      {
        date: iso(7),
        paon: "6",
        street: "Example Road",
        amount: 430000,
      },
      {
        date: iso(9),
        paon: "4",
        street: "Example Road",
        amount: 420000,
      },
    ],
  };
}

// HPI: returns a simple factor
function mockHpi(localAuthority, month) {
  return {
    saleHPI: 100,
    todayHPI: 115,
    factor: 1.15,
    region: localAuthority || "Mock Region",
    saleMonth: month || "2024-01",
    todayMonth: "2026-04",
  };
}

// Schools: 3 fake schools
function mockSchools(postcode) {
  return {
    schools: [
      {
        name: "Example Primary School",
        rating: "Outstanding",
        category: "Primary",
        distance_text: "0.3 miles",
      },
      {
        name: "Example Secondary School",
        rating: "Good",
        category: "Secondary",
        distance_text: "0.8 miles",
      },
      {
        name: "Example Academy",
        rating: "Requires Improvement",
        category: "All-through",
        distance_text: "1.2 miles",
      },
    ],
  };
}

// Utilities: simple mock bundle
function mockUtilities(postcode) {
  return {
    broadband: {
      tech: "FTTP",
      maxDown: "900 Mbps",
      providers: ["BT", "Sky", "Virgin Media"],
    },
    water: {
      water: "Thames Water",
      sewerage: "Thames Water",
    },
    councilTax: {
      band: "D",
      authority: "Mock Borough Council",
    },
    energy: {
      region: "London",
    },
  };
}

// Flood: simple mock
function mockFlood(postcode) {
  return {
    summary: "Low risk",
    river: "Very low",
    surface: "Low",
    groundwater: "N/A",
  };
}

// Radon: simple mock
function mockRadon(postcode) {
  return {
    band: "1-3%",
    percentage: "1-3%",
  };
}
