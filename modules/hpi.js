// src/modules/hpi.js
// HPI factor lookup for £PER v14 (Hybrid Layout)

import { workerFetch, isError } from "../core/fetcher.js";

// ---------------------------------------------------------
// Fetch HPI factor for a given local authority + sale month
// ---------------------------------------------------------
export async function fetchHpiFactor(localAuthority, saleMonth) {
  if (!localAuthority || !saleMonth) {
    return { error: "INVALID_HPI_PARAMS" };
  }

  const res = await workerFetch({
    hpi: 1,
    la: localAuthority,
    month: saleMonth,
  });

  if (isError(res)) return res;

  // Worker guarantees: { saleHPI, todayHPI, factor, region, saleMonth, todayMonth }
  if (!res.factor || typeof res.factor !== "number") {
    return { error: "HPI_FACTOR_UNAVAILABLE" };
  }

  return {
    factor: res.factor,
    region: res.region,
    saleMonth: res.saleMonth,
    todayMonth: res.todayMonth,
  };
}

// ---------------------------------------------------------
// Convenience helper: apply HPI factor to a price
// ---------------------------------------------------------
export function applyHpiToPrice(price, factor) {
  if (!price || !factor) return null;
  return price * factor;
}