# 🌐 SiteScout — Web GIS Ekspansi Cabang

Web GIS interaktif untuk analisis lokasi potensial ekspansi bisnis multisektor.

## 🚀 Cara Menjalankan

1. Buka `frontend/index.html` untuk beranda Reach Platform
2. Klik **Open SiteScout** untuk masuk ke workspace peta (`frontend/app.html`)
3. Atau deploy ke Vercel/Netlify dengan drag-and-drop folder `frontend/`

## 📁 Struktur Project

```
WebGIS/
├─ frontend/              # Web app (static, bisa langsung dibuka)
│  ├─ index.html          # Halaman utama
│  ├─ css/style.css       # Styling
│  ├─ js/
│  │  ├─ variables.js     # Konfigurasi variabel per bisnis
│  │  ├─ analysis.js      # Scoring engine (Turf.js)
│  │  ├─ data.js          # Data loader (placeholder)
│  │  └─ app.js           # Main app logic
│  └─ data/               # GeoJSON data (nanti diisi)
├─ backend/               # FastAPI backend (Phase 2)
│  └─ scripts/
│     └─ process_data.py  # ETL data spasial ke GeoJSON
└─ README.md
```

## 🧩 Jenis Bisnis yang Didukung
- 💊 Apotek
- 🏪 Minimarket
- 🍽️ Restoran
- 🏥 Klinik
- 🏢 Kantor

## 📊 Variabel Analisis
Setiap bisnis memiliki 3-4 kelompok variabel:
- **Demanda** — kepadatan penduduk, fasilitas sekitar
- **Kompetitor** — jumlah pesaing, jarak minimal
- **Aksesibilitas** — jarak jalan utama, transportasi
- **Regulasi** — KDB, KLB, KDH (dari RDTR zoning)

## 🔜 Fase Selanjutnya
- **Phase 2:** Backend FastAPI + PostGIS + Supabase
- **Phase 3:** Multi-bisnis config editor + export GeoJSON
- **Phase 4:** Integrasi data real (RDTR, OSM, apotek)
