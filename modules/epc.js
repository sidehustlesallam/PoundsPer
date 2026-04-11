// src/modules/epc.js
// EPC search, detail, and area lookup for £PER v14

import { state } from "../core/state.js";
import {
  cleanPostcode,
  m2ToSqft,
} from "../core/utils.js";
import {
  epcSearchByPostcode,
  epcSearchByUprn,
  epcFetchCertificate,
  isError,
} from "../core/fetcher.js";

// ---------------------------------------------------------
// Normalise EPC certificate into a clean, predictable object
// ---------------------------------------------------------
export function normaliseEpc(epcRaw) {
  const epc = epcRaw || {};

  const area = parseFloat(epc["total-floor-area"]) || 0;
  const lat = parseFloat(epc.latitude || epc["latitude"]) || null;
  const lon = parseFloat(epc.longitude || epc["longitude"]) || null;

  return {
    address: (epc.address || "").toString(),
    uprn: epc.uprn || "N/A",
    postcode: (epc.postcode || "").toString(),
    area,
    rating: epc["current-energy-rating"] || "?",
    latitude: lat,
    longitude: lon,
    localAuthority:
      epc["local-authority-label"] ||
      epc["local-authority"] ||
      null,
  };
}

// ---------------------------------------------------------
// EPC search by postcode
// ---------------------------------------------------------
export async function searchEpcByPostcode(postcode) {
  const clean = cleanPostcode(postcode);
  const res = await epcSearchByPostcode(clean);

  if (isError(res)) return res;
  if (!res.rows || res.rows.length === 0) {
    return { error: "NO_EPC_FOR_POSTCODE" };
  }

  return res.rows;
}

// ---------------------------------------------------------
// EPC search by UPRN
// ---------------------------------------------------------
export async function searchEpcByUprn(uprn) {
  const res = await epcSearchByUprn(uprn);

  if (isError(res)) return res;
  if (!res.rows || res.rows.length === 0) {
    return { error: "UPRN_NOT_FOUND" };
  }

  return res.rows;
}

// ---------------------------------------------------------
// Fetch full EPC certificate detail (RRN)
// ---------------------------------------------------------
export async function fetchEpcDetail(rrn) {
  const res = await epcFetchCertificate(rrn);
  if (isError(res)) return res;
  return res;
}

// ---------------------------------------------------------
// EPC rows by postcode (cached)
// ---------------------------------------------------------
async function getEpcRowsForPostcode(postcode) {
  const clean = cleanPostcode(postcode);

  if (state.epcRowsByPostcode[clean]) {
    return state.epcRowsByPostcode[clean];
  }

  const res = await epcSearchByPostcode(clean);
  if (isError(res)) return [];

  const rows = res.rows || [];
  state.epcRowsByPostcode[clean] = rows;
  return rows;
}

// ---------------------------------------------------------
// EPC AREA LOOKUP (postcode-only + PAON match)
// ---------------------------------------------------------
export async function lookupEpcArea(paon, postcode) {
  if (!paon || !postcode) return null;

  const rows = await getEpcRowsForPostcode(postcode);
  if (!rows.length) return null;

  const paonStr = paon.toString().toUpperCase().trim();

  const match = rows.find((r) => {
    const addr = (r.address || "").toUpperCase();
    return addr.startsWith(paonStr + " ") || addr === paonStr;
  });

  if (!match || !match["total-floor-area"]) return null;

  const sqm = parseFloat(match["total-floor-area"]);
  if (!sqm || sqm <= 0) return null;

  return {
    sqm,
    sqft: m2ToSqft(sqm),
  };
}