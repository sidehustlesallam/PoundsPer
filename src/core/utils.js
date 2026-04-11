// src/core/utils.js
// Pure helper utilities for £PER v14 (Hybrid Layout)

// -----------------------------
// Postcode helpers
// -----------------------------
export function cleanPostcode(pc) {
  if (!pc) return "";
  return pc.replace(/\s+/g, "").toUpperCase();
}

export function normalisePostcode(pc) {
  const clean = cleanPostcode(pc);
  if (clean.length < 5) return clean;
  return clean.slice(0, -3) + " " + clean.slice(-3);
}

// -----------------------------
// Money formatting
// -----------------------------
export function formatMoney(value) {
  if (value === null || value === undefined || isNaN(value)) return "£0";
  return "£" + Math.round(value).toLocaleString();
}

// -----------------------------
// Area conversions
// -----------------------------
export function sqftToM2(sqft) {
  if (!sqft || sqft <= 0) return 0;
  return sqft / 10.764;
}

export function m2ToSqft(m2) {
  if (!m2 || m2 <= 0) return 0;
  return m2 * 10.764;
}

// -----------------------------
// Price-per-area conversions
// -----------------------------
export function pricePerSqft(price, sqft) {
  if (!price || !sqft || sqft <= 0) return null;
  return price / sqft;
}

export function pricePerM2FromSqft(ppSqft) {
  if (!ppSqft || ppSqft <= 0) return null;
  return ppSqft * 10.764; // Correct conversion
}

// -----------------------------
// Safe JSON parsing
// -----------------------------
export function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// -----------------------------
// HPI helpers
// -----------------------------
export function slugifyRegionName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// -----------------------------
// String helpers
// -----------------------------
export function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim();
}