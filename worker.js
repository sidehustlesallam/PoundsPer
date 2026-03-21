/**
 * £Per | Hyper-Stealth Proxy v10.3
 * Purpose: Bypassing Advanced Bot-Detection & Rate Limits
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

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

    // Rotate common real-world browser headers
    const headers = new Headers({
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
    });

    const auth = request.headers.get("Authorization");
    if (auth) headers.set("Authorization", auth);

    try {
      const response = await fetch(targetUrl, { headers });
      
      // If we get an error from the Gov API, let's catch it here 
      // instead of letting the browser try to parse HTML as JSON.
      if (!response.ok) {
        return new Response(JSON.stringify({ 
          error: "GOV_API_REJECTED_REQUEST", 
          status: response.status 
        }), {
          status: 200, // Return 200 so the app doesn't crash, but sends the error as JSON
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
  }
};
