// src/modules/map.js — £PER v14 Map Module (v26)

import { state } from "../core/state.js?v=26";

export function initMap(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = "";

  if (state.epc && state.epc.latitude && state.epc.longitude) {
    const p = document.createElement("p");
    p.textContent = `Lat: ${state.epc.latitude}, Lng: ${state.epc.longitude}`;
    el.appendChild(p);
  } else {
    const p = document.createElement("p");
    p.textContent = "Map will appear here when coordinates are available.";
    el.appendChild(p);
  }
}