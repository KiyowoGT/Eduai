export const EDUCATION_LEVELS = ["SD", "SMP", "SMA", "SMK", "MA", "MAK"];

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
  MAK: [],
};

export function hasMajor(level) {
  return !!(MAJORS[level] && MAJORS[level].length > 0);
}

export function gradeOptions(level) {
  // returns [{value, label}]
  if (level === "SD") return [1,2,3,4,5,6].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (level === "SMP") return [7,8,9].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (["SMA","SMK","MA","MAK"].includes(level)) return [10,11,12].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  return [];
}

export function gradeLabel(level, n) {
  if (!n) return "";
  return `Kelas ${n}`;
}

export function institutionLabel(level) {
  return "Nama Sekolah";
}

export function institutionPlaceholder(level) {
  if (level === "SMK" || level === "MAK") return "Misal: SMKN 1 Jakarta";
  if (level === "MA") return "Misal: MAN 1 Bandung";
  return "Misal: SMAN 3 Bandung / SMP Labschool";
}
