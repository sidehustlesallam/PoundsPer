/**
 * £Per | Stealth Proxy Worker V9.2
 * Deployed to: Cloudflare Workers
 * Purpose: Bypassing CORS and Bot-Detection for UK Property APIs
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    // 1. Handle CORS Preflight (The browser's "handshake")
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (!targetUrl) {
      return new Response("Missing target URL", { status: 400 });
    }

    // 2. Construct Stealth Headers
    // This makes your request look like a standard Windows Chrome browser
    const stealthHeaders = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      "Referer": "https://www.google.com/",
      "Origin": new URL(targetUrl).origin,
    });

    // Pass through Authorization if provided (for EPC API)
    const auth = request.headers.get("Authorization");
    if (auth) {
      stealthHeaders.set("Authorization", auth);
    }

    try {
      // 3. Execute the proxied request
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: stealthHeaders,
        redirect: "follow"
      });

      // 4. Return the data with permissive CORS headers
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      
      return newResponse;
    } catch (err) {
      return new Response(`Proxy Error: ${err.message}`, { status: 500 });
    }
  }
};
