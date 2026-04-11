// src/modules/utilities.js — £PER v14 Utilities Module (v28)

import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=28";

export async function fetchUtilities(postcode) {
  const res = await workerFetch({ utilities: 1, postcode });
  state.utilities = res;
}