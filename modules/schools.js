// src/modules/schools.js — £PER v14 Schools Module (v28)

import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=28";

export async function fetchSchools(postcode) {
  const res = await workerFetch({ schools: 1, postcode });
  state.schools = res;
}