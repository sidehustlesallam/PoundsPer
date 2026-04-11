// src/core/state.js — £PER v14 Global State (v28)

export const state = {
  epcRows: [],
  epc: null,
  epcDetail: null,
  ppi: null,
  hpiAdjustedRows: [],
  hpi: null,
  market: null,
  schools: null,
  flood: null,
  radon: null,
  utilities: null
};

export function resetState() {
  state.epcRows = [];
  state.epc = null;
  state.epcDetail = null;
  state.ppi = null;
  state.hpiAdjustedRows = [];
  state.hpi = null;
  state.market = null;
  state.schools = null;
  state.flood = null;
  state.radon = null;
  state.utilities = null;
}