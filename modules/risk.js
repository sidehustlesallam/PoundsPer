// src/modules/risk.js — £PER v14 Risk Module (v27)


import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=26";

export async function fetchFloodRisk(postcode) {
  const res = await workerFetch({ flood: 1, postcode });
  state.flood = res;
}

export async function fetchRadonRisk(postcode) {
  const res = await workerFetch({ radon: 1, postcode });
  state.radon = res;
}