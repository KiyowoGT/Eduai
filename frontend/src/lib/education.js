export const EDUCATION_LEVELS = ["SD", "SMP", "SMA", "SMK", "MA", "Universitas"];

export const MAJORS = {
  SD: [],
  SMP: [],
  SMA: [
    "MIPA (Matematika dan Ilmu Pengetahuan Alam)",
    "IPS (Ilmu Pengetahuan Sosial)",
    "Bahasa dan Budaya",
  ],
  MA: [
    "MIPA",
    "IPS",
    "Ilmu Bahasa dan Budaya",
    "Ilmu-ilmu Keagamaan",
  ],
  SMK: [
    "Rekayasa Perangkat Lunak (RPL)",
    "Teknik Komputer dan Jaringan (TKJ)",
    "Desain Komunikasi Visual (DKV) / Multimedia",
    "Akuntansi dan Keuangan Lembaga (AKL)",
    "Otomatisasi dan Tata Kelola Perkantoran (OTKP)",
    "Bisnis Daring dan Pemasaran (BDP)",
    "Teknik Kendaraan Ringan Otomotif (TKRO)",
    "Teknik Bisnis Sepeda Motor (TBSM)",
    "Teknik Instalasi Tenaga Listrik (TITL)",
    "Perhotelan",
    "Tata Boga",
    "Tata Busana",
    "Farmasi Klinis dan Komunitas",
    "Asisten Keperawatan",
    "Agribisnis Tanaman",
  ],
  Universitas: [
    "Informatika / Ilmu Komputer",
    "Sistem Informasi",
    "Teknik Elektro",
    "Teknik Sipil",
    "Teknik Industri",
    "Teknik Mesin",
    "Arsitektur",
    "Kedokteran",
    "Keperawatan",
    "Farmasi",
    "Kesehatan Masyarakat",
    "Agribisnis",
    "Akuntansi",
    "Manajemen",
    "Ilmu Hukum",
    "Ilmu Komunikasi",
    "Hubungan Internasional",
    "Administrasi Bisnis",
    "Administrasi Publik",
    "Psikologi",
    "Sastra Inggris",
    "Ilmu Politik",
    "Sosiologi",
    "Pendidikan Guru Sekolah Dasar (PGSD)",
    "Desain Komunikasi Visual (DKV)",
  ],
};

export function hasMajor(level) {
  return !!(MAJORS[level] && MAJORS[level].length > 0);
}

export function gradeOptions(level) {
  // returns [{value, label}]
  if (level === "SD") return [1,2,3,4,5,6].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (level === "SMP") return [7,8,9].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (["SMA","SMK","MA"].includes(level)) return [10,11,12].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (level === "Universitas") return [1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => ({ value: String(n), label: `Semester ${n}` }));
  return [];
}

export function gradeLabel(level, n) {
  if (!n) return "";
  if (level === "Universitas") return `Semester ${n}`;
  return `Kelas ${n}`;
}

export function institutionLabel(level) {
  if (level === "Universitas") return "Universitas";
  return "Nama Sekolah";
}

export function institutionPlaceholder(level) {
  if (level === "Universitas") return "Misal: UBSI / Universitas Indonesia";
  if (level === "SMK") return "Misal: SMKN 1 Jakarta";
  return "Misal: SMAN 3 Bandung / SMP Labschool";
}
