// src/core/state.js
// Centralised frontend state for £PER v14 (Hybrid Layout)

export const state = {
  // EPC
  epc: null,              // Normalised EPC object
  epcDetail: null,        // Raw EPC certificate detail
  epcRowsByPostcode: {},  // Cached EPC search rows keyed by postcode

  // Market Evidence
  ppi: [],                // Raw PPI transactions
  ppiEnriched: [],        // PPI + EPC area + HPI adjustments

  // Education
  schools: [],            // Nearest 3 schools

  // Utilities
  utilities: null,        // Broadband, water, sewerage, council tax, etc.

  // Environmental Risk
  flood: null,            // Flood risk data
  radon: null,            // Radon risk data

  // Map
  map: null,              // MapLibre instance
  mapMarker: null,        // Marker instance
};

// Reset everything (used when scanning a new property)
export function resetState() {
  state.epc = null;
  state.epcDetail = null;
  state.epcRowsByPostcode = {};

  state.ppi = [];
  state.ppiEnriched = [];

  state.schools = [];
  state.utilities = null;

  state.flood = null;
  state.radon = null;

  state.map = null;
  state.mapMarker = null;
}