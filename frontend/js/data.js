// === SITESCOUT — Data Loader (Supabase) ===
// Phase 4: fetch data real dari Supabase PostGIS

const SUPABASE_URL = 'https://vtwolnilfejqlbjftspk.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_nqP5SriCUsp-VssEmcsHZg_p0SEpIY_'

async function fetchFromSupabase(endpoint, params = {}) {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString()
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${query}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  })
  if (!res.ok) throw new Error(`Supabase: ${res.status} ${res.statusText}`)
  return res.json()
}

// Fetch ALL rows from Supabase with automatic pagination (1000 rows per page)
async function fetchAllFromSupabase(endpoint, params = {}) {
  const pageSize = 1000
  let allData = []
  let start = 0
  let total = null

  const query = typeof params === 'string' ? params : new URLSearchParams({...params, limit: pageSize.toString()}).toString()

  // Dapatkan total count dulu via query HEAD
  const countUrl = `${SUPABASE_URL}/rest/v1/${endpoint}?select=count&limit=0`
  const countRes = await fetch(countUrl, {
    method: 'HEAD',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'count=exact'
    }
  })
  const countHeader = countRes.headers.get('content-range')
  if (countHeader) {
    const m = countHeader.match(/\/(\d+)/)
    if (m) total = parseInt(m[1])
  }
  // fallback kalo nggak dapet count
  if (!total) total = 50000

  while (start < total) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${query}`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${start}-${Math.min(start + pageSize - 1, total - 1)}`
      }
    })
    if (!res.ok) throw new Error(`Supabase: ${res.status}`)
    const data = await res.json()
    allData = allData.concat(data)
    if (data.length < pageSize) break
    start += pageSize
  }

  return allData
}

async function loadSpatialData() {
  return true
}

async function loadPOIData(bounds, kategoriFilter = null) {
  const b = bounds
  let query = `select=id,nama,kategori,lat,lng,rating,geom&order=kategori.asc`
  if (b) {
    query += `&and=(and(lat.gte.${b[0][0]},lat.lte.${b[1][0]},lng.gte.${b[0][1]},lng.lte.${b[1][1]}))`
  }
  if (kategoriFilter) {
    query += `&kategori=ilike.*${encodeURIComponent(kategoriFilter)}*`
  }
  return fetchFromSupabase('jakarta_poi', query)
}

async function loadPOICategories() {
  const data = await fetchFromSupabase('jakarta_poi', {
    select: 'kategori',
    limit: '20404',
    order: 'kategori.asc'
  })
  const cats = {}
  for (const item of data) {
    const k = item.kategori || 'Lainnya'
    cats[k] = (cats[k] || 0) + 1
  }
  // Sort by count descending
  return Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ kategori: k, count: v }))
}

async function loadVariableData(bisnisType, bounds) {
  // Mapping bisnis type ke keyword kategori POI
  const keywordMap = {
    apotek: 'Apotek',
    minimarket: 'Minimarket',
    restoran: 'Restoran',
    klinik: 'Klinik',
    kantor: 'Kantor'
  }
  const keyword = keywordMap[bisnisType]
  if (!keyword) return []
  return loadPOIData(bounds, keyword)
}

// ===== ZONING =====
async function loadZoningInBounds(bounds) {
  const [sw, ne] = bounds
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_zoning_in_bbox`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      min_lng: sw[1], min_lat: sw[0],
      max_lng: ne[1], max_lat: ne[0],
      row_limit: 5000
    })
  })
  if (!res.ok) return null
  const features = await res.json()
  return { type: 'FeatureCollection', features }
}


// ===== REAL DATA FOR SCORING =====

// Fetch all POI of a specific category in Jakarta bounds
async function loadPOIByCategory(kategori) {
  const data = await fetchFromSupabase('jakarta_poi', {
    select: 'id,nama,kategori,lat,lng',
    kategori: `ilike.*${kategori}*`,
    limit: '5000'
  })
  return data.map(d => ({
    type: 'Feature',
    properties: { id: d.id, nama: d.nama, kategori: d.kategori },
    geometry: { type: 'Point', coordinates: [d.lng, d.lat] }
  }))
}

// Count POI in each grid cell using the lightweight grid helpers.
function countPOIPerCell(gridCells, poiFeatures, radiusKm = 0.5) {
  if (!poiFeatures || poiFeatures.length === 0) return gridCells
  const poiRows = poiFeatures.map(feature => ({
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0]
  }))

  return gridCells.map(cell => {
    let poiCount = 0
    let poiNearby = 0
    let minDist = Infinity

    for (const p of poiRows) {
      if (pointInCell(p.lat, p.lng, cell)) poiCount++
      const d = distanceKm(cell.properties.center_lat, cell.properties.center_lng, p.lat, p.lng)
      if (d <= radiusKm) poiNearby++
      if (d < minDist) minDist = d
    }

    cell.properties.poi_count = poiCount
    cell.properties.poi_nearby = poiNearby
    cell.properties.nearest_poi_km = minDist === Infinity ? 5 : minDist
    return cell
  })
}

// Build real variable values for a cell
function getRealVariables(cell, bisnisType) {
  // Mapping bisnis type -> competitor category
  const competitorMap = {
    apotek: 'Apotek',
    minimarket: 'Minimarket',
    restoran: 'Restoran',
    klinik: 'Klinik',
    kantor: 'Kantor'
  }
  
  return {
    // Competitor variables - from real data
    komp_count: cell.properties.poi_count || 0,
    komp_nearby: cell.properties.poi_nearby || 0,
    komp_nearest_km: cell.properties.nearest_poi_km || 5,
    
    // For now, other variables still use defaults
    // Will be replaced with real data as we upload more datasets
    demand_penduduk: 20000,
    akses_jalan: 50,
    reg_kdb: 60,
    reg_klb: 3
  }
}
