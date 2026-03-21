// Configuration
const RATE_LIMIT_COUNT = 10; // Max 10 searches...
const RATE_LIMIT_PERIOD = 60; // ...per 60 seconds

// Temporary in-memory cache (Reset when worker instance restarts)
const ipCache = {};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    const clientIP = request.headers.get("CF-Connecting-IP") || "anonymous";

    // 1. RATE LIMIT CHECK
    const now = Math.floor(Date.now() / 1000);
    if (!ipCache[clientIP]) {
      ipCache[clientIP] = { count: 1, reset: now + RATE_LIMIT_PERIOD };
    } else {
      if (now > ipCache[clientIP].reset) {
        // Reset window passed
        ipCache[clientIP] = { count: 1, reset: now + RATE_LIMIT_PERIOD };
      } else {
        // Still in window
        ipCache[clientIP].count++;
      }
    }

    if (ipCache[clientIP].count > RATE_LIMIT_COUNT) {
      return new Response(JSON.stringify({ 
        error: "RATE_LIMIT_EXCEEDED", 
        message: "Slow down. High-frequency auditing detected." 
      }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. CORS PREFLIGHT
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (!targetUrl) return new Response("Missing URL", { status: 400 });

    const headers = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    });

    // 3. VAULT INJECTION
    if (targetUrl.includes("epc.opendatacommunities.org")) {
      // Ensure you set EPC_TOKEN in Cloudflare Settings -> Variables
      headers.set("Authorization", `Basic ${env.EPC_TOKEN}`);
    }

    try {
      const response = await fetch(targetUrl, { headers });
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      
      // Add rate limit info to headers so the UI knows
      newResponse.headers.set("X-RateLimit-Remaining", (RATE_LIMIT_COUNT - ipCache[clientIP].count).toString());
      
      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
  }
};
