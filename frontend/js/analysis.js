// === SCORING ENGINE — Phase 3 ===
// Weighted scoring dengan group weights + variable weights

function getScoreColor(score) {
  const colors = [
    { min: 0.8, color: '#4fffb0', label: 'Sangat Sesuai' },
    { min: 0.6, color: '#88d66c', label: 'Sesuai' },
    { min: 0.4, color: '#ffd166', label: 'Cukup' },
    { min: 0.2, color: '#ff8a5b', label: 'Kurang Sesuai' },
    { min: 0, color: '#ff5f6d', label: 'Tidak Sesuai' }
  ];
  for (const c of colors) {
    if (score >= c.min) return c;
  }
  return colors[colors.length - 1];
}

function normalize(value, min, max, higherBetter = true) {
  if (max - min === 0) return 0.5;
  const normalized = (value - min) / (max - min);
  return higherBetter
    ? Math.max(0, Math.min(1, normalized))
    : Math.max(0, Math.min(1, 1 - normalized));
}

// === WEIGHTED SCORING ===
function calculateScore(cell, userVars, userWeights, userGroupWeights, bisnisType) {
  const config = getBusinessConfig(bisnisType);
  if (!config) return 0;

  let totalGroupWeight = 0;
  let weightedGroupSum = 0;

  for (const group of config.kelompok) {
    const groupWeight = (userGroupWeights && userGroupWeights[group.nama] != null)
      ? userGroupWeights[group.nama] : (group.weight || 25);
    
    let totalVarWeight = 0;
    let weightedVarSum = 0;

    for (const v of group.variabel) {
      const userVal = userVars[v.id] ?? v.default;
      const varWeight = (userWeights && userWeights[v.id] != null)
        ? userWeights[v.id] : (v.weight || 50);
      
      const higherBetter = v.higherBetter != null ? v.higherBetter : !v.id.startsWith('komp_');
      const score = normalize(userVal, v.min, v.max, higherBetter);
      
      weightedVarSum += score * (varWeight / 100);
      totalVarWeight += (varWeight / 100);  // normalized
    }

    const groupScore = totalVarWeight > 0 ? weightedVarSum / totalVarWeight : 0;
    weightedGroupSum += groupScore * (groupWeight / 100);
    totalGroupWeight += (groupWeight / 100);
  }

  return totalGroupWeight > 0 ? weightedGroupSum / totalGroupWeight : 0;
}

// === GRID GENERATION ===
function generateGrid(bounds, cellSize = 0.003) {
  const grid = [];
  for (let lat = bounds[0][0]; lat < bounds[1][0]; lat += cellSize) {
    for (let lng = bounds[0][1]; lng < bounds[1][1]; lng += cellSize) {
      const north = Math.min(lat + cellSize, bounds[1][0]);
      const east = Math.min(lng + cellSize, bounds[1][1]);
      const corners = [
        [lng, lat],
        [lng, north],
        [east, north],
        [east, lat],
        [lng, lat]
      ];
      grid.push({
        type: 'Feature',
        properties: {
          id: `cell_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          bbox: [lng, lat, east, north],
          center_lat: lat + (north - lat) / 2,
          center_lng: lng + (east - lng) / 2,
          score: 0
        },
        geometry: { type: 'Polygon', coordinates: [corners] }
      });
    }
  }
  return grid;
}

function enrichGridWithPOIMetrics(gridCells, poiRows, bounds, cellSize) {
  const latMin = bounds[0][0];
  const lngMin = bounds[0][1];
  const latMax = bounds[1][0];
  const lngMax = bounds[1][1];
  const columns = Math.ceil((lngMax - lngMin) / cellSize);
  const poiCoords = [];

  for (const cell of gridCells) {
    cell.properties.poi_count = 0;
    cell.properties.nearest_km = 10;
  }

  for (const row of poiRows) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) continue;

    poiCoords.push({ lat, lng });
    const rowIndex = Math.min(Math.floor((lat - latMin) / cellSize), Math.ceil((latMax - latMin) / cellSize) - 1);
    const colIndex = Math.min(Math.floor((lng - lngMin) / cellSize), columns - 1);
    const cell = gridCells[rowIndex * columns + colIndex];
    if (cell) cell.properties.poi_count += 1;
  }

  if (poiCoords.length === 0) return gridCells;

  for (const cell of gridCells) {
    const centerLat = cell.properties.center_lat;
    const centerLng = cell.properties.center_lng;
    let minDist = 10;

    for (const poi of poiCoords) {
      const d = distanceKm(centerLat, centerLng, poi.lat, poi.lng);
      if (d < minDist) minDist = d;
    }

    cell.properties.nearest_km = minDist;
  }

  return gridCells;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function pointInCell(lat, lng, cell) {
  const b = cell.properties.bbox;
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
}

// === DUMMY DATA ===
function getDummyDataPoints(bounds, bisnisType) {
  const points = [];
  const numPoints = 200 + Math.floor(Math.random() * 100);
  const latMin = bounds[0][0], latMax = bounds[1][0];
  const lngMin = bounds[0][1], lngMax = bounds[1][1];

  for (let i = 0; i < numPoints; i++) {
    const cluster = Math.random();
    let lat, lng;
    if (cluster < 0.3) {
      lat = latMin + (latMax - latMin) * (0.3 + Math.random() * 0.3);
      lng = lngMin + (lngMax - lngMin) * (0.4 + Math.random() * 0.3);
    } else if (cluster < 0.5) {
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
        population_density: Math.floor(Math.random() * 40000 + 5000),
        road_distance: Math.floor(Math.random() * 400 + 10),
        competitor_count: Math.floor(Math.random() * 15),
        building_count: Math.floor(Math.random() * 500 + 50)
      },
      geometry: { type: 'Point', coordinates: [lng, lat] }
    });
  }
  return points;
}
