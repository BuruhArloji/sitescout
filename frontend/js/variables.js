// === SITESCOUT — Variable Config with Weights + Custom Business ===
// Phase 3: Multi-bisnis + custom creator + weight adjustment

// Pre-defined business types
const BISNIS_CONFIG = {
  apotek: {
    icon: "💊",
    label: "Apotek",
    kelompok: [
      {
        nama: "Demand",
        weight: 35,
        variabel: [
          { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 20000, weight: 30, higherBetter: true, desc: "Semakin padat, semakin tinggi potensi" },
          { id: "demand_rumahsakit", label: "Jarak ke Rumah Sakit", unit: "meter", min: 0, max: 5000, default: 1000, weight: 25, higherBetter: false, desc: "Semakin dekat, semakin baik" },
          { id: "demand_klinik", label: "Jarak ke Klinik", unit: "meter", min: 0, max: 3000, default: 500, weight: 20, higherBetter: false, desc: "Dekat fasilitas kesehatan" },
          { id: "demand_resep", label: "Potensi Resep Obat", unit: "%", min: 0, max: 100, default: 50, weight: 25, higherBetter: true, desc: "Estimasi permintaan resep" }
        ]
      },
      {
        nama: "Kompetitor",
        weight: 30,
        variabel: [
          { id: "komp_apotek", label: "Jumlah Apotek di Radius 1km", unit: "unit", min: 0, max: 20, default: 5, weight: 60, higherBetter: false, desc: "Makin sedikit makin baik" },
          { id: "komp_jarak", label: "Jarak ke Apotek Terdekat", unit: "meter", min: 0, max: 2000, default: 500, weight: 40, higherBetter: true, desc: "Hindari terlalu berdekatan" }
        ]
      },
      {
        nama: "Aksesibilitas",
        weight: 20,
        variabel: [
          { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 500, default: 50, weight: 60, higherBetter: false, desc: "Makin dekat ke jalan utama makin baik" },
          { id: "akses_pemukiman", label: "Jarak ke Pemukiman", unit: "meter", min: 0, max: 1000, default: 200, weight: 40, higherBetter: false, desc: "Dekat dengan area hunian" }
        ]
      },
      {
        nama: "Regulasi",
        weight: 15,
        variabel: [
          { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 60, weight: 50, higherBetter: true, desc: "Koefisien Dasar Bangunan" },
          { id: "reg_klb", label: "KLB Maksimal", unit: "kali", min: 0, max: 10, default: 3, weight: 50, higherBetter: true, desc: "Koefisien Luas Bangunan" }
        ]
      }
    ]
  },

  minimarket: {
    icon: "🏪", label: "Minimarket",
    kelompok: [
      { nama: "Demand", weight: 40, variabel: [
        { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 15000, weight: 35, higherBetter: true, desc: "Area padat penduduk" },
        { id: "demand_perumahan", label: "Jarak ke Perumahan", unit: "meter", min: 0, max: 2000, default: 300, weight: 35, higherBetter: false, desc: "Dekat cluster perumahan" },
        { id: "demand_kantor", label: "Jarak ke Kantor", unit: "meter", min: 0, max: 3000, default: 500, weight: 30, higherBetter: false, desc: "Area kerja banyak karyawan" }
      ]},
      { nama: "Kompetitor", weight: 30, variabel: [
        { id: "komp_minimarket", label: "Jumlah Minimarket di Radius 1km", unit: "unit", min: 0, max: 15, default: 3, weight: 60, higherBetter: false, desc: "Hindari area jenuh" },
        { id: "komp_pasar", label: "Jarak ke Pasar Tradisional", unit: "meter", min: 0, max: 3000, default: 1000, weight: 40, higherBetter: true, desc: "Bisa jadi kompetitor" }
      ]},
      { nama: "Aksesibilitas", weight: 20, variabel: [
        { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 200, default: 30, weight: 60, higherBetter: false, desc: "Visibility penting" },
        { id: "akses_parkir", label: "Ketersediaan Parkir", unit: "%", min: 0, max: 100, default: 70, weight: 40, higherBetter: true, desc: "Area parkir memadai" }
      ]},
      { nama: "Regulasi", weight: 10, variabel: [
        { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 60, weight: 100, higherBetter: true, desc: "Koefisien Dasar Bangunan" }
      ]}
    ]
  },

  restoran: {
    icon: "🍽️", label: "Restoran",
    kelompok: [
      { nama: "Demand", weight: 40, variabel: [
        { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 10000, weight: 25, higherBetter: true, desc: "Area ramai" },
        { id: "demand_kantor", label: "Jarak ke Pusat Perkantoran", unit: "meter", min: 0, max: 3000, default: 500, weight: 40, higherBetter: false, desc: "Lunch crowd" },
        { id: "demand_sekolah", label: "Jarak ke Sekolah/Kampus", unit: "meter", min: 0, max: 3000, default: 800, weight: 35, higherBetter: false, desc: "Pelajar dan mahasiswa" }
      ]},
      { nama: "Kompetitor", weight: 25, variabel: [
        { id: "komp_resto", label: "Jumlah Restoran di Radius 500m", unit: "unit", min: 0, max: 30, default: 10, weight: 100, higherBetter: false, desc: "Persaingan kuliner" }
      ]},
      { nama: "Aksesibilitas", weight: 25, variabel: [
        { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 200, default: 20, weight: 60, higherBetter: false, desc: "Visibility sangat penting" },
        { id: "akses_parkir", label: "Ketersediaan Parkir", unit: "%", min: 0, max: 100, default: 60, weight: 40, higherBetter: true, desc: "Area parkir yang cukup" }
      ]},
      { nama: "Regulasi", weight: 10, variabel: [
        { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 60, weight: 100, higherBetter: true, desc: "Koefisien Dasar Bangunan" }
      ]}
    ]
  },

  klinik: {
    icon: "🏥", label: "Klinik",
    kelompok: [
      { nama: "Demand", weight: 35, variabel: [
        { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 15000, weight: 35, higherBetter: true, desc: "Area padat penduduk" },
        { id: "demand_lansia", label: "Proporsi Penduduk Lansia", unit: "%", min: 0, max: 50, default: 15, weight: 30, higherBetter: true, desc: "Segmentasi usia lanjut" },
        { id: "demand_rs", label: "Jarak ke Rumah Sakit", unit: "meter", min: 0, max: 10000, default: 3000, weight: 35, higherBetter: false, desc: "Suplemen RS" }
      ]},
      { nama: "Kompetitor", weight: 25, variabel: [
        { id: "komp_klinik", label: "Jumlah Klinik di Radius 2km", unit: "unit", min: 0, max: 30, default: 8, weight: 100, higherBetter: false, desc: "Persaingan layanan kesehatan" }
      ]},
      { nama: "Aksesibilitas", weight: 20, variabel: [
        { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 500, default: 50, weight: 55, higherBetter: false, desc: "Mudah dijangkau pasien" },
        { id: "akses_transportasi", label: "Dekat Transportasi Umum", unit: "%", min: 0, max: 100, default: 70, weight: 45, higherBetter: true, desc: "Akses angkutan umum" }
      ]},
      { nama: "Regulasi", weight: 20, variabel: [
        { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 50, weight: 50, higherBetter: true, desc: "Koefisien Dasar Bangunan" },
        { id: "reg_kdh", label: "KDH Minimal", unit: "%", min: 0, max: 50, default: 20, weight: 50, higherBetter: true, desc: "Koefisien Daerah Hijau" }
      ]}
    ]
  },

  kantor: {
    icon: "🏢", label: "Kantor",
    kelompok: [
      { nama: "Demand", weight: 25, variabel: [
        { id: "demand_bisnis", label: "Kepadatan Bisnis", unit: "%", min: 0, max: 100, default: 60, weight: 50, higherBetter: true, desc: "Pusat kegiatan bisnis" },
        { id: "demand_tenaga", label: "Ketersediaan Tenaga Kerja", unit: "%", min: 0, max: 100, default: 50, weight: 50, higherBetter: true, desc: "Akses ke talent pool" }
      ]},
      { nama: "Aksesibilitas", weight: 45, variabel: [
        { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 500, default: 100, weight: 30, higherBetter: false, desc: "Mudah diakses" },
        { id: "akses_tol", label: "Jarak dari Pintu Tol", unit: "meter", min: 0, max: 10000, default: 3000, weight: 35, higherBetter: false, desc: "Konektivitas antar kota" },
        { id: "akses_transit", label: "Jarak ke Stasiun/Halte", unit: "meter", min: 0, max: 2000, default: 500, weight: 35, higherBetter: false, desc: "Transportasi massal" }
      ]},
      { nama: "Regulasi", weight: 30, variabel: [
        { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 50, weight: 40, higherBetter: true, desc: "Koefisien Dasar Bangunan" },
        { id: "reg_klb", label: "KLB Maksimal", unit: "kali", min: 0, max: 10, default: 4, weight: 60, higherBetter: true, desc: "Semakin tinggi semakin banyak lantai" }
      ]}
    ]
  }
};

// Custom business types (user-created)
let CUSTOM_BISNIS = {};

// Save custom business to localStorage
function saveCustomBusiness() {
  try {
    localStorage.setItem('sitescout_custom_bisnis', JSON.stringify(CUSTOM_BISNIS));
  } catch(e) { /* ignore */ }
}

// Load custom business from localStorage
function loadCustomBusiness() {
  try {
    const saved = localStorage.getItem('sitescout_custom_bisnis');
    if (saved) CUSTOM_BISNIS = JSON.parse(saved);
  } catch(e) { /* ignore */ }
}

// Get all business types (built-in + custom)
function getAllBusinessTypes() {
  return { ...BISNIS_CONFIG, ...CUSTOM_BISNIS };
}

// Get config for a business type
function getBusinessConfig(type) {
  return getAllBusinessTypes()[type] || null;
}
