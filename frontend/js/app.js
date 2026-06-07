// === SiteScout main application ===

let map, drawnItems, inactiveGridLayer, scoreLayer;
let currentBisnis = null;
let userVariables = {};
let userWeights = {};
let userGroupWeights = {};
let scoredCells = [];
let selectedPoints = [];
let isAnalyzing = false;
let customGroupCount = 0;
let varCounters = {};
let jakartaGridMask = null;
let selectedMarketAreaIds = ['jakarta'];
let layerVisibility = {
  planningGrid: true,
  scoreHeatmap: true,
  selectedSites: true,
  legend: true,
  rawPointApotek: false,
  rawPointMinimarket: false,
  rawPointRestoran: false,
  rawPointKlinik: false,
  rawPointKantor: false,
  rawLineJalan: false,
  rawPolygonZonasi: false,
  rawPolygonLahan: false
};

const MARKET_AREAS = {
  jakarta: { id: 'jakarta', label: 'Jakarta', bounds: [[-6.37, 106.68], [-6.08, 106.98]], supportsMask: true },
  bogor: { id: 'bogor', label: 'Bogor', bounds: [[-6.67, 106.73], [-6.47, 106.88]], supportsMask: false },
  depok: { id: 'depok', label: 'Depok', bounds: [[-6.49, 106.74], [-6.33, 106.89]], supportsMask: false },
  tangerang: { id: 'tangerang', label: 'Tangerang', bounds: [[-6.25, 106.53], [-6.08, 106.71]], supportsMask: false },
  bekasi: { id: 'bekasi', label: 'Bekasi', bounds: [[-6.33, 106.90], [-6.15, 107.05]], supportsMask: false }
};
const GRID_CELL_SIZE = 0.015;
const COMPETITOR_CATEGORY = {
  apotek: 'Apotek',
  minimarket: 'Minimarket',
  restoran: 'Restoran',
  klinik: 'Klinik',
  kantor: 'Kantor'
};

const RAW_LAYER_CONFIG = {
  rawPointApotek: {
    checkboxId: 'layer-raw-point-apotek',
    label: 'Apotek',
    pane: 'rawPointPane',
    geometry: 'point',
    color: '#57ffac',
    loader: () => loadRawPOILayer('Apotek')
  },
  rawPointMinimarket: {
    checkboxId: 'layer-raw-point-minimarket',
    label: 'Minimarket',
    pane: 'rawPointPane',
    geometry: 'point',
    color: '#4ea1ff',
    loader: () => loadRawPOILayer('Minimarket')
  },
  rawLineJalan: {
    checkboxId: 'layer-raw-line-jalan',
    label: 'Jalan',
    pane: 'rawLinePane',
    geometry: 'line',
    color: '#ffd166',
    loader: loadRawRoadLayer
  },
  rawPolygonZonasi: {
    checkboxId: 'layer-raw-polygon-zonasi',
    label: 'Zonasi',
    pane: 'rawPolygonPane',
    geometry: 'polygon',
    color: '#ff7f50',
    loader: loadRawZoningLayer
  },
  rawPointRestoran: {
    checkboxId: 'layer-raw-point-restoran',
    label: 'Restoran',
    pane: 'rawPointPane',
    geometry: 'point',
    color: '#ff6b6b',
    loader: () => loadRawPOILayer('Restoran')
  },
  rawPointKlinik: {
    checkboxId: 'layer-raw-point-klinik',
    label: 'Klinik',
    pane: 'rawPointPane',
    geometry: 'point',
    color: '#c084fc',
    loader: () => loadRawPOILayer('Klinik')
  },
  rawPointKantor: {
    checkboxId: 'layer-raw-point-kantor',
    label: 'Kantor',
    pane: 'rawPointPane',
    geometry: 'point',
    color: '#f97316',
    loader: () => loadRawPOILayer('Kantor')
  },
  rawPolygonLahan: {
    checkboxId: 'layer-raw-polygon-lahan',
    label: 'Penggunaan Lahan',
    pane: 'rawPolygonPane',
    geometry: 'polygon',
    color: '#34d399',
    loader: loadRawLahanLayer
  }
};

const rawLayerState = Object.keys(RAW_LAYER_CONFIG).reduce((acc, key) => {
  acc[key] = { layer: null, loading: false };
  return acc;
}, {});

function normalizeMarketSelection(areaIds) {
  const cleaned = Array.from(new Set((areaIds || []).filter(id => Boolean(MARKET_AREAS[id]))));
  return cleaned.length > 0 ? cleaned : ['jakarta'];
}

function getSelectedAreaBounds() {
  const ids = normalizeMarketSelection(selectedMarketAreaIds);
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  ids.forEach(id => {
    const [sw, ne] = MARKET_AREAS[id].bounds;
    minLat = Math.min(minLat, sw[0]);
    minLng = Math.min(minLng, sw[1]);
    maxLat = Math.max(maxLat, ne[0]);
    maxLng = Math.max(maxLng, ne[1]);
  });
  return [[minLat, minLng], [maxLat, maxLng]];
}

function getSelectedAreaLabel(options = {}) {
  const compact = options.compact === true;
  const ids = normalizeMarketSelection(selectedMarketAreaIds);
  const labels = ids.map(id => MARKET_AREAS[id].label);
  if (labels.length === 1) return labels[0];
  if (!compact) return labels.join(', ');
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  return `${labels[0]} +${labels.length - 1} kota`;
}

function expandMaskToBoundaryIntersections(rawMask, cellSize) {
  const expanded = new Set();
  rawMask.forEach(cellId => {
    const parts = cellId.replace('cell_', '').split('_');
    if (parts.length !== 2) return;
    const baseLat = Number(parts[0]);
    const baseLng = Number(parts[1]);
    if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) return;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const lat = baseLat + (dy * cellSize);
        const lng = baseLng + (dx * cellSize);
        expanded.add(getGridCellId(lat, lng));
      }
    }
  });
  return expanded;
}

function getMaskForArea(areaId) {
  if (areaId === 'jakarta') return jakartaGridMask;
  return null;
}

function generateGridForSelectedAreas() {
  const ids = normalizeMarketSelection(selectedMarketAreaIds);
  const byId = new Set();
  const allCells = [];

  ids.forEach(id => {
    const area = MARKET_AREAS[id];
    if (!area) return;
    const areaCells = generateGrid(area.bounds, GRID_CELL_SIZE, getMaskForArea(id));
    areaCells.forEach(cell => {
      if (byId.has(cell.properties.id)) return;
      byId.add(cell.properties.id);
      allCells.push(cell);
    });
  });
  return allCells;
}

function initMap() {
  map = L.map('map', { center: [-6.22, 106.83], zoom: 12 });
  map.createPane('rawPolygonPane');
  map.getPane('rawPolygonPane').style.zIndex = 440;
  map.createPane('rawLinePane');
  map.getPane('rawLinePane').style.zIndex = 450;
  map.createPane('rawPointPane');
  map.getPane('rawPointPane').style.zIndex = 460;
  map.createPane('planningGridPane');
  map.getPane('planningGridPane').style.zIndex = 430;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  drawnItems = L.featureGroup().addTo(map);
  const drawControl = new L.Control.Draw({
    draw: {
      polygon: false,
      polyline: false,
      rectangle: false,
      circle: false,
      circlemarker: false,
      marker: {
        icon: L.divIcon({
          className: 'potential-marker',
          html: '<span aria-hidden="true">+</span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }
    },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  map.on('draw:created', e => addPoint(e.layer));
  map.on('draw:edited', refreshSelectedPoints);
  map.on('draw:deleted', () => {
    selectedPoints = [];
    updateResults();
  });
  map.on('move zoom resize', renderPlanningGridOverlay);

  map.fitBounds(getSelectedAreaBounds());
  window.setTimeout(() => {
    map.invalidateSize();
    if (inactiveGridLayer) inactiveGridLayer.bringToFront();
    renderPlanningGridOverlay();
  }, 0);
  loadCustomBusiness();
  populateBusinessSelect();
  initCustomModal();
  initMarketAreaControls();
  initLayerControls();
  initLayerPanelCollapse();
  loadJakartaGridMask();
  renderInactiveGrid();
  renderPlanningGridOverlay();
  updateStats(0, 0);
}

function populateBusinessSelect() {
  const sel = document.getElementById('bisnis-select');
  sel.innerHTML = '<option value="">- Pilih jenis usaha -</option>';

  for (const [key, config] of Object.entries(getAllBusinessTypes())) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = config.label;
    sel.appendChild(opt);
  }
}

document.getElementById('bisnis-select').addEventListener('change', function() {
  currentBisnis = this.value;
  userVariables = {};
  userWeights = {};
  userGroupWeights = {};

  if (!this.value) {
    hideSections(['variable-section', 'generate-section', 'results-section']);
    clearScoreLayer();
    return;
  }

  const config = getBusinessConfig(this.value);
  if (config) renderVariables(config);
  showSections(['variable-section', 'generate-section']);
  document.getElementById('results-section').style.display = 'none';
  clearScoreLayer();
});

function renderVariables(config) {
  const container = document.getElementById('variabel-container');
  container.innerHTML = '';

  for (const group of config.kelompok) {
    const gw = group.weight || 25;
    userGroupWeights[group.nama] = gw;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'variable-group';
    groupDiv.innerHTML = `
      <div class="variable-group-title">
        ${escapeHtml(group.nama)}
        <span class="muted-text">(bobot kelompok: </span>
        <input type="number" class="group-weight-input" data-group="${escapeAttr(group.nama)}" value="${gw}" min="1" max="100" />
        <span class="muted-text">%)</span>
      </div>`;

    for (const v of group.variabel) {
      const defaultVal = v.default ?? v.min;
      const w = v.weight || 50;
      userVariables[v.id] = defaultVal;
      userWeights[v.id] = w;

      const item = document.createElement('div');
      item.className = 'variable-item';
      item.innerHTML = `
        <label>${escapeHtml(v.label)}</label>
        <div class="range-row">
          <span class="range-edge">${v.min}</span>
          <input type="range" id="var_${escapeAttr(v.id)}" min="${v.min}" max="${v.max}" value="${defaultVal}" />
          <span class="value-display" id="val_${escapeAttr(v.id)}">${defaultVal}</span>
          <span class="unit-label">${escapeHtml(v.unit)}</span>
        </div>
        <div class="range-row variable-meta">
          <span class="range-edge">bobot:</span>
          <input type="number" class="var-weight-input" data-var="${escapeAttr(v.id)}" value="${w}" min="1" max="100" />
          <span class="range-edge">%</span>
          <span class="desc">${escapeHtml(v.desc || '')}</span>
        </div>`;
      groupDiv.appendChild(item);
    }
    container.appendChild(groupDiv);
  }

  container.querySelectorAll('input[type="range"]').forEach(inp => {
    inp.addEventListener('input', function() {
      const id = this.id.replace('var_', '');
      userVariables[id] = parseFloat(this.value);
      document.getElementById('val_' + id).textContent = this.value;
    });
  });
  container.querySelectorAll('.var-weight-input').forEach(inp => {
    inp.addEventListener('change', function() {
      userWeights[this.dataset.var] = parseFloat(this.value) || 50;
    });
  });
  container.querySelectorAll('.group-weight-input').forEach(inp => {
    inp.addEventListener('change', function() {
      userGroupWeights[this.dataset.group] = parseFloat(this.value) || 25;
    });
  });
}

document.getElementById('btn-generate').addEventListener('click', async function() {
  if (!currentBisnis || isAnalyzing) return;

  isAnalyzing = true;
  this.textContent = 'Menganalisis...';
  this.disabled = true;

  try {
    const selectedBounds = getSelectedAreaBounds();
    map.fitBounds(selectedBounds);
    const gridCells = generateGridForSelectedAreas();

    this.textContent = 'Memuat POI...';
    const compCat = COMPETITOR_CATEGORY[currentBisnis] || currentBisnis;
    const [sw, ne] = selectedBounds;
    const poiQuery = `select=id,kategori,lat,lng&kategori=ilike.*${encodeURIComponent(compCat)}*&and=(lat.gte.${sw[0]},lat.lte.${ne[0]},lng.gte.${sw[1]},lng.lte.${ne[1]})&limit=5000`;
    const poiResp = await fetchFromSupabase('jakarta_poi', poiQuery);

    this.textContent = 'Menghitung skor...';
    enrichGridWithPOIMetrics(gridCells, poiResp);

    scoredCells = gridCells.map(cell => {
      const merged = { ...userVariables };
      merged['komp_' + currentBisnis] = cell.properties.poi_count;
      merged.komp_jarak = cell.properties.nearest_km * 1000;

      const score = calculateScore(cell, merged, userWeights, userGroupWeights, currentBisnis);
      cell.properties.score = Math.min(1, score);
      return cell;
    });

    renderScoreMap(scoredCells);
    updateResults();
    document.getElementById('results-section').style.display = 'block';
  } catch (err) {
    console.error(err);
    alert('Error saat analisis: ' + err.message);
  } finally {
    isAnalyzing = false;
    this.textContent = 'Generate Wilayah Potensial';
    this.disabled = false;
  }
});

function renderScoreMap(cells) {
  clearInactiveGrid();
  hidePlanningGridOverlay();
  clearScoreLayer({ keepScores: true });
  scoreLayer = L.geoJSON({
    type: 'FeatureCollection',
    features: cells
  }, {
    style: feat => {
      const c = getScoreColor(feat.properties.score);
      return { fillColor: c.color, fillOpacity: 0.5, color: c.color, weight: 0.5, opacity: 0.3 };
    },
    onEachFeature: (feat, layer) => {
      const s = (feat.properties.score * 100).toFixed(0);
      layer.bindTooltip(`Skor: ${s}%`, { sticky: true });
      layer.on('click', () => {
        addPoint(L.marker([feat.properties.center_lat, feat.properties.center_lng], {
          icon: L.divIcon({ className: 'potential-marker', html: '<span aria-hidden="true">+</span>', iconSize: [24, 24], iconAnchor: [12, 12] })
        }));
      });
    }
  }).addTo(map);
  applyLayerVisibility();
}

function clearScoreLayer(options = {}) {
  if (scoreLayer) {
    map.removeLayer(scoreLayer);
    scoreLayer = null;
  }
  if (!options.keepScores) {
    scoredCells = [];
    updateStats(0, 0);
    renderInactiveGrid();
    renderPlanningGridOverlay();
  }
}

function renderInactiveGrid() {
  if (!map || inactiveGridLayer || scoredCells.length > 0) return;
  if (!layerVisibility.planningGrid) return;
  const cells = generateGridForSelectedAreas();
  inactiveGridLayer = L.geoJSON({
    type: 'FeatureCollection',
    features: cells
  }, {
    pane: 'planningGridPane',
    interactive: false,
    style: {
      fillColor: '#a8b1c4',
      fillOpacity: 0.08,
      color: '#d7deea',
      weight: 0.9,
      opacity: 0.58
    }
  }).addTo(map);
  inactiveGridLayer.bringToFront();
  renderPlanningGridOverlay();
}

async function loadJakartaGridMask() {
  if (jakartaGridMask) return jakartaGridMask;
  if (Array.isArray(window.JAKARTA_GRID_CELL_IDS)) {
    jakartaGridMask = expandMaskToBoundaryIntersections(new Set(window.JAKARTA_GRID_CELL_IDS), GRID_CELL_SIZE);
    return jakartaGridMask;
  }
  try {
    const res = await fetch('data/jakarta_grid_mask.json');
    if (!res.ok) throw new Error('grid mask unavailable');
    const data = await res.json();
    jakartaGridMask = expandMaskToBoundaryIntersections(new Set(data.cell_ids || []), GRID_CELL_SIZE);
  } catch (err) {
    jakartaGridMask = null;
  }
  return jakartaGridMask;
}

function clearInactiveGrid() {
  if (!inactiveGridLayer) return;
  map.removeLayer(inactiveGridLayer);
  inactiveGridLayer = null;
}

function renderPlanningGridOverlay() {
  const overlay = document.getElementById('planning-grid-overlay');
  if (!overlay || !map || scoredCells.length > 0) return;
  if (!layerVisibility.planningGrid) {
    overlay.innerHTML = '';
    return;
  }

  const cells = generateGridForSelectedAreas();
  const mapSize = map.getSize();
  overlay.setAttribute('viewBox', `0 0 ${mapSize.x} ${mapSize.y}`);
  overlay.innerHTML = cells.map(cell => {
    const b = cell.properties.bbox;
    const nw = map.latLngToContainerPoint([b[3], b[0]]);
    const se = map.latLngToContainerPoint([b[1], b[2]]);
    const x = Math.round(nw.x);
    const y = Math.round(nw.y);
    const width = Math.max(1, Math.round(se.x - nw.x));
    const height = Math.max(1, Math.round(se.y - nw.y));
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}"></rect>`;
  }).join('');
}

function hidePlanningGridOverlay() {
  const overlay = document.getElementById('planning-grid-overlay');
  if (overlay) overlay.innerHTML = '';
}

function initMarketAreaControls() {
  const picker = document.getElementById('market-area-picker');
  const summary = document.getElementById('market-area-summary');
  const inputs = Array.from(document.querySelectorAll('.market-area-option'));
  if (!picker || !summary || inputs.length === 0) return;

  const syncUi = () => {
    const selected = normalizeMarketSelection(selectedMarketAreaIds);
    selectedMarketAreaIds = selected;
    summary.textContent = getSelectedAreaLabel({ compact: true });
    inputs.forEach(input => {
      input.checked = selected.includes(input.value);
    });
  };

  syncUi();

  inputs.forEach(input => {
    input.addEventListener('change', () => {
      const selected = inputs.filter(i => i.checked).map(i => i.value);
      selectedMarketAreaIds = normalizeMarketSelection(selected);
      syncUi();
      clearScoreLayer();
      resetRawLayers();
      map.fitBounds(getSelectedAreaBounds());
      applyLayerVisibility();
      updateStats(0, 0);
    });
  });
}

function initLayerPanelCollapse() {
  const container = document.getElementById('layer-control');
  const button = document.getElementById('btn-layer-collapse');
  if (!container || !button) return;

  const syncButtonState = isCollapsed => {
    const actionLabel = isCollapsed ? 'Expand map layers' : 'Collapse map layers';
    button.textContent = isCollapsed ? '+' : '-';
    button.setAttribute('aria-expanded', String(!isCollapsed));
    button.setAttribute('aria-label', actionLabel);
    button.title = actionLabel;
  };

  syncButtonState(container.classList.contains('collapsed'));

  button.addEventListener('click', () => {
    const isCollapsed = container.classList.toggle('collapsed');
    syncButtonState(isCollapsed);
  });
}

async function loadRawPOILayer(categoryLabel) {
  const [sw, ne] = getSelectedAreaBounds();
  const query = `select=id,nama,kategori,lat,lng&kategori=ilike.*${encodeURIComponent(categoryLabel)}*&and=(lat.gte.${sw[0]},lat.lte.${ne[0]},lng.gte.${sw[1]},lng.lte.${ne[1]})&limit=5000`;
  const rows = await fetchFromSupabase('jakarta_poi', query);

  const features = rows
    .map(row => {
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        type: 'Feature',
        properties: {
          id: row.id,
          nama: row.nama || '',
          kategori: row.kategori || categoryLabel
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      };
    })
    .filter(Boolean);

  return { type: 'FeatureCollection', features };
}

async function loadRawRoadLayer() {
  const bounds = map ? map.getBounds() : null;
  const fallback = getSelectedAreaBounds();
  const south = bounds ? bounds.getSouth() : fallback[0][0];
  const west = bounds ? bounds.getWest() : fallback[0][1];
  const north = bounds ? bounds.getNorth() : fallback[1][0];
  const east = bounds ? bounds.getEast() : fallback[1][1];

  // Hanya jalan utama — motorway, trunk, primary biar cepat
  const overpassQuery = `[out:json][timeout:20];\nway["highway"~"motorway|trunk|primary"](${south},${west},${north},${east});\nout geom;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: overpassQuery
  });
  if (!res.ok) throw new Error('Overpass API error: ' + res.status);
  const payload = await res.json();
  const features = (payload.elements || [])
    .map(element => {
      if (!Array.isArray(element.geom) || element.geom.length < 2) return null;
      const coordinates = element.geom.map(pt => [pt.lon, pt.lat]);
      return {
        type: 'Feature',
        properties: {
          id: element.id,
          name: element.tags?.name || '',
          highway: element.tags?.highway || 'road'
        },
        geometry: {
          type: 'LineString',
          coordinates
        }
      };
    })
    .filter(Boolean);
  return { type: 'FeatureCollection', features };
}

async function loadRawZoningLayer() {
  const bounds = map
    ? [[map.getBounds().getSouth(), map.getBounds().getWest()], [map.getBounds().getNorth(), map.getBounds().getEast()]]
    : getSelectedAreaBounds();

  try {
    const liveData = await loadZoningInBounds(bounds);
    if (liveData && Array.isArray(liveData.features)) return liveData;
  } catch (err) {
    // Fallback to bundled data file.
  }

  const res = await fetch('data/zoning_simplified.geojson');
  if (!res.ok) throw new Error('zoning_simplified.geojson unavailable');
  return res.json();
}

async function loadRawLahanLayer() {
  try {
    const res = await fetch('data/penggunaan_lahan_simplified.geojson');
    if (res.ok) return res.json();
  } catch (err) {
    // ignore
  }
  return { type: 'FeatureCollection', features: [] };
}

function buildRawLayer(config, geojson) {
  if (config.geometry === 'point') {
    return L.geoJSON(geojson, {
      pane: config.pane,
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 4,
        color: config.color,
        weight: 1,
        opacity: 0.95,
        fillColor: config.color,
        fillOpacity: 0.84
      }),
      onEachFeature: (feature, layer) => {
        const nama = feature.properties?.nama || config.label;
        const kategori = feature.properties?.kategori || config.label;
        layer.bindTooltip(`${escapeHtml(nama)} (${escapeHtml(kategori)})`, { sticky: true });
      }
    });
  }

  if (config.geometry === 'line') {
    return L.geoJSON(geojson, {
      pane: config.pane,
      style: {
        color: config.color,
        weight: 2,
        opacity: 0.8
      },
      onEachFeature: (feature, layer) => {
        const roadClass = feature.properties?.highway || 'jalan';
        const roadName = feature.properties?.name || '(tanpa nama)';
        layer.bindTooltip(`${escapeHtml(roadName)} - ${escapeHtml(roadClass)}`, { sticky: true });
      }
    });
  }

  return L.geoJSON(geojson, {
    pane: config.pane,
    style: {
      color: config.color,
      weight: 1,
      opacity: 0.9,
      fillColor: config.color,
      fillOpacity: 0.14
    },
    onEachFeature: (feature, layer) => {
      const zona = feature.properties?.namzon || feature.properties?.NAMZON || 'Zonasi';
      const subZona = feature.properties?.namszn || feature.properties?.NAMSZN || '';
      const text = subZona ? `${zona} - ${subZona}` : zona;
      layer.bindTooltip(escapeHtml(text), { sticky: true });
    }
  });
}

function setRawLayerBusy(checkboxId, isBusy) {
  const input = document.getElementById(checkboxId);
  if (!input) return;
  if (isBusy) {
    input.dataset.prevTitle = input.title || '';
    input.title = 'Memuat data...';
    input.disabled = true;
    return;
  }
  input.title = input.dataset.prevTitle || '';
  input.disabled = false;
}

async function syncRawLayer(key) {
  const config = RAW_LAYER_CONFIG[key];
  const state = rawLayerState[key];
  if (!config || !state) return;

  if (!layerVisibility[key]) {
    if (state.layer && map.hasLayer(state.layer)) map.removeLayer(state.layer);
    return;
  }

  if (state.layer) {
    if (!map.hasLayer(state.layer)) state.layer.addTo(map);
    return;
  }

  if (state.loading) return;
  state.loading = true;
  setRawLayerBusy(config.checkboxId, true);

  try {
    const geojson = await config.loader();
    state.layer = buildRawLayer(config, geojson);
    if (layerVisibility[key]) state.layer.addTo(map);
  } catch (err) {
    console.error(err);
    layerVisibility[key] = false;
    const input = document.getElementById(config.checkboxId);
    if (input) input.checked = false;
    alert(`Gagal memuat layer data mentah: ${config.label}`);
  } finally {
    state.loading = false;
    setRawLayerBusy(config.checkboxId, false);
  }
}

function resetRawLayers() {
  Object.keys(rawLayerState).forEach(key => {
    const state = rawLayerState[key];
    const config = RAW_LAYER_CONFIG[key];
    if (!state || !config) return;
    if (state.layer && map && map.hasLayer(state.layer)) map.removeLayer(state.layer);
    state.layer = null;
    state.loading = false;
    setRawLayerBusy(config.checkboxId, false);
  });
}

function syncRawLayers() {
  Object.keys(RAW_LAYER_CONFIG).forEach(key => {
    void syncRawLayer(key);
  });
}

function initLayerControls() {
  const bindings = [
    ['layer-planning-grid', 'planningGrid'],
    ['layer-score-heatmap', 'scoreHeatmap'],
    ['layer-selected-sites', 'selectedSites'],
    ['layer-legend', 'legend'],
    ['layer-raw-point-apotek', 'rawPointApotek'],
    ['layer-raw-point-minimarket', 'rawPointMinimarket'],
    ['layer-raw-point-restoran', 'rawPointRestoran'],
    ['layer-raw-point-klinik', 'rawPointKlinik'],
    ['layer-raw-point-kantor', 'rawPointKantor'],
    ['layer-raw-line-jalan', 'rawLineJalan'],
    ['layer-raw-polygon-zonasi', 'rawPolygonZonasi'],
    ['layer-raw-polygon-lahan', 'rawPolygonLahan']
  ];

  bindings.forEach(([id, key]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.checked = layerVisibility[key];
    input.addEventListener('change', () => {
      layerVisibility[key] = input.checked;
      applyLayerVisibility();
    });
  });
}

function applyLayerVisibility() {
  const legend = document.getElementById('legend');
  if (legend) legend.style.display = layerVisibility.legend ? 'block' : 'none';

  if (scoreLayer) {
    if (layerVisibility.scoreHeatmap && !map.hasLayer(scoreLayer)) scoreLayer.addTo(map);
    if (!layerVisibility.scoreHeatmap && map.hasLayer(scoreLayer)) map.removeLayer(scoreLayer);
  }

  if (drawnItems) {
    if (layerVisibility.selectedSites && !map.hasLayer(drawnItems)) drawnItems.addTo(map);
    if (!layerVisibility.selectedSites && map.hasLayer(drawnItems)) map.removeLayer(drawnItems);
  }

  if (layerVisibility.planningGrid) {
    if (!inactiveGridLayer && scoredCells.length === 0) renderInactiveGrid();
    renderPlanningGridOverlay();
  } else {
    clearInactiveGrid();
    hidePlanningGridOverlay();
  }

  syncRawLayers();
}

function addPoint(layer) {
  drawnItems.addLayer(layer);
  const ll = layer.getLatLng();
  selectedPoints.push({
    lat: ll.lat,
    lng: ll.lng,
    score: getScoreAtPoint(ll.lat, ll.lng),
    name: 'Titik ' + (selectedPoints.length + 1)
  });
  updateResults();
}

function refreshSelectedPoints() {
  selectedPoints = [];
  drawnItems.eachLayer(l => {
    const ll = l.getLatLng();
    selectedPoints.push({
      lat: ll.lat,
      lng: ll.lng,
      score: getScoreAtPoint(ll.lat, ll.lng),
      name: 'Titik ' + (selectedPoints.length + 1)
    });
  });
  updateResults();
}

function getScoreAtPoint(lat, lng) {
  if (!scoredCells.length) return '-';
  const c = scoredCells.find(cell => pointInCell(lat, lng, cell));
  return c ? (c.properties.score * 100).toFixed(0) : '-';
}

function updateResults() {
  const summary = document.getElementById('results-summary');
  const avg = scoredCells.length > 0
    ? (scoredCells.reduce((s, c) => s + c.properties.score, 0) / scoredCells.length * 100).toFixed(0)
    : 0;
  const high = scoredCells.filter(c => c.properties.score >= 0.6).length;
  updateStats(avg, high);

  let html = `
    <div><span class="big-num">${avg}%</span><div>Rata-rata skor</div></div>
    <div class="result-line">
      <strong>${high.toLocaleString()}</strong> sel skor tinggi &bull;
      <strong>${selectedPoints.length}</strong> titik dipilih
    </div>`;

  if (selectedPoints.length > 0) {
    html += '<div class="selected-points">';
    selectedPoints.forEach(p => {
      html += `<div>${escapeHtml(p.name)}: (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}) ${p.score !== '-' ? '| Skor: ' + p.score + '%' : ''}</div>`;
    });
    html += '</div>';
  }
  summary.innerHTML = html;
}

function updateStats(avg, high) {
  const avgEl = document.getElementById('stat-avg');
  const highEl = document.getElementById('stat-high');
  const pointsEl = document.getElementById('stat-points');
  const marketEl = document.getElementById('stat-market');
  if (avgEl) avgEl.textContent = scoredCells.length ? `${avg}%` : '-';
  if (highEl) highEl.textContent = scoredCells.length ? high.toLocaleString() : '-';
  if (pointsEl) pointsEl.textContent = selectedPoints.length.toLocaleString();
  if (marketEl) marketEl.textContent = getSelectedAreaLabel({ compact: true });
}

document.getElementById('btn-export-csv').addEventListener('click', () => exportPoints('csv'));
document.getElementById('btn-export-geojson').addEventListener('click', () => exportPoints('geojson'));

function exportPoints(format) {
  if (selectedPoints.length === 0) {
    alert('Belum ada titik yang dipilih. Klik pada peta untuk menandai titik.');
    return;
  }
  const ts = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    let csv = 'No,Nama,Latitude,Longitude,Skor_Kesesuaian,Jenis_Usaha,Keterangan\n';
    selectedPoints.forEach((p, i) => {
      const note = p.score !== '-' && parseInt(p.score, 10) >= 60 ? 'Potensial' : 'Perlu Cek Lapangan';
      csv += `${i + 1},"${p.name}",${p.lat.toFixed(6)},${p.lng.toFixed(6)},${p.score},${currentBisnis || ''},${note}\n`;
    });
    downloadFile(csv, 'titik_potensial_' + currentBisnis + '_' + ts + '.csv', 'text/csv');
    return;
  }

  const features = selectedPoints.map((p, i) => ({
    type: 'Feature',
    properties: {
      no: i + 1,
      name: p.name,
      jenis_usaha: currentBisnis,
      skor: p.score,
      keterangan: p.score !== '-' && parseInt(p.score, 10) >= 60 ? 'Potensial' : 'Perlu Cek Lapangan'
    },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
  }));
  const gc = {
    type: 'FeatureCollection',
    features,
    metadata: { generated: ts, business_type: currentBisnis, total_points: features.length }
  };
  downloadFile(JSON.stringify(gc, null, 2), 'titik_potensial_' + currentBisnis + '_' + ts + '.geojson', 'application/geo+json');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

document.getElementById('btn-reset').addEventListener('click', () => {
  drawnItems.clearLayers();
  selectedPoints = [];
  updateResults();
});

document.getElementById('btn-save-config').addEventListener('click', () => {
  if (!currentBisnis) {
    alert('Pilih jenis usaha dulu.');
    return;
  }
  const config = {
    business_type: currentBisnis,
    variables: userVariables,
    weights: userWeights,
    group_weights: userGroupWeights,
    saved_at: new Date().toISOString()
  };
  downloadFile(JSON.stringify(config, null, 2), 'sitescout_config_' + currentBisnis + '.json', 'application/json');
});

document.getElementById('btn-load-config').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const cfg = JSON.parse(ev.target.result);
      if (cfg.business_type) {
        document.getElementById('bisnis-select').value = cfg.business_type;
        document.getElementById('bisnis-select').dispatchEvent(new Event('change'));
        window.setTimeout(() => applyLoadedConfig(cfg), 50);
      }
    } catch (err) {
      alert('File config tidak valid: ' + err.message);
    }
  };
  reader.readAsText(file);
  this.value = '';
});

function applyLoadedConfig(cfg) {
  if (cfg.variables) {
    userVariables = cfg.variables;
    for (const [k, v] of Object.entries(cfg.variables)) {
      const inp = document.getElementById('var_' + k);
      const val = document.getElementById('val_' + k);
      if (inp) inp.value = v;
      if (val) val.textContent = v;
    }
  }
  if (cfg.weights) {
    userWeights = cfg.weights;
    for (const [k, v] of Object.entries(cfg.weights)) {
      const inp = document.querySelector('.var-weight-input[data-var="' + CSS.escape(k) + '"]');
      if (inp) inp.value = v;
    }
  }
  if (cfg.group_weights) {
    userGroupWeights = cfg.group_weights;
    for (const [k, v] of Object.entries(cfg.group_weights)) {
      const inp = document.querySelector('.group-weight-input[data-group="' + CSS.escape(k) + '"]');
      if (inp) inp.value = v;
    }
  }
}

function initCustomModal() {
  const modal = document.getElementById('custom-modal');
  document.getElementById('btn-custom-bisnis').onclick = () => {
    modal.style.display = 'block';
    customGroupCount = 0;
    varCounters = {};
    document.getElementById('custom-name').value = '';
    document.getElementById('custom-icon').value = '';
    document.getElementById('custom-groups').innerHTML = '';
    addGroup();
  };
  document.getElementById('modal-close').onclick = () => { modal.style.display = 'none'; };
  window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
  document.getElementById('btn-add-group').onclick = addGroup;
  document.getElementById('btn-save-custom').onclick = saveCustom;
}

function addGroup() {
  const container = document.getElementById('custom-groups');
  const idx = customGroupCount++;
  const div = document.createElement('div');
  div.className = 'custom-group';
  div.id = 'cg-' + idx;
  div.innerHTML = `
    <div class="custom-group-header">
      <input type="text" class="cg-name" placeholder="Nama kelompok" value="Demand" />
      <input type="number" class="cg-weight" value="25" min="1" max="100" title="Bobot kelompok" />
      <span class="unit-label">%</span>
      <button class="btn-small-danger" type="button" onclick="this.parentElement.parentElement.remove()">x</button>
    </div>
    <div class="cg-vars">${addVarHtml()}</div>
    <button class="btn-small" type="button" onclick="addVar(this, ${idx})">+ Variabel</button>`;
  container.appendChild(div);
}

function addVar(btn, groupIdx) {
  const container = btn.parentElement.querySelector('.cg-vars');
  varCounters[groupIdx] = (varCounters[groupIdx] || 0) + 1;
  container.insertAdjacentHTML('beforeend', addVarHtml());
}

function addVarHtml() {
  return '<div class="cg-var">' +
    '<input type="text" class="cv-label" placeholder="Label" />' +
    '<label>Min <input type="number" class="cv-min" value="0" /></label>' +
    '<label>Max <input type="number" class="cv-max" value="100" /></label>' +
    '<label>Unit <input type="text" class="cv-unit" value="meter" /></label>' +
    '<label>Bobot <input type="number" class="cv-weight" value="50" /></label>' +
    '<button class="btn-small-danger" type="button" onclick="this.parentElement.remove()">x</button></div>';
}

function saveCustom() {
  const name = document.getElementById('custom-name').value.trim();
  if (!name) {
    alert('Nama bisnis harus diisi.');
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom_' + Date.now();
  const icon = document.getElementById('custom-icon').value.trim() || '';
  const kelompok = [];

  document.querySelectorAll('.custom-group').forEach(g => {
    const nama = g.querySelector('.cg-name').value.trim();
    if (!nama) return;
    const weight = parseInt(g.querySelector('.cg-weight').value, 10) || 25;
    const variabel = [];

    g.querySelectorAll('.cg-var').forEach(v => {
      const label = v.querySelector('.cv-label').value.trim();
      if (!label) return;
      const min = parseFloat(v.querySelector('.cv-min').value) || 0;
      const max = parseFloat(v.querySelector('.cv-max').value) || 100;
      variabel.push({
        id: slug + '_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label,
        unit: v.querySelector('.cv-unit').value || 'unit',
        min,
        max,
        default: Math.floor((min + max) / 2) || 50,
        weight: parseInt(v.querySelector('.cv-weight').value, 10) || 50,
        higherBetter: true,
        desc: ''
      });
    });
    if (variabel.length > 0) kelompok.push({ nama, weight, variabel });
  });

  if (kelompok.length === 0) {
    alert('Tambahkan minimal 1 kelompok variabel.');
    return;
  }

  CUSTOM_BISNIS[slug] = { icon, label: name, kelompok };
  saveCustomBusiness();
  populateBusinessSelect();
  document.getElementById('custom-modal').style.display = 'none';
  window.setTimeout(() => {
    document.getElementById('bisnis-select').value = slug;
    document.getElementById('bisnis-select').dispatchEvent(new Event('change'));
  }, 50);
}

function hideSections(arr) {
  arr.forEach(id => { document.getElementById(id).style.display = 'none'; });
}

function showSections(arr) {
  arr.forEach(id => { document.getElementById(id).style.display = 'block'; });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.addEventListener('DOMContentLoaded', initMap);
