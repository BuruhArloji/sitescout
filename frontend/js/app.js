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

const DEFAULT_BOUNDS = [[-6.37, 106.68], [-6.08, 106.98]];
const GRID_CELL_SIZE = 0.015;
const COMPETITOR_CATEGORY = {
  apotek: 'Apotek',
  minimarket: 'Minimarket',
  restoran: 'Restoran',
  klinik: 'Klinik',
  kantor: 'Kantor'
};

function initMap() {
  map = L.map('map', { center: [-6.22, 106.83], zoom: 12 });
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

  map.fitBounds(DEFAULT_BOUNDS);
  renderInactiveGrid();
  loadCustomBusiness();
  populateBusinessSelect();
  initCustomModal();
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
    map.fitBounds(DEFAULT_BOUNDS);
    const gridCells = generateGrid(DEFAULT_BOUNDS, GRID_CELL_SIZE);

    this.textContent = 'Memuat POI...';
    const compCat = COMPETITOR_CATEGORY[currentBisnis] || currentBisnis;
    const poiResp = await fetchFromSupabase('jakarta_poi', {
      select: 'id,kategori,latitude,longitude',
      kategori: 'ilike.*' + compCat + '*',
      limit: '5000'
    });

    this.textContent = 'Menghitung skor...';
    enrichGridWithPOIMetrics(gridCells, poiResp, DEFAULT_BOUNDS, GRID_CELL_SIZE);

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
  }
}

function renderInactiveGrid() {
  if (!map || inactiveGridLayer || scoredCells.length > 0) return;
  const cells = generateGrid(DEFAULT_BOUNDS, GRID_CELL_SIZE);
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
      opacity: 0.58,
      dashArray: '3 5'
    }
  }).addTo(map);
  inactiveGridLayer.bringToFront();
}

function clearInactiveGrid() {
  if (!inactiveGridLayer) return;
  map.removeLayer(inactiveGridLayer);
  inactiveGridLayer = null;
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
  if (marketEl) marketEl.textContent = currentBisnis ? getBusinessConfig(currentBisnis)?.label || 'Jakarta' : 'Jakarta';
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
