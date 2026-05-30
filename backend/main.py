"""
SiteScout — Backend API
FastAPI + Supabase (PostGIS)
"""
import os
import json
import asyncio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SiteScout API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
supabase: Optional[Client] = None

def get_supabase() -> Client:
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise HTTPException(500, "Supabase not configured")
        supabase = create_client(url, key)
    return supabase

# ===== MODELS =====
class VariableConfig(BaseModel):
    business_type: str
    variables: dict

class PointSelection(BaseModel):
    lat: float
    lng: float
    business_type: str
    score: Optional[float] = None

# ===== ENDPOINTS =====

@app.get("/")
def root():
    return {"message": "SiteScout API aktif", "docs": "/docs"}

@app.get("/api/health")
def health():
    try:
        get_supabase()
        return {"status": "ok", "supabase": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# === BISNIS CONFIG ===
@app.get("/api/business-types")
def get_business_types():
    """Return available business types and their variable definitions."""
    from frontend_js_variables import BISNIS_CONFIG
    return BISNIS_CONFIG

# === SPATIAL QUERIES ===
@app.get("/api/zoning")
def get_zoning(
    bounds_w: float = Query(106.68),
    bounds_s: float = Query(-6.37),
    bounds_e: float = Query(106.98),
    bounds_n: float = Query(-6.08),
    limit: int = Query(5000)
):
    """Get RDTR zoning data within bounding box."""
    try:
        sb = get_supabase()
        # PostGIS bounding box query
        result = sb.rpc(
            "get_zoning_in_bbox",
            {
                "min_lng": bounds_w,
                "min_lat": bounds_s,
                "max_lng": bounds_e,
                "max_lat": bounds_n,
                "row_limit": limit
            }
        ).execute()
        return {"type": "FeatureCollection", "features": result.data}
    except Exception as e:
        raise HTTPException(500, f"Query failed: {str(e)}")

@app.get("/api/building-density")
def get_building_density(
    bounds_w: float = Query(106.68),
    bounds_s: float = Query(-6.37),
    bounds_e: float = Query(106.98),
    bounds_n: float = Query(-6.08)
):
    """Get building density grid (aggregated counts)."""
    try:
        sb = get_supabase()
        result = sb.rpc(
            "get_building_density_grid",
            {
                "min_lng": bounds_w,
                "min_lat": bounds_s,
                "max_lng": bounds_e,
                "max_lat": bounds_n,
            }
        ).execute()
        return {"data": result.data}
    except Exception as e:
        raise HTTPException(500, f"Query failed: {str(e)}")

# === SAVE USER SELECTIONS ===
@app.post("/api/save-selections")
def save_selections(points: List[PointSelection]):
    """Save user's selected potential locations."""
    try:
        sb = get_supabase()
        data = [p.model_dump() for p in points]
        result = sb.table("site_scout_selections").insert(data).execute()
        return {"status": "ok", "count": len(result.data)}
    except Exception as e:
        raise HTTPException(500, f"Save failed: {str(e)}")

# === RUN ANALYSIS (server-side) ===
class AnalysisRequest(BaseModel):
    business_type: str
    variables: dict
    bounds: dict  # {south, west, north, east}

@app.post("/api/analyze")
def run_analysis(req: AnalysisRequest):
    """
    Server-side weighted overlay analysis.
    Returns scored grid cells.
    """
    try:
        sb = get_supabase()
        result = sb.rpc(
            "run_site_analysis",
            {
                "p_business_type": req.business_type,
                "p_variables": json.dumps(req.variables),
                "p_min_lng": req.bounds.get("west", 106.68),
                "p_min_lat": req.bounds.get("south", -6.37),
                "p_max_lng": req.bounds.get("east", 106.98),
                "p_max_lat": req.bounds.get("north", -6.08),
            }
        ).execute()
        return {"type": "FeatureCollection", "features": result.data}
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
