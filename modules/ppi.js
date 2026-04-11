// src/modules/ppi.js
// Market Evidence Engine for £PER v14 (Hybrid Layout)

import { state } from "../core/state.js";

import {
  formatMoney,
  pricePerSqft,
  pricePerM2FromSqft
} from "../core/utils.js";

import {
  workerFetch,
  isError
} from "../core/fetcher.js";

import { lookupEpcArea } from "./epc.js";


// ---------------------------------------------------------
// Fetch raw PPI transactions (5 most recent)
// ---------------------------------------------------------
export async function fetchPpi(postcode) {
  const res = await workerFetch({ ppi: 1, postcode });

  if (isError(res)) return res;

  const txs = res.transactions || [];
  state.ppi = txs;

  return txs;
}

// ---------------------------------------------------------
// Enrich PPI rows with EPC area + £/sqft
// ---------------------------------------------------------
export async function enrichPpiWithAreas(postcode) {
  const enriched = [];

  for (const t of state.ppi) {
    const addrCore = `${t.paon || ""} ${t.street || ""}`.trim();

    // EPC area lookup (postcode-only + PAON)
    let areaSqm = null;
    let areaSqft = null;

    const area = await lookupEpcArea(t.paon, postcode);
    if (area) {
      areaSqm = area.sqm;
      areaSqft = area.sqft;
    }

    // £/sqft
    let ppSqft = null;
    if (areaSqft && areaSqft > 0) {
      ppSqft = pricePerSqft(t.amount, areaSqft);
    }

    enriched.push({
      ...t,
      addrCore,
      areaSqm,
      areaSqft,
      ppSqft,
    });
  }

  state.ppiEnriched = enriched;
  return enriched;
}

// ---------------------------------------------------------
// Apply HPI adjustments to enriched PPI rows
// ---------------------------------------------------------
export async function applyHpiAdjustments(localAuthority) {
  const adjusted = [];

  for (const t of state.ppiEnriched) {
    const dateStr = t.date.split("T")[0];
    const month = dateStr.slice(0, 7);

    // Fetch HPI factor from Worker
    const hpiRes = await workerFetch({
      hpi: 1,
      la: localAuthority,
      month,
    });

    if (isError(hpiRes) || !hpiRes.factor) {
      adjusted.push({
        ...t,
        hpiFactor: null,
        adjPrice: null,
        adjPpSqft: null,
      });
      continue;
    }

    const factor = hpiRes.factor;
    const adjPrice = t.amount * factor;

    let adjPpSqft = null;
    if (t.areaSqft && t.areaSqft > 0) {
      adjPpSqft = adjPrice / t.areaSqft;
    }

    adjusted.push({
      ...t,
      hpiFactor: factor,
      adjPrice,
      adjPpSqft,
    });
  }

  state.ppiEnriched = adjusted;
  return adjusted;
}

// ---------------------------------------------------------
// Compute market averages (raw + HPI-adjusted)
// ---------------------------------------------------------
export function computeMarketAverages() {
  const rows = state.ppiEnriched;

  let totalPrice = 0;
  let totalAdjPrice = 0;

  let totalPpSqft = 0;
  let totalAdjPpSqft = 0;

  let countArea = 0;
  let countAdjArea = 0;

  for (const r of rows) {
    totalPrice += r.amount;

    if (r.adjPrice) {
      totalAdjPrice += r.adjPrice;
    }

    if (r.ppSqft) {
      totalPpSqft += r.ppSqft;
      countArea += 1;
    }

    if (r.adjPpSqft) {
      totalAdjPpSqft += r.adjPpSqft;
      countAdjArea += 1;
    }
  }

  const avgPrice = rows.length ? totalPrice / rows.length : null;
  const avgAdjPrice = rows.length ? totalAdjPrice / rows.length : null;

  const avgPpSqft = countArea ? totalPpSqft / countArea : null;
  const avgAdjPpSqft = countAdjArea ? totalAdjPpSqft / countAdjArea : null;

  const avgPpM2 = avgPpSqft ? pricePerM2FromSqft(avgPpSqft) : null;
  const avgAdjPpM2 = avgAdjPpSqft ? pricePerM2FromSqft(avgAdjPpSqft) : null;

  return {
    avgPrice,
    avgAdjPrice,
    avgPpSqft,
    avgPpM2,
    avgAdjPpSqft,
    avgAdjPpM2,
  };
}