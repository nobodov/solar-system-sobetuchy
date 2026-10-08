// Interactive map of the Solar System scale model (MapLibre GL v5).
// createSolarMap() is shared by the landing-page preview and the full app;
// initApp() wires the control panel of map.html.

import {
  SUN, BODIES, DEFAULT_SUN, DEFAULT_ZOOM, DEFAULT_SCALE, SCALE_PRESETS,
  modelDistanceM, modelDiameterM, scaleForSunDiameter, geodesicCircle,
  formatDistance, formatSize, formatScale, parseNumber,
} from './bodies.js';

const UI_TEXT = {
  placeSun: 'Umístit Slunce do mapy',
  placeSunActive: 'Klikněte do mapy… (Esc zruší)',
  customScale: 'Vlastní',
  presetLabel: (scale, neptuneM) => `${formatScale(scale)} (Neptun ${formatDistance(neptuneM)})`,
};

// Front-end key for the Mapy.com REST API; it is visible in the browser anyway,
// so restrict it to the site's domains at developer.mapy.com.
const MAPY_API_KEY = 'nOfdiBE6KWFlFBblHAJVuQlYCj6a4HTuGtTZLw7Fbsc';

const LABEL_FONT = ['Noto Sans Bold'];
const DEMO_GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
const DEFAULT_BASEMAP = 'mapy';

const BASEMAPS = {
  mapy: {
    label: 'Mapy.com (turistická)',
    style: {
      version: 8,
      glyphs: DEMO_GLYPHS,
      sources: {
        mapy: {
          type: 'raster',
          tiles: [`https://api.mapy.com/v1/maptiles/outdoor/256@2x/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`],
          tileSize: 256,
          maxzoom: 19,
          attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
        },
      },
      layers: [{ id: 'mapy', type: 'raster', source: 'mapy' }],
    },
  },
  osm: {
    label: 'OpenStreetMap',
    style: {
      version: 8,
      glyphs: DEMO_GLYPHS,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">přispěvatelé OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
  },
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

// The Mapy.com terms require their logo over the map while their tiles are shown.
class MapyLogoControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl mapy-logo';
    this._container.innerHTML =
      '<a href="https://mapy.com/" target="_blank" rel="noopener"><img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com"></a>';
    return this._container;
  }

  onRemove() {
    this._container.remove();
    this._map = undefined;
  }
}

export function createSolarMap(container, { interactive = true, fitOrbits = false, hiddenBodies = [] } = {}) {
  const state = {
    sun: { ...DEFAULT_SUN },
    scale: DEFAULT_SCALE,
    enabled: new Set(BODIES.filter((b) => b.enabledByDefault && !hiddenBodies.includes(b.id)).map((b) => b.id)),
    basemap: DEFAULT_BASEMAP,
  };
  const listeners = [];

  const map = new maplibregl.Map({
    container,
    style: BASEMAPS[state.basemap].style,
    center: [state.sun.lon, state.sun.lat],
    zoom: DEFAULT_ZOOM,
    interactive,
    attributionControl: { compact: true },
  });

  const mapyLogo = new MapyLogoControl();
  let mapyLogoShown = false;
  function updateMapyLogo() {
    const shouldShow = state.basemap === 'mapy';
    if (shouldShow === mapyLogoShown) return;
    if (shouldShow) map.addControl(mapyLogo, 'bottom-left');
    else map.removeControl(mapyLogo);
    mapyLogoShown = shouldShow;
  }
  updateMapyLogo();

  const sunElement = document.createElement('div');
  sunElement.className = 'sun-marker';
  sunElement.title = SUN.name;
  const sunMarker = new maplibregl.Marker({ element: sunElement, draggable: interactive })
    .setLngLat([state.sun.lon, state.sun.lat])
    .addTo(map);

  sunMarker.on('drag', () => {
    const { lng, lat } = sunMarker.getLngLat();
    state.sun = { lat, lon: lng };
    refresh();
  });

  // Custom sources/layers are dropped by setStyle(), so they are re-added on every style load.
  map.on('style.load', () => {
    addOverlay();
    updateOverlayData();
  });

  if (fitOrbits) {
    map.once('load', () => fitToOrbits());
  }

  function enabledBodies() {
    return BODIES.filter((b) => state.enabled.has(b.id));
  }

  function outermostBody() {
    const bodies = enabledBodies();
    return bodies.length ? bodies[bodies.length - 1] : null;
  }

  function buildOrbits() {
    return {
      type: 'FeatureCollection',
      features: enabledBodies().map((body) => ({
        type: 'Feature',
        properties: { id: body.id, name: body.name, color: body.color },
        geometry: { type: 'LineString', coordinates: geodesicCircle(state.sun, modelDistanceM(body, state.scale)) },
      })),
    };
  }

  function buildSunDisc() {
    const radiusM = modelDiameterM(SUN, state.scale) / 2;
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: SUN.name },
        geometry: { type: 'Polygon', coordinates: [geodesicCircle(state.sun, radiusM, 64)] },
      }],
    };
  }

  function addOverlay() {
    if (map.getSource('orbits')) return;
    map.addSource('orbits', { type: 'geojson', data: EMPTY_FC });
    map.addSource('sun-disc', { type: 'geojson', data: EMPTY_FC });

    map.addLayer({
      id: 'sun-disc-fill',
      type: 'fill',
      source: 'sun-disc',
      paint: { 'fill-color': SUN.color, 'fill-opacity': 0.85 },
    });
    map.addLayer({
      id: 'orbit-lines',
      type: 'line',
      source: 'orbits',
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: 'orbit-labels',
      type: 'symbol',
      source: 'orbits',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 350,
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT,
        'text-size': 13,
        'text-keep-upright': true,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    });
  }

  function updateOverlayData() {
    const orbits = map.getSource('orbits');
    const sunDisc = map.getSource('sun-disc');
    if (orbits) orbits.setData(buildOrbits());
    if (sunDisc) sunDisc.setData(buildSunDisc());
  }

  function refresh() {
    updateOverlayData();
    listeners.forEach((fn) => fn(getState()));
  }

  function fitToOrbits() {
    const body = outermostBody();
    if (!body) return;
    const ring = geodesicCircle(state.sun, modelDistanceM(body, state.scale), 64);
    const bounds = ring.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(ring[0], ring[0]));
    map.fitBounds(bounds, { padding: 20, duration: 0 });
  }

  function getState() {
    return {
      sun: { ...state.sun },
      scale: state.scale,
      enabled: new Set(state.enabled),
      basemap: state.basemap,
      outermostBody: outermostBody(),
    };
  }

  // --- Place-the-Sun mode ---
  let placeSunHandler = null;
  let placeSunEndCallback = null;

  function onPlaceSunKeydown(event) {
    if (event.key === 'Escape') stopPlaceSun();
  }

  function startPlaceSun(onEnd) {
    stopPlaceSun();
    placeSunEndCallback = onEnd;
    map.getCanvas().style.cursor = 'crosshair';
    placeSunHandler = (event) => {
      setSun({ lat: event.lngLat.lat, lon: event.lngLat.lng });
      stopPlaceSun();
    };
    map.once('click', placeSunHandler);
    document.addEventListener('keydown', onPlaceSunKeydown);
  }

  function stopPlaceSun() {
    if (!placeSunHandler) return;
    map.off('click', placeSunHandler);
    placeSunHandler = null;
    map.getCanvas().style.cursor = '';
    document.removeEventListener('keydown', onPlaceSunKeydown);
    const callback = placeSunEndCallback;
    placeSunEndCallback = null;
    if (callback) callback();
  }

  // --- Public setters ---
  function setSun(position) {
    state.sun = { ...position };
    sunMarker.setLngLat([position.lon, position.lat]);
    refresh();
  }

  function setScale(scale) {
    if (!Number.isFinite(scale) || scale <= 0) return;
    state.scale = scale;
    refresh();
  }

  function setBodyEnabled(id, enabled) {
    if (enabled) state.enabled.add(id);
    else state.enabled.delete(id);
    refresh();
  }

  function setBasemap(key) {
    if (!BASEMAPS[key] || key === state.basemap) return;
    state.basemap = key;
    map.setStyle(BASEMAPS[key].style, { diff: false });
    updateMapyLogo();
    listeners.forEach((fn) => fn(getState()));
  }

  function onChange(fn) {
    listeners.push(fn);
    fn(getState());
  }

  return {
    map, getState, onChange, setSun, setScale, setBodyEnabled, setBasemap,
    startPlaceSun, stopPlaceSun, fitToOrbits,
  };
}

// --- Full-screen app (map.html) ---

export function initApp() {
  const solarMap = createSolarMap('map');
  solarMap.map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
  solarMap.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  const basemapInputs = document.querySelectorAll('input[name="basemap"]');
  const placeSunButton = document.getElementById('place-sun');
  const sunCoords = document.getElementById('sun-coords');
  const scalePreset = document.getElementById('scale-preset');
  const scaleCustom = document.getElementById('scale-custom');
  const sunDiameterInput = document.getElementById('sun-diameter-input');
  const bodyTableBody = document.getElementById('body-table-body');

  // Scale presets, labelled with the resulting Neptune distance.
  const neptune = BODIES.find((b) => b.id === 'neptune');
  for (const scale of SCALE_PRESETS) {
    const option = new Option(UI_TEXT.presetLabel(scale, modelDistanceM(neptune, scale)), String(scale));
    scalePreset.add(option);
  }
  scalePreset.add(new Option(UI_TEXT.customScale, 'custom'));

  // Body table rows are created once; their cells are updated on every change.
  const rows = new Map();
  for (const body of BODIES) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" aria-label="${body.name}"></td>
      <td><span class="body-swatch" style="background:${body.color}"></span>${body.name}</td>
      <td class="num distance"></td>
      <td class="num diameter"></td>`;
    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', () => solarMap.setBodyEnabled(body.id, checkbox.checked));
    bodyTableBody.appendChild(row);
    rows.set(body.id, {
      row,
      checkbox,
      distance: row.querySelector('.distance'),
      diameter: row.querySelector('.diameter'),
    });
  }

  basemapInputs.forEach((input) => {
    input.addEventListener('change', () => solarMap.setBasemap(input.value));
  });

  placeSunButton.addEventListener('click', () => {
    placeSunButton.classList.add('active');
    placeSunButton.textContent = UI_TEXT.placeSunActive;
    solarMap.startPlaceSun(() => {
      placeSunButton.classList.remove('active');
      placeSunButton.textContent = UI_TEXT.placeSun;
    });
  });

  scalePreset.addEventListener('change', () => {
    if (scalePreset.value === 'custom') {
      scaleCustom.focus();
      return;
    }
    solarMap.setScale(Number(scalePreset.value));
  });

  scaleCustom.addEventListener('change', () => {
    const value = parseNumber(scaleCustom.value);
    if (value) solarMap.setScale(value);
  });

  sunDiameterInput.addEventListener('change', () => {
    const diameterM = parseNumber(sunDiameterInput.value);
    if (diameterM) solarMap.setScale(scaleForSunDiameter(diameterM));
  });

  solarMap.onChange((state) => {
    basemapInputs.forEach((input) => { input.checked = input.value === state.basemap; });
    sunCoords.textContent = `${state.sun.lat.toFixed(6)} N, ${state.sun.lon.toFixed(6)} E`;

    const isPreset = SCALE_PRESETS.includes(state.scale);
    scalePreset.value = isPreset ? String(state.scale) : 'custom';
    if (document.activeElement !== scaleCustom) {
      scaleCustom.value = Math.round(state.scale).toLocaleString('cs-CZ');
    }

    if (document.activeElement !== sunDiameterInput) {
      sunDiameterInput.value = modelDiameterM(SUN, state.scale).toLocaleString('cs-CZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    for (const b of BODIES) {
      const cells = rows.get(b.id);
      const enabled = state.enabled.has(b.id);
      cells.checkbox.checked = enabled;
      cells.row.classList.toggle('disabled', !enabled);
      cells.distance.textContent = formatDistance(modelDistanceM(b, state.scale));
      cells.diameter.textContent = formatSize(modelDiameterM(b, state.scale));
    }
  });

  return solarMap;
}
