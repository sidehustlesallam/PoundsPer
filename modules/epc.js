// src/modules/epc.js — £PER v14 EPC Module (v28)

import {
  epcSearchByPostcode,
  epcSearchByUprn,
  epcFetchCertificate,
  ensureArray,
  isError
} from "../core/fetcher.js?v=26";

export async function getEpcRows({ postcode, uprn }) {
  const res = uprn ? await epcSearchByUprn(uprn) : await epcSearchByPostcode(postcode);
  if (isError(res)) return { rows: [], error: res };
  return { rows: ensureArray(res.rows), error: null };
}

export async function getEpcCertificate(rrn) {
  const res = await epcFetchCertificate(rrn);
  if (isError(res)) return { epc: null, error: res };
  const cert = normaliseEpc(res);
  return { epc: cert, error: null };
}

export function normaliseEpc(raw) {
  if (!raw) return null;
  return {
    rrn: raw.rrn || raw.lmk_key || null,
    address: raw.address || [raw.address1, raw.address2, raw.address3, raw.postcode].filter(Boolean).join(", "),
    postcode: raw.postcode || null,
    uprn: raw.uprn || null,
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    propertyType: raw.property_type || null,
    builtForm: raw.built_form || null,
    floorArea: Number(raw.total_floor_area || raw.floor_area || 0) || null,
    currentRating: raw.current_energy_rating || null,
    potentialRating: raw.potential_energy_rating || null,
    lodgementDate: raw.lodgement_date || null,
    localAuthority: raw.local_authority || null
  };
}

export function pickEpcRow(rows, index) {
  if (!rows || rows.length === 0) return null;
  return rows[index] || null;
}