// === Scoring Engine (Turf.js) ===
// Menganalisis grid cells berdasarkan variabel yang dipilih user

const SCORE_COLORS = [
  { min: 0.8, color: '#1a9850', label: 'Sangat Sesuai' },
  { min: 0.6, color: '#91cf60', label: 'Sesuai' },
  { min: 0.4, color: '#fee08b', label: 'Cukup' },
  { min: 0.2, color: '#fc8d59', label: 'Kurang Sesuai' },
  { min: 0, color: '#d73027', label: 'Tidak Sesuai' }
];

function getScoreColor(score) {
  for (const c of SCORE_COLORS) {
    if (score >= c.min) return c;
  }
  return SCORE_COLORS[SCORE_COLORS.length - 1];
}

function normalize(value, min, max, higherIsBetter = true) {
  if (max - min === 0) return 0.5;
  const normalized = (value - min) / (max - min);
  if (higherIsBetter) {
    return Math.max(0, Math.min(1, normalized));
  } else {
    return Math.max(0, Math.min(1, 1 - normalized));
  }
}

// === MAIN SCORING FUNCTION ===
function calculateScore(cell, userVars, bisnisType) {
  const config = BISNIS_CONFIG[bisnisType];
  if (!config) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const group of config.kelompok) {
    for (const v of group.variabel) {
      const userVal = userVars[v.id] ?? v.default;
      const higherBetter = !v.id.startsWith('komp_'); // kompetitor = lower better
      const score = normalize(userVal, v.min, v.max, higherBetter);
      weightedSum += score;
      totalWeight++;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// === GRID GENERATION ===
function generateGrid(bounds, cellSize = 0.005) {
  const grid = [];
  for (let lat = bounds[0][0]; lat < bounds[1][0]; lat += cellSize) {
    for (let lng = bounds[0][1]; lng < bounds[1][1]; lng += cellSize) {
      const center = [(lat + cellSize / 2), (lng + cellSize / 2)];
      const corners = [
        [lat, lng],
        [lat + cellSize, lng],
        [lat + cellSize, lng + cellSize],
        [lat, lng + cellSize],
        [lat, lng]
      ];
      grid.push({
        type: 'Feature',
        properties: {
          id: `cell_${lat}_${lng}`,
          center_lat: center[0],
          center_lng: center[1],
          score: 0
        },
        geometry: {
          type: 'Polygon',
          coordinates: [corners]
        }
      });
    }
  }
  return grid;
}

// === SIMULATED DATA POINTS (for MVP demo) ===
// Real implementation akan menggunakan PostGIS query
function getDummyDataPoints(bounds, bisnisType) {
  const points = [];
  const numPoints = 200 + Math.floor(Math.random() * 100);
  
  const latMin = bounds[0][0];
  const latMax = bounds[1][0];
  const lngMin = bounds[0][1];
  const lngMax = bounds[1][1];

  for (let i = 0; i < numPoints; i++) {
    // Cluster points di area tertentu (simulasi data real)
    const cluster = Math.random();
    let lat, lng;
    
    if (cluster < 0.3) {
      // Cluster 1: area utara (padat)
      lat = latMin + (latMax - latMin) * (0.3 + Math.random() * 0.3);
      lng = lngMin + (lngMax - lngMin) * (0.4 + Math.random() * 0.3);
    } else if (cluster < 0.5) {
      // Cluster 2: area selatan
      lat = latMin + (latMax - latMin) * (0.5 + Math.random() * 0.3);
      lng = lngMin + (lngMax - lngMin) * (0.2 + Math.random() * 0.3);
    } else {
      lat = latMin + Math.random() * (latMax - latMin);
      lng = lngMin + Math.random() * (lngMax - lngMin);
    }

    points.push({
      type: 'Feature',
      properties: {
        id: `poi_${i}`,
        name: `${bisnisType}_sample_${i}`,
        // Simulated real data attributes
        population_density: Math.floor(Math.random() * 40000 + 5000),
        road_distance: Math.floor(Math.random() * 400 + 10),
        competitor_count: Math.floor(Math.random() * 15),
        building_count: Math.floor(Math.random() * 500 + 50)
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
  }
  return points;
}
