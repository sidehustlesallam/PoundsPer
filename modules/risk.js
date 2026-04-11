// src/modules/risk.js — £PER v14 Risk Module (v26)

import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=26";

export async function fetchFloodRisk(postcode) {
  const res = await workerFetch({ risk: "flood", postcode });
  state.flood = res;
}

export async function fetchRadonRisk(postcode) {
  const res = await workerFetch({ risk: "radon", postcode });
  state.radon = res;
}