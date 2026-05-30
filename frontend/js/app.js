// === SITESCOUT — Main Application (Phase 3) ===

let map, drawnItems, scoreLayer, resultsLayer;
let currentBisnis = null;
let userVariables = {};
let userWeights = {};
let userGroupWeights = {};
let scoredCells = [];
let selectedPoints = [];
let allPOIData = [];
let isAnalyzing = false;
let customGroupCount = 0;

const DEFAULT_BOUNDS = [[-6.37, 106.68], [-6.08, 106.98]];

// ===== INIT =====
function initMap() {
  map = L.map('map', { center: [-6.22, 106.83], zoom: 12 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM', maxZoom: 19
  }).addTo(map);

  drawnItems = L.featureGroup().addTo(map);
  const drawControl = new L.Control.Draw({
    draw: {
      polygon: false, polyline: false, rectangle: false,
      circle: false, circlemarker: false,
      marker: {
        icon: L.divIcon({
          className: 'potential-marker',
          html: '📍',
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        })
      }
    },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  map.on('draw:created', e => { addPoint(e.layer); });
  map.on('draw:edited', () => { refreshSelectedPoints(); });
  map.on('draw:deleted', () => { selectedPoints = []; updateResults(); });

  map.fitBounds(DEFAULT_BOUNDS);
  loadCustomBusiness();
  populateBusinessSelect();
  initCustomModal();
}

// ===== BUSINESS SELECT =====
function populateBusinessSelect() {
  const sel = document.getElementById('bisnis-select');
  sel.innerHTML = '<option value="">— Pilih jenis usaha —</option>';
  const all = getAllBusinessTypes();
  for (const [key, config] of Object.entries(all)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${config.icon || '📋'} ${config.label}`;
    sel.appendChild(opt);
  }
  // Add custom businesses
  for (const [key] of Object.entries(CUSTOM_BISNIS)) {
    if (!BISNIS_CONFIG[key]) continue;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `✨ ${CUSTOM_BISNIS[key].icon || '📋'} ${CUSTOM_BISNIS[key].label}`;
    sel.appendChild(opt);
  }
}

document.getElementById('bisnis-select').addEventListener('change', function() {
  currentBisnis = this.value;
  userVariables = {}; userWeights = {}; userGroupWeights = {};
  if (!this.value) {
    hideSections(['variable-section', 'generate-section', 'results-section']);
    clearScoreLayer(); return;
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
        ${group.nama}
        <span style="font-size:0.75rem;color:#6c757d">(bobot kelompok: </span>
        <input type="number" class="group-weight-input" data-group="${group.nama}" value="${gw}" min="1" max="100" style="width:50px;font-size:0.75rem;padding:1px 4px;" />
        <span style="font-size:0.75rem;color:#6c757d">%)</span>
      </div>`;

    for (const v of group.variabel) {
      const defaultVal = v.default ?? v.min;
      const w = v.weight || 50;
      userVariables[v.id] = defaultVal;
      userWeights[v.id] = w;

      const item = document.createElement('div');
      item.className = 'variable-item';
      item.innerHTML = `
        <label>${v.label}</label>
        <div class="range-row">
          <span style="font-size:0.7rem;color:#adb5bd">${v.min}</span>
          <input type="range" id="var_${v.id}" min="${v.min}" max="${v.max}" value="${defaultVal}" />
          <span class="value-display" id="val_${v.id}">${defaultVal}</span>
          <span style="font-size:0.75rem">${v.unit}</span>
        </div>
        <div class="range-row" style="margin-top:4px">
          <span style="font-size:0.7rem;color:#adb5bd">bobot:</span>
          <input type="number" class="var-weight-input" data-var="${v.id}" value="${w}" min="1" max="100" style="width:45px;font-size:0.75rem;padding:1px 4px;" />
          <span style="font-size:0.7rem;color:#adb5bd">%</span>
          <span style="font-size:0.7rem;color:#adb5bd;flex:1;text-align:right">${v.desc}</span>
        </div>`;
      groupDiv.appendChild(item);
    }
    container.appendChild(groupDiv);
  }

  // Bind events
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

// ===== GENERATE =====
document.getElementById('btn-generate').addEventListener('click', async function() {
  if (!currentBisnis || isAnalyzing) return;
  isAnalyzing = true;
  this.textContent = '⏳ Menganalisis...';
  this.disabled = true;

  try {
    await new Promise(r => setTimeout(r, 300));
    const bounds = map.getBounds();
    const ba = [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]];
    const gridCells = generateGrid(ba, 0.003);
    allPOIData = getDummyDataPoints(ba, currentBisnis);

    scoredCells = gridCells.map(cell => {
      const score = calculateScore(cell, userVariables, userWeights, userGroupWeights, currentBisnis);
      const center = turf.centerOfMass(cell);
      const nearby = allPOIData.filter(p => turf.distance(center, p, {units:'km'}) < 0.5);
      const boost = Math.min(0.15, nearby.length * 0.02);
      cell.properties.score = Math.min(1, score + boost);
      cell.properties.nearby_pois = nearby.length;
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
    this.textContent = '🚀 Generate Wilayah Potensial';
    this.disabled = false;
  }
});

function renderScoreMap(cells) {
  clearScoreLayer();
  scoreLayer = L.geoJSON({
    type: 'FeatureCollection', features: cells
  }, {
    style: feat => {
      const c = getScoreColor(feat.properties.score);
      return { fillColor: c.color, fillOpacity: 0.5, color: c.color, weight: 0.5, opacity: 0.3 };
    },
    onEachFeature: (feat, layer) => {
      const s = (feat.properties.score * 100).toFixed(0);
      layer.bindTooltip(`Skor: ${s}%`, { sticky: true });
      layer.on('click', () => {
        const c = turf.centerOfMass(feat).geometry.coordinates;
        addPoint(L.marker([c[1], c[0]], {
          icon: L.divIcon({ className: 'potential-marker', html: '📍', iconSize: [24,24], iconAnchor: [12,24] })
        }));
      });
    }
  }).addTo(map);
}

function clearScoreLayer() {
  if (scoreLayer) { map.removeLayer(scoreLayer); scoreLayer = null; }
  scoredCells = [];
}

function addPoint(layer) {
  drawnItems.addLayer(layer);
  const ll = layer.getLatLng();
  selectedPoints.push({ lat: ll.lat, lng: ll.lng, score: getScoreAtPoint(ll.lat, ll.lng), name: 'Titik ' + (selectedPoints.length + 1) });
  updateResults();
}

function refreshSelectedPoints() {
  selectedPoints = [];
  drawnItems.eachLayer(l => {
    const ll = l.getLatLng();
    selectedPoints.push({ lat: ll.lat, lng: ll.lng, score: getScoreAtPoint(ll.lat, ll.lng), name: 'Titik ' + (selectedPoints.length + 1) });
  });
  updateResults();
}

function getScoreAtPoint(lat, lng) {
  if (!scoredCells.length) return '-';
  const c = scoredCells.find(c => {
    const b = turf.bbox(c);
    return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
  });
  return c ? (c.properties.score * 100).toFixed(0) : '-';
}

// ===== RESULTS =====
function updateResults() {
  const summary = document.getElementById('results-summary');
  const avg = scoredCells.length > 0 ? (scoredCells.reduce((s,c) => s + c.properties.score, 0) / scoredCells.length * 100).toFixed(0) : 0;
  const high = scoredCells.filter(c => c.properties.score >= 0.6).length;
  let html = `
    <div><span class="big-num">${avg}%</span><div>Rata-rata skor</div></div>
    <div style="margin-top:8px">
      <strong>${high.toLocaleString()}</strong> sel skor tinggi &bull;
      <strong>${selectedPoints.length}</strong> titik dipilih
    </div>`;
  if (selectedPoints.length > 0) {
    html += '<div style="margin-top:8px;font-size:0.8rem;max-height:150px;overflow-y:auto">';
    selectedPoints.forEach((p,i) => {
      html += `<div>📍 ${p.name}: (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}) ${p.score !== '-' ? '| Skor: '+p.score+'%' : ''}</div>`;
    });
    html += '</div>';
  }
  summary.innerHTML = html;
}

// ===== EXPORT CSV =====
document.getElementById('btn-export-csv').addEventListener('click', () => exportPoints('csv'));

// ===== EXPORT GEOJSON =====
document.getElementById('btn-export-geojson').addEventListener('click', () => exportPoints('geojson'));

function exportPoints(format) {
  if (selectedPoints.length === 0) {
    alert('Belum ada titik yang dipilih. Klik pada peta untuk menandai titik.');
    return;
  }
  const ts = new Date().toISOString().slice(0,10);

  if (format === 'csv') {
    let csv = 'No,Nama,Latitude,Longitude,Skor_Kesesuaian,Jenis_Usaha,Keterangan\n';
    selectedPoints.forEach((p,i) => {
      csv += i+1 + ',"' + p.name + '",' + p.lat.toFixed(6) + ',' + p.lng.toFixed(6) + ',' + p.score + ',' + (currentBisnis||'') + ',' +
        (p.score !== '-' && parseInt(p.score) >= 60 ? 'Potensial' : 'Perlu Cek Lapangan') + '\n';
    });
    downloadFile(csv, 'titik_potensial_' + currentBisnis + '_' + ts + '.csv', 'text/csv');
  } else {
    const features = selectedPoints.map((p,i) => ({
      type: 'Feature',
      properties: {
        no: i+1, name: p.name, jenis_usaha: currentBisnis,
        skor: p.score, keterangan: (p.score !== '-' && parseInt(p.score) >= 60) ? 'Potensial' : 'Perlu Cek Lapangan'
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
    }));
    const gc = { type: 'FeatureCollection', features: features,
      metadata: { generated: ts, business_type: currentBisnis, total_points: features.length }
    };
    downloadFile(JSON.stringify(gc, null, 2), 'titik_potensial_' + currentBisnis + '_' + ts + '.geojson', 'application/geo+json');
  }
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ===== RESET =====
document.getElementById('btn-reset').addEventListener('click', () => {
  drawnItems.clearLayers();
  selectedPoints = [];
  updateResults();
});

// ===== SAVE / LOAD CONFIG =====
document.getElementById('btn-save-config').addEventListener('click', () => {
  if (!currentBisnis) { alert('Pilih jenis usaha dulu.'); return; }
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
        setTimeout(() => {
          if (cfg.variables) {
            userVariables = cfg.variables;
            for (const [k,v] of Object.entries(cfg.variables)) {
              const inp = document.getElementById('var_' + k);
              const val = document.getElementById('val_' + k);
              if (inp) { inp.value = v; }
              if (val) { val.textContent = v; }
            }
          }
          if (cfg.weights) {
            userWeights = cfg.weights;
            for (const [k,v] of Object.entries(cfg.weights)) {
              const inp = document.querySelector('.var-weight-input[data-var="' + k + '"]');
              if (inp) inp.value = v;
            }
          }
          if (cfg.group_weights) {
            userGroupWeights = cfg.group_weights;
            for (const [k,v] of Object.entries(cfg.group_weights)) {
              const inp = document.querySelector('.group-weight-input[data-group="' + k + '"]');
              if (inp) inp.value = v;
            }
          }
        }, 200);
      }
    } catch(e) {
      alert('File config tidak valid: ' + e.message);
    }
  };
  reader.readAsText(file);
  this.value = '';
});

// ===== CUSTOM BISNIS MODAL =====
function initCustomModal() {
  const modal = document.getElementById('custom-modal');
  document.getElementById('btn-custom-bisnis').onclick = () => {
    modal.style.display = 'block';
    customGroupCount = 0;
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
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input type="text" class="cg-name" placeholder="Nama kelompok" value="Demand" style="flex:1" />
      <input type="number" class="cg-weight" value="25" min="1" max="100" style="width:50px" title="Bobot kelompok" />
      <span style="font-size:0.75rem">%</span>
      <button class="btn-small-danger" onclick="this.parentElement.parentElement.remove()">x</button>
    </div>
    <div class="cg-vars">${addVarHtml(idx, 0)}</div>
    <button class="btn-small" onclick="addVar(this, ${idx})">+ Variabel</button>
    <hr style="margin:8px 0" />`;
  container.appendChild(div);
}

let varCounters = {};

function addVar(btn, groupIdx) {
  const container = btn.parentElement.querySelector('.cg-vars');
  const idx = varCounters[groupIdx] = (varCounters[groupIdx] || 0) + 1;
  container.insertAdjacentHTML('beforeend', addVarHtml(groupIdx, idx));
}

function addVarHtml(gIdx, vIdx) {
  return '<div class="cg-var" style="margin:4px 0;display:flex;gap:4px;flex-wrap:wrap;align-items:center">' +
    '<input type="text" class="cv-label" placeholder="Label" style="width:120px" />' +
    'Min <input type="number" class="cv-min" value="0" style="width:50px" />' +
    'Max <input type="number" class="cv-max" value="100" style="width:60px" />' +
    'Unit <input type="text" class="cv-unit" value="meter" style="width:55px" />' +
    'Bobot <input type="number" class="cv-weight" value="50" style="width:45px" />' +
    '<button class="btn-small-danger" onclick="this.parentElement.remove()">x</button></div>';
}

function saveCustom() {
  const name = document.getElementById('custom-name').value.trim();
  if (!name) { alert('Nama bisnis harus diisi.'); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom_' + Date.now();
  const icon = document.getElementById('custom-icon').value.trim() || '📋';

  const kelompok = [];
  document.querySelectorAll('.custom-group').forEach(g => {
    const nama = g.querySelector('.cg-name').value.trim();
    if (!nama) return;
    const weight = parseInt(g.querySelector('.cg-weight').value) || 25;
    const variabel = [];
    g.querySelectorAll('.cg-var').forEach(v => {
      const label = v.querySelector('.cv-label').value.trim();
      if (!label) return;
      variabel.push({
        id: slug + '_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: label,
        unit: v.querySelector('.cv-unit').value || 'unit',
        min: parseFloat(v.querySelector('.cv-min').value) || 0,
        max: parseFloat(v.querySelector('.cv-max').value) || 100,
        default: Math.floor((parseFloat(v.querySelector('.cv-min').value) + parseFloat(v.querySelector('.cv-max').value)) / 2) || 50,
        weight: parseInt(v.querySelector('.cv-weight').value) || 50,
        higherBetter: true,
        desc: ''
      });
    });
    if (variabel.length > 0) kelompok.push({ nama, weight, variabel });
  });

  if (kelompok.length === 0) { alert('Tambahkan minimal 1 kelompok variabel.'); return; }

  CUSTOM_BISNIS[slug] = { icon, label: name, kelompok };
  saveCustomBusiness();
  populateBusinessSelect();
  document.getElementById('custom-modal').style.display = 'none';
  setTimeout(() => {
    document.getElementById('bisnis-select').value = slug;
    document.getElementById('bisnis-select').dispatchEvent(new Event('change'));
  }, 100);
}

// ===== UTILITIES =====
function hideSections(arr) { arr.forEach(id => document.getElementById(id).style.display = 'none'); }
function showSections(arr) { arr.forEach(id => document.getElementById(id).style.display = 'block'); }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', initMap);
