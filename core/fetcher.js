// src/core/fetcher.js
// Unified network layer for £PER v14 (Hybrid Layout)

import { safeJson } from "./utils.js";

// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const WORKER_BASE = "https://lingering-snow-ccff.sidehustlesallam.workers.dev";

// EPC API base (always proxied through Worker)
const EPC_BASE = "https://epc.opendatacommunities.org/api/v1";

// ---------------------------------------------
// Low-level fetch wrapper
// ---------------------------------------------
async function rawFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const json = safeJson(text);

    if (!json) {
      return { error: "INVALID_JSON", raw: text };
    }

    return json;
  } catch (err) {
    return { error: "NETWORK_EXCEPTION", message: err.message };
  }
}

// ---------------------------------------------
// Proxy fetch (for EPC + external APIs)
// ---------------------------------------------
export async function proxyFetch(targetUrl) {
  const url = `${WORKER_BASE}?url=${encodeURIComponent(targetUrl)}`;
  return await rawFetch(url);
}

// ---------------------------------------------
// Worker fetch (for PPI, HPI, Schools, Risk, Utilities)
// ---------------------------------------------
export async function workerFetch(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${WORKER_BASE}?${qs}`;
  return await rawFetch(url);
}

// ---------------------------------------------
// EPC fetch helpers (FIXED: now uses /api/v1/...)
// ---------------------------------------------
export async function epcSearchByPostcode(postcode) {
  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  const url = `${EPC_BASE}/domestic/search?postcode=${clean}`;
  return await proxyFetch(url);
}

export async function epcSearchByUprn(uprn) {
  const url = `${EPC_BASE}/domestic/search?uprn=${uprn}`;
  return await proxyFetch(url);
}

export async function epcFetchCertificate(rrn) {
  const url = `${EPC_BASE}/domestic/certificate/${encodeURIComponent(rrn)}`;
  return await proxyFetch(url);
}

// ---------------------------------------------
// Response normalisation helpers
// ---------------------------------------------
export function isError(res) {
  return res && typeof res === "object" && "error" in res;
}

export function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}