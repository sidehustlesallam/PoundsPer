// src/core/fetcher.js — £PER v14 Structured Network Layer (v26)

import { safeJson } from "./utils.js?v=26";

// -------------------------------------------------------
// CONFIG
// -------------------------------------------------------

const WORKER_BASE = "https://lingering-snow-ccff.sidehustlesallam.workers.dev";

// -------------------------------------------------------
// Low-level fetch wrapper
// -------------------------------------------------------
async function rawFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const json = safeJson(text);

    if (!json) {
      console.error(`[fetcher] Failed to parse JSON from ${url}:`, text);
      return { error: "INVALID_JSON", raw: text, status: res.status };
    }

    return json;
  } catch (err) {
    console.error(`[fetcher] Network error fetching ${url}:`, err);
    return { error: "NETWORK_EXCEPTION", message: err.message, status: 0 };
  }
}

// -------------------------------------------------------
// Structured Worker fetch
// --------------------------------------------------
export async function workerFetch(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${WORKER_BASE}?${qs}`;
  console.log(`[fetcher] Calling worker endpoint: ${url}`);
  return await rawFetch(url);
}

// -------------------------------------------------------
// EPC helpers (structured Worker API)
// -------------------------------------------------------
export async function epcSearchByPostcode(postcode) {
  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  return await workerFetch({
    epc: "search",
    postcode: clean
  });
}

export async function epcSearchByUprn(uprn) {
  return await workerFetch({
    epc: "search",
    uprn
  });
}

export async function epcFetchCertificate(rrn) {
  return await workerFetch({
    epc: "certificate",
    rrn
  });
}

// -------------------------------------------------------
// Response helpers
// -------------------------------------------------------
export function isError(res) {
  return res && typeof res === "object" && "error" in res;
}

export function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}