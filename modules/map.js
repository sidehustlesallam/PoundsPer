/**
 * £Per Map Module
 * - Handles MapLibre initialization and layer rendering.
 * - This module accepts the global state and is responsible only for visualization.
 */

/**
 * Initializes the map instance and adds necessary sources and layers.
 * @param {object} state - The global application state object containing EPC data.
 */
function initMap(state) {
  if (!state.epc || state.epc.latitude == null || state.epc.longitude == null) {
    console.warn("Cannot initialize map: EPC coordinates are missing.");
    return;
  }
  
  if (state.map) return; // Already initialized

  const epc = state.epc;
  const center = [epc.longitude, epc.latitude];

  const map = new maplibregl.Map({
    container: "map",
    style: "https://demotiles.maplibre.org/style.json",
    center,
    zoom: 14,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", () => {
    state.map = map;
    
    // Add Sources and Layers (Initial setup)
    map.addSource("epc-point", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "epc-point-layer",
      type: "circle",
      source: "epc-point",
      paint: {
        "circle-radius": 6,
        "circle-color": "#38bdf8",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0f172a",
      },
    });

    map.addSource("schools-point", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "schools-point-layer",
      type: "circle",
      source: "schools-point",
      paint: {
        "circle-radius": 4,
        "circle-color": "#22c55e",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0f172a",
      },
    });

    map.addSource("ppi-point", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "ppi-point-layer",
      type: "circle",
      source: "ppi-point",
      paint: {
        "circle-radius": 3,
        "circle-color": "#f97316",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0f172a",
      },
    });
    
    // Initialize state map layers
    state.mapLayers.epc = "epc-point-layer";
    state.mapLayers.schools = "schools-point-layer";
    state.mapLayers.ppi = "ppi-point-layer";
    state.mapLayers.flood = null;
    state.mapLayers.radon = null;

    updateMapLayers(state);
  });
}

/**
 * Updates all map layers based on the current state.
 * @param {object} state - The global application state object.
 */
function updateMapLayers(state) {
  const map = state.map;
  if (!map) return;

  const epc = state.epc;
  const schools = state.schools || [];
  const ppi = state.ppi || [];

  // Update EPC Point
  if (epc && epc.latitude != null && epc.longitude != null) {
    const epcSource = map.getSource("epc-point");
    if (epcSource) {
      epcSource.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [epc.longitude, epc.latitude],
          },
          properties: {
            title: epc.address,
            rating: epc.rating,
          },
        }],
      });
    }
  }

  // Update School Points
  const schoolSource = map.getSource("schools-point");
  if (schoolSource) {
    schoolSource.setData({
      type: "FeatureCollection",
      features: schools.map((s, idx) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [epc.longitude + 0.002 * (idx + 1), epc.latitude + 0.002 * (idx + 1)],
        },
        properties: {
          title: s.name,
          rating: s.rating,
        },
      })),
    });
  }

  // Update PPI Points
  const ppiSource = map.getSource("ppi-point");
  if (ppiSource) {
    ppiSource.setData({
      type: "FeatureCollection",
      features: ppi.map((t, idx) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [epc.longitude - 0.002 * (idx + 1), epc.latitude - 0.002 * (idx + 1)],
        },
        properties: {
          amount: t.amount,
        },
      })),
    });
  }

  // Toggle visibility
  Object.entries(state.mapLayers).forEach(([key, layerId]) => {
    if (!layerId) return;
    const visible = state.activeLayers[key];
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    }
  });
}

/**
 * Toggles the visibility of a map layer.
 * @param {string} layerKey - The key of the layer (e.g., 'epc', 'schools').
 */
window.toggleLayer = function (layerKey) {
  const state = window.__PER_STATE__;
  state.activeLayers[layerKey] = !state.activeLayers[layerKey];

  const buttons = document.querySelectorAll(`[data-layer="${layerKey}"]`);
  buttons.forEach((btn) => {
    if (state.activeLayers[layerKey]) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  updateMapLayers(state);
};

export {
  initMap,
  updateMapLayers,
  toggleLayer
};