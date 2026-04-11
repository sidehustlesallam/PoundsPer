// src/modules/schools.js — £PER v14 Schools Module (v26)

import { workerFetch } from "../core/fetcher.js?v=26";
import { state } from "../core/state.js?v=26";

export async function fetchSchools(postcode) {
  const res = await workerFetch({ schools: 1, postcode });
  state.schools = res;
}