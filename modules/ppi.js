// src/modules/ppi.js — £PER v14 PPI Module (v26)

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

  if (state.ppi && state.ppi.median) {
    avg.mid = round(state.ppi.median, 0);
  }

  state.market = avg;
  return avg;
}