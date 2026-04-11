// src/modules/ppi.js — £PER v14 PPI Module (v28)

import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=28";
import { round } from "../core/utils.js?v=26";

export async function fetchPpi(postcode) {
  const res = await workerFetch({ ppi: 1, postcode });
  state.ppi = res;
}

export async function applyHpiAdjustments(rows, localAuthority) {
  if (!Array.isArray(rows) || rows.length === 0) {
    state.hpiAdjustedRows = [];
    return;
  }

  const adjusted = await Promise.all(rows.map(async (row) => {
    const res = await workerFetch({
      hpi: 1,
      la: localAuthority || "UK",
      saleDate: row.date
    });

    const factor = Number(res?.factor || 1);
    const todayValue = Number(row.amount || 0) * factor;
    const areaSqm = Number(row.floorArea || 0) || null;
    const areaSqft = areaSqm ? areaSqm * 10.7639 : null;

    return {
      ...row,
      hpiFactor: factor,
      projectedValue: round(todayValue, 0),
      pricePerSqm: areaSqm ? round(todayValue / areaSqm, 2) : null,
      pricePerSqft: areaSqft ? round(todayValue / areaSqft, 2) : null
    };
  }));

  state.hpiAdjustedRows = adjusted;
}

export function computeMarketAverages() {
  const src = state.hpiAdjustedRows.length ? state.hpiAdjustedRows : (Array.isArray(state.ppi?.rows) ? state.ppi.rows : []);

  const prices = src.map((r) => Number(r.projectedValue || r.amount)).filter((n) => Number.isFinite(n));
  const ppsqm = src.map((r) => Number(r.pricePerSqm)).filter((n) => Number.isFinite(n));
  const ppsqft = src.map((r) => Number(r.pricePerSqft)).filter((n) => Number.isFinite(n));

  const avg = {
    count: src.length,
    averagePrice: prices.length ? round(prices.reduce((a, b) => a + b, 0) / prices.length, 0) : null,
    averagePricePerSqm: ppsqm.length ? round(ppsqm.reduce((a, b) => a + b, 0) / ppsqm.length, 2) : null,
    averagePricePerSqft: ppsqft.length ? round(ppsqft.reduce((a, b) => a + b, 0) / ppsqft.length, 2) : null
  };

  state.market = avg;
  return avg;
}