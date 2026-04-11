// src/modules/ppi.js — £PER v14 PPI Module (v27)

import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=26";
import { round } from "../core/utils.js?v=26";

export async function fetchPpi(postcode) {
  const res = await workerFetch({ ppi: 1, postcode });
  state.ppi = res;
}

export async function enrichPpiWithAreas(postcode) {
  if (!state.ppi) return;
  state.ppiEnriched = {
    ...state.ppi,
    postcode
  };
}

export async function applyHpiAdjustments(localAuthority) {
  const res = await workerFetch({ hpi: 1, la: localAuthority });
  state.hpi = res;
}

export function computeMarketAverages() {
  const avg = {
    low: null,
    mid: null,
    high: null
  };

  const rows = Array.isArray(state.ppi?.rows) ? state.ppi.rows : [];
  const amounts = rows
    .map((r) => Number(r.amount))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (amounts.length > 0) {
    const midIndex = Math.floor(amounts.length / 2);
    avg.low = round(amounts[0], 0);
    avg.high = round(amounts[amounts.length - 1], 0);
    avg.mid = round(
      amounts.length % 2 === 0
        ? (amounts[midIndex - 1] + amounts[midIndex]) / 2
        : amounts[midIndex],
      0
    );
  } else if (state.ppi && Number.isFinite(Number(state.ppi.median))) {
    avg.mid = round(Number(state.ppi.median), 0);
  }

  state.market = avg;
  return avg;
}