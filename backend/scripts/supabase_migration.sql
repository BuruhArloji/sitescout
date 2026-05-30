-- === SiteScout — Supabase SQL Migration ===
-- Jalankan di Supabase SQL Editor (https://supabase.com/dashboard/project/xxx/sql/new)

-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Table: zoning_rdtr
CREATE TABLE IF NOT EXISTS zoning_rdtr (
  id SERIAL PRIMARY KEY,
  geom GEOMETRY(Polygon, 4326),
  namobj TEXT,
  namzon TEXT,
  kodzon TEXT,
  namszn TEXT,
  kodszn TEXT,
  kdb NUMERIC,
  klb NUMERIC,
  kdh NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zoning_geom ON zoning_rdtr USING GIST (geom);

-- 3. Table: bangunan_dki
CREATE TABLE IF NOT EXISTS bangunan_dki (
  id SERIAL PRIMARY KEY,
  geom GEOMETRY(Point, 4326),
  latitude NUMERIC,
  longitude NUMERIC,
  area_m2 NUMERIC,
  source TEXT,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bangunan_geom ON bangunan_dki USING GIST (geom);

-- 4. Table: site_scout_selections
CREATE TABLE IF NOT EXISTS site_scout_selections (
  id SERIAL PRIMARY KEY,
  lat NUMERIC,
  lng NUMERIC,
  business_type TEXT,
  score NUMERIC,
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_selections_geom ON site_scout_selections USING GIST (geom);

-- 5. Function: get_zoning_in_bbox
CREATE OR REPLACE FUNCTION get_zoning_in_bbox(
  min_lng NUMERIC, min_lat NUMERIC,
  max_lng NUMERIC, max_lat NUMERIC,
  row_limit INTEGER DEFAULT 5000
)
RETURNS JSON[] AS $$
DECLARE
  result JSON[];
BEGIN
  SELECT array_agg(json_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(z.geom)::json,
    'properties', json_build_object(
      'namobj', z.namobj,
      'namzon', z.namzon,
      'kdb', z.kdb,
      'klb', z.klb,
      'kdh', z.kdh
    )
  )) INTO result
  FROM zoning_rdtr z
  WHERE ST_Intersects(z.geom, ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326))
  LIMIT row_limit;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Function: get_building_density_grid
CREATE OR REPLACE FUNCTION get_building_density_grid(
  min_lng NUMERIC, min_lat NUMERIC,
  max_lng NUMERIC, max_lat NUMERIC
)
RETURNS TABLE(cell_id TEXT, count BIGINT, center_lat NUMERIC, center_lng NUMERIC) AS $$
DECLARE
  grid_size NUMERIC := 0.003; -- ~300m cells
BEGIN
  RETURN QUERY
  WITH grid AS (
    SELECT 
      ST_MakeEnvelope(
        min_lng + (x) * grid_size,
        min_lat + (y) * grid_size,
        min_lng + (x + 1) * grid_size,
        min_lat + (y + 1) * grid_size,
        4326
      ) AS cell_geom,
      format('%s_%s', x, y) AS cell_id,
      min_lng + (x + 0.5) * grid_size AS cx,
      min_lat + (y + 0.5) * grid_size AS cy
    FROM generate_series(0, floor((max_lng - min_lng) / grid_size)::int) x,
         generate_series(0, floor((max_lat - min_lat) / grid_size)::int) y
  )
  SELECT 
    g.cell_id,
    COUNT(b.id)::BIGINT,
    g.cy,
    g.cx
  FROM grid g
  LEFT JOIN bangunan_dki b ON ST_Within(b.geom, g.cell_geom)
  GROUP BY g.cell_id, g.cy, g.cx
  ORDER BY g.cy, g.cx;
END;
$$ LANGUAGE plpgsql;
