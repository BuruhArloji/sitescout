// === Konfigurasi Variabel per Jenis Bisnis ===
// Tiap variabel: { id, label, unit, min, max, default, desc }

const BISNIS_CONFIG = {
  apotek: {
    icon: "💊",
    label: "Apotek",
    kelompok: [
      {
        nama: "Demanda",
        variabel: [
          { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 20000, desc: "Semakin padat, semakin tinggi potensi" },
          { id: "demand_rumahsakit", label: "Jarak ke Rumah Sakit", unit: "meter", min: 0, max: 5000, default: 1000, desc: "Semakin dekat, semakin baik" },
          { id: "demand_klinik", label: "Jarak ke Klinik", unit: "meter", min: 0, max: 3000, default: 500, desc: "Dekat fasilitas kesehatan" },
          { id: "demand_resep", label: "Potensi Resep Obat", unit: "%", min: 0, max: 100, default: 50, desc: "Estimasi permintaan resep" }
        ]
      },
      {
        nama: "Kompetitor",
        variabel: [
          { id: "komp_apotek", label: "Jumlah Apotek di Radius 1km", unit: "unit", min: 0, max: 20, default: 5, desc: "Makin sedikit makin baik" },
          { id: "komp_jarak", label: "Jarak ke Apotek Terdekat", unit: "meter", min: 0, max: 2000, default: 500, desc: "Hindari terlalu berdekatan" }
        ]
      },
      {
        nama: "Aksesibilitas",
        variabel: [
          { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 500, default: 50, desc: "Makin dekat ke jalan utama makin baik" },
          { id: "akses_pemukiman", label: "Jarak ke Pemukiman", unit: "meter", min: 0, max: 1000, default: 200, desc: "Dekat dengan area hunian" }
        ]
      },
      {
        nama: "Regulasi",
        variabel: [
          { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 60, desc: "Koefisien Dasar Bangunan" },
          { id: "reg_klb", label: "KLB Maksimal", unit: "kali", min: 0, max: 10, default: 3, desc: "Koefisien Luas Bangunan" }
        ]
      }
    ]
  },

  minimarket: {
    icon: "🏪",
    label: "Minimarket",
    kelompok: [
      {
        nama: "Demanda",
        variabel: [
          { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 15000, desc: "Area padat penduduk" },
          { id: "demand_perumahan", label: "Jarak ke Perumahan", unit: "meter", min: 0, max: 2000, default: 300, desc: "Dekat cluster perumahan" },
          { id: "demand_kantor", label: "Jarak ke Kantor/Perkantoran", unit: "meter", min: 0, max: 3000, default: 500, desc: "Area kerja banyak karyawan" }
        ]
      },
      {
        nama: "Kompetitor",
        variabel: [
          { id: "komp_minimarket", label: "Jumlah Minimarket di Radius 1km", unit: "unit", min: 0, max: 15, default: 3, desc: "Hindari area jenuh" },
          { id: "komp_pasar", label: "Jarak ke Pasar Tradisional", unit: "meter", min: 0, max: 3000, default: 1000, desc: "Bisa jadi kompetitor atau pelengkap" }
        ]
      },
      {
        nama: "Aksesibilitas",
        variabel: [
          { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 200, default: 30, desc: "Visibility penting untuk retail" },
          { id: "akses_parkir", label: "Ketersediaan Parkir", unit: "%", min: 0, max: 100, default: 70, desc: "Area parkir memadai" }
        ]
      },
      {
        nama: "Regulasi",
        variabel: [
          { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 60, desc: "Koefisien Dasar Bangunan" }
        ]
      }
    ]
  },

  restoran: {
    icon: "🍽️",
    label: "Restoran",
    kelompok: [
      {
        nama: "Demanda",
        variabel: [
          { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 10000, desc: "Area ramai" },
          { id: "demand_kantor", label: "Jarak ke Pusat Perkantoran", unit: "meter", min: 0, max: 3000, default: 500, desc: "Lunch crowd" },
          { id: "demand_sekolah", label: "Jarak ke Sekolah/Kampus", unit: "meter", min: 0, max: 3000, default: 800, desc: "Pelajar dan mahasiswa" }
        ]
      },
      {
        nama: "Kompetitor",
        variabel: [
          { id: "komp_resto", label: "Jumlah Restoran di Radius 500m", unit: "unit", min: 0, max: 30, default: 10, desc: "Persaingan kuliner" }
        ]
      },
      {
        nama: "Aksesibilitas",
        variabel: [
          { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 200, default: 20, desc: "Visibility sangat penting" },
          { id: "akses_parkir", label: "Ketersediaan Parkir", unit: "%", min: 0, max: 100, default: 60, desc: "Area parkir yang cukup" }
        ]
      },
      {
        nama: "Regulasi",
        variabel: [
          { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 60, desc: "Koefisien Dasar Bangunan" }
        ]
      }
    ]
  },

  klinik: {
    icon: "🏥",
    label: "Klinik",
    kelompok: [
      {
        nama: "Demanda",
        variabel: [
          { id: "demand_penduduk", label: "Kepadatan Penduduk", unit: "jiwa/km²", min: 0, max: 50000, default: 15000, desc: "Area padat penduduk" },
          { id: "demand_lansia", label: "Proporsi Penduduk Lansia", unit: "%", min: 0, max: 50, default: 15, desc: "Segmentasi usia lanjut" },
          { id: "demand_rs", label: "Jarak ke Rumah Sakit", unit: "meter", min: 0, max: 10000, default: 3000, desc: "Suplemen RS, jangan terlalu dekat" }
        ]
      },
      {
        nama: "Kompetitor",
        variabel: [
          { id: "komp_klinik", label: "Jumlah Klinik di Radius 2km", unit: "unit", min: 0, max: 30, default: 8, desc: "Persaingan layanan kesehatan" }
        ]
      },
      {
        nama: "Aksesibilitas",
        variabel: [
          { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 500, default: 50, desc: "Mudah dijangkau pasien" },
          { id: "akses_transportasi", label: "Dekat Transportasi Umum", unit: "%", min: 0, max: 100, default: 70, desc: "Akses angkutan umum" }
        ]
      },
      {
        nama: "Regulasi",
        variabel: [
          { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 50, desc: "Koefisien Dasar Bangunan" },
          { id: "reg_kdh", label: "KDH Minimal", unit: "%", min: 0, max: 50, default: 20, desc: "Koefisien Daerah Hijau" }
        ]
      }
    ]
  },

  kantor: {
    icon: "🏢",
    label: "Kantor",
    kelompok: [
      {
        nama: "Demanda",
        variabel: [
          { id: "demand_bisnis", label: "Kepadatan Bisnis/Lokasi Strategis", unit: "%", min: 0, max: 100, default: 60, desc: "Pusat kegiatan bisnis" },
          { id: "demand_tenaga", label: "Ketersediaan Tenaga Kerja", unit: "%", min: 0, max: 100, default: 50, desc: "Akses ke talent pool" }
        ]
      },
      {
        nama: "Aksesibilitas",
        variabel: [
          { id: "akses_jalan", label: "Jarak dari Jalan Utama", unit: "meter", min: 0, max: 500, default: 100, desc: "Mudah diakses" },
          { id: "akses_tol", label: "Jarak dari Pintu Tol", unit: "meter", min: 0, max: 10000, default: 3000, desc: "Konektivitas antar kota" },
          { id: "akses_transit", label: "Jarak ke Stasiun/Halte", unit: "meter", min: 0, max: 2000, default: 500, desc: "Transportasi massal" }
        ]
      },
      {
        nama: "Regulasi",
        variabel: [
          { id: "reg_kdb", label: "KDB Maksimal", unit: "%", min: 0, max: 100, default: 50, desc: "Koefisien Dasar Bangunan" },
          { id: "reg_klb", label: "KLB Maksimal", unit: "kali", min: 0, max: 10, default: 4, desc: "Semakin tinggi semakin banyak lantai" }
        ]
      }
    ]
  }
};
