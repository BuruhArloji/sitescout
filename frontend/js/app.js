// === SITESCOUT — Main Application ===

let map, drawnItems, scoreLayer, resultsLayer;
let currentBisnis = null;
let userVariables = {};
let scoredCells = [];
let selectedPoints = [];
let allPOIData = [];
let isAnalyzing = false;

// Default bounds (Jakarta mainland)
const DEFAULT_BOUNDS = [
  [-6.37, 106.68],
  [-6.08, 106.98]
];

// ===== INIT MAP =====
function initMap() {
  map = L.map('map', {
    center: [-6.22, 106.83],
    zoom: 12,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 19
  }).addTo(map);

  // Draw control for marking points
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
          html: '📍',
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        })
      }
    },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  map.on('draw:created', function(e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);
    const latlng = layer.getLatLng();
    selectedPoints.push({
      lat: latlng.lat,
      lng: latlng.lng,
      score: getScoreAtPoint(latlng.lat, latlng.lng),
      name: `Titik ${selectedPoints.length + 1}`
    });
    updateResults();
  });

  map.on('draw:edited', function() {
    selectedPoints = [];
    drawnItems.eachLayer(function(layer) {
      const latlng = layer.getLatLng();
      selectedPoints.push({
        lat: latlng.lat,
        lng: latlng.lng,
        score: getScoreAtPoint(latlng.lat, latlng.lng),
        name: `Titik ${selectedPoints.length + 1}`
      });
    });
    updateResults();
  });

  map.on('draw:deleted', function() {
    selectedPoints = [];
    updateResults();
  });

  map.fitBounds(DEFAULT_BOUNDS);
}

function getScoreAtPoint(lat, lng) {
  if (!scoredCells || scoredCells.length === 0) return '-';
  const cell = scoredCells.find(c => {
    const bbox = turf.bbox(c);
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
  });
  return cell ? (cell.properties.score * 100).toFixed(0) : '-';
}

// ===== UI: BISNIS SELECT =====
document.getElementById('bisnis-select').addEventListener('change', function() {
  const val = this.value;
  currentBisnis = val;
  userVariables = {};

  if (!val) {
    document.getElementById('variable-section').style.display = 'none';
    document.getElementById('generate-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    clearScoreLayer();
    return;
  }

  const config = BISNIS_CONFIG[val];
  if (!config) return;

  renderVariables(config);
  document.getElementById('variable-section').style.display = 'block';
  document.getElementById('generate-section').style.display = 'block';
  document.getElementById('results-section').style.display = 'none';
  clearScoreLayer();
});

function renderVariables(config) {
  const container = document.getElementById('variabel-container');
  container.innerHTML = '';

  for (const group of config.kelompok) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'variable-group';
    groupDiv.innerHTML = `<div class="variable-group-title">${group.nama}</div>`;

    for (const v of group.variabel) {
      const defaultVal = v.default ?? v.min;
      userVariables[v.id] = defaultVal;

      const item = document.createElement('div');
      item.className = 'variable-item';
      item.innerHTML = `
        <label>${v.label} <span class="value-display" id="val_${v.id}">${defaultVal}</span> ${v.unit}</label>
        <div class="range-row">
          <span style="font-size:0.75rem;color:#adb5bd">${v.min}</span>
          <input type="range" id="var_${v.id}" min="${v.min}" max="${v.max}" value="${defaultVal}" />
          <span style="font-size:0.75rem;color:#adb5bd">${v.max}</span>
        </div>
        <div class="desc">${v.desc}</div>
      `;
      groupDiv.appendChild(item);
    }
    container.appendChild(groupDiv);
  }

  // Bind slider events
  document.querySelectorAll('#variabel-container input[type="range"]').forEach(input => {
    input.addEventListener('input', function() {
      const id = this.id.replace('var_', '');
      userVariables[id] = parseFloat(this.value);
      document.getElementById(`val_${id}`).textContent = this.value;
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
    // Small delay for UX
    await new Promise(r => setTimeout(r, 500));

    // Generate grid
    const bounds = map.getBounds();
    const boundsArr = [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]];
    const gridCells = generateGrid(boundsArr, 0.003);

    // Generate simulated POI data
    allPOIData = getDummyDataPoints(boundsArr, currentBisnis);

    // Score each cell
    scoredCells = gridCells.map(cell => {
      const score = calculateScore(cell, userVariables, currentBisnis);
      
      // Enhance with POI data proximity
      const center = turf.centerOfMass(cell);
      const nearbyPOIs = allPOIData.filter(poi => {
        const dist = turf.distance(center, poi, { units: 'kilometers' });
        return dist < 0.5;
      });

      // Boost score if there are POIs in the area (demand signal)
      const poiBoost = Math.min(0.15, nearbyPOIs.length * 0.02);
      const finalScore = Math.min(1, score + poiBoost);

      cell.properties.score = finalScore;
      cell.properties.nearby_pois = nearbyPOIs.length;
      cell.properties.population_density = nearbyPOIs.length > 0
        ? Math.round(nearbyPOIs.reduce((s, p) => s + (p.properties.population_density || 0), 0) / nearbyPOIs.length)
        : 0;
      return cell;
    });

    renderScoreMap(scoredCells);
    updateResults();

    document.getElementById('results-section').style.display = 'block';

  } catch (err) {
    console.error('Analysis error:', err);
    alert('Terjadi kesalahan saat analisis. Coba lagi.');
  } finally {
    isAnalyzing = false;
    this.textContent = '🚀 Generate Wilayah Potensial';
    this.disabled = false;
  }
});

function renderScoreMap(cells) {
  clearScoreLayer();

  scoreLayer = L.geoJSON({
    type: 'FeatureCollection',
    features: cells
  }, {
    style: function(feature) {
      const score = feature.properties.score;
      const colorInfo = getScoreColor(score);
      return {
        fillColor: colorInfo.color,
        fillOpacity: 0.5,
        color: colorInfo.color,
        weight: 0.5,
        opacity: 0.3
      };
    },
    onEachFeature: function(feature, layer) {
      const score = (feature.properties.score * 100).toFixed(0);
      layer.bindTooltip(`Skor: ${score}%<br>POI: ${feature.properties.nearby_poi || 0}`, {
        sticky: true
      });
      layer.on('click', function() {
        const center = turf.centerOfMass(feature);
        const coords = center.geometry.coordinates;
        map.fire('draw:created', {
          layer: L.marker([coords[1], coords[0]], {
            icon: L.divIcon({
              className: 'potential-marker',
              html: '📍',
              iconSize: [24, 24],
              iconAnchor: [12, 24]
            })
          })
        });
      });
    }
  }).addTo(map);
}

function clearScoreLayer() {
  if (scoreLayer) {
    map.removeLayer(scoreLayer);
    scoreLayer = null;
  }
  scoredCells = [];
}

// ===== RESULTS =====
function updateResults() {
  const summary = document.getElementById('results-summary');
  const avgScore = scoredCells.length > 0
    ? (scoredCells.reduce((s, c) => s + c.properties.score, 0) / scoredCells.length * 100).toFixed(0)
    : 0;

  const highScore = scoredCells.filter(c => c.properties.score >= 0.6).length;
  const totalCells = scoredCells.length;

  let html = `
    <div>
      <div class="big-num">${avgScore}%</div>
      <div>Rata-rata skor kesesuaian</div>
    </div>
    <div style="margin-top:10px">
      <div><strong>${highScore.toLocaleString()}</strong> dari <strong>${totalCells.toLocaleString()}</strong> sel skor tinggi</div>
      <div><strong>${selectedPoints.length}</strong> titik potensial dipilih</div>
    </div>
  `;

  if (selectedPoints.length > 0) {
    html += '<div style="margin-top:8px;font-size:0.8rem">';
    selectedPoints.forEach((p, i) => {
      html += `<div>📍 ${p.name}: Lat ${p.lat.toFixed(4)}, Lng ${p.lng.toFixed(4)} ${p.score !== '-' ? '| Skor: '+p.score+'%' : ''}</div>`;
    });
    html += '</div>';
  }

  summary.innerHTML = html;
}

// ===== EXPORT =====
document.getElementById('btn-export').addEventListener('click', function() {
  if (selectedPoints.length === 0) {
    alert('Belum ada titik yang dipilih. Klik pada peta untuk menandai titik potensial.');
    return;
  }

  let csv = 'No,Nama,Latitude,Longitude,Skor_Kesesuaian
';
  selectedPoints.forEach((p, i) => {
    const score = p.score !== '-' ? parseInt(p.score) : '';
    csv += `${i+1},"${p.name}",${p.lat.toFixed(6)},${p.lng.toFixed(6)},${score}
`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `titik_potensial_${currentBisnis}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

// ===== RESET =====
document.getElementById('btn-reset').addEventListener('click', function() {
  drawnItems.clearLayers();
  selectedPoints = [];
  updateResults();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', initMap);
