// src/core/state.js — £PER v14 Global State (v26)

export const state = {
  epc: null,
  epcDetail: null,
  ppi: null,
  ppiEnriched: null,
  hpi: null,
  market: null,
  schools: null,
  flood: null,
  radon: null,
  utilities: null
};

export function resetState() {
  state.epc = null;
  state.epcDetail = null;
  state.ppi = null;
  state.ppiEnriched = null;
  state.hpi = null;
  state.market = null;
  state.schools = null;
  state.flood = null;
  state.radon = null;
  state.utilities = null;
}