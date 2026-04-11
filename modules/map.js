// src/modules/map.js
// MapLibre integration for £PER v14 (Hybrid Layout)

import { state } from "../core/state.js";

// ---------------------------------------------------------
// Initialise the map (square container in the header)
// ---------------------------------------------------------
export function initMap(containerId = "map") {
  if (!window.maplibregl) {
    console.error("MapLibre GL not loaded");
    return null;
  }

  // Destroy previous map instance if it exists
  if (state.map) {
    try {
      state.map.remove();
    } catch (e) {}
  }

  const map = new maplibregl.Map({
    container: containerId,
    style: "https://demotiles.maplibre.org/style.json",
    center: [-0.1, 51.5], // Default London centre
    zoom: 12,
    attributionControl: false,
  });

  state.map = map;

  // Add zoom controls (top-right)
  map.addControl(new maplibregl.NavigationControl(), "top-right");

  return map;
}

// ---------------------------------------------------------
// Add or update the marker on the map
// ---------------------------------------------------------
export function updateMapMarker(lat, lon) {
  if (!state.map) return;

  // Remove old marker if exists
  if (state.mapMarker) {
    try {
      state.mapMarker.remove();
    } catch (e) {}
  }

  if (!lat || !lon) return;

  const marker = new maplibregl.Marker({ color: "#0078FF" })
    .setLngLat([lon, lat])
    .addTo(state.map);

  state.mapMarker = marker;

  // Smoothly move map to the marker
  state.map.flyTo({
    center: [lon, lat],
    zoom: 16,
    speed: 0.8,
  });
}

// ---------------------------------------------------------
// Convenience helper: initialise + place marker
// ---------------------------------------------------------
export function renderMap(lat, lon) {
  if (!state.map) {
    initMap("map");
  }
  updateMapMarker(lat, lon);
}