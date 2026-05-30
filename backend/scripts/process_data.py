#!/usr/bin/env python3
"""Proses data spasial existing untuk Web GIS.
Phase 4: Konversi GeoJSON besar jadi tile kecil untuk web.

Data sumber:
- D:\Land_Use\rdtr_2022_zoning.geojson (849 MB)
- D:\Land_Use\penggunaan_lahan.geojson (183 MB)
- D:\Building\04_final\jakarta_buildings_final.pq
- D:\Data Apotek Indonesia\* (data apotek)
"""

import os, json, glob
import geopandas as gpd
from shapely.geometry import box

OUTPUT_DIR = r"D:\WebGIS\frontend\data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def simplify_and_split(input_path, output_name, simplify_tol=0.0001):
    """Simplify geometry dan split jadi tiles kecil."""
    print(f"Loading {input_path}...")
    gdf = gpd.read_file(input_path)
    
    # Simplify untuk ukuran file lebih kecil
    gdf['geometry'] = gdf['geometry'].simplify(simplify_tol)
    
    # Filter kolom penting
    if 'KDB' in gdf.columns:
        keep_cols = [c for c in ['KDB', 'KLB', 'KDH', 'NAMOBJ', 'NAMZON', 'geometry'] if c in gdf.columns]
    else:
        keep_cols = ['geometry'] + [c for c in gdf.columns[:5] if c != 'geometry']
    
    gdf = gdf[keep_cols]
    
    # Save as simplified GeoJSON
    out_path = os.path.join(OUTPUT_DIR, output_name)
    gdf.to_file(out_path, driver='GeoJSON')
    size_mb = os.path.getsize(out_path) / 1_000_000
    print(f"  Saved: {out_path} ({size_mb:.1f} MB, {len(gdf):,} features)")
    return gdf

if __name__ == '__main__':
    # Proses RDTR zoning (ambil field penting aja)
    rdtr_path = r"D:\Land_Use\rdtr_2022_zoning.geojson"
    if os.path.exists(rdtr_path):
        simplify_and_split(rdtr_path, "zoning_simplified.geojson")
    
    # Proses penggunaan lahan
    lahan_path = r"D:\Land_Use\penggunaan_lahan.geojson"
    if os.path.exists(lahan_path):
        simplify_and_split(lahan_path, "penggunaan_lahan_simplified.geojson")
    
    print("\nDone!")
