const JURUSAN = {
  SMA: [
    {
      label: "MIPA (Matematika & Ilmu Pengetahuan Alam)",
      value: "MIPA",
      detail: "Fisika, Kimia, Biologi, Informatika, Matematika Tingkat Lanjut",
    },
    {
      label: "IPS (Ilmu Pengetahuan Sosial)",
      value: "IPS",
      detail: "Sosiologi, Ekonomi, Geografi, Antropologi",
    },
    {
      label: "Bahasa dan Budaya",
      value: "Bahasa",
      detail: "Bahasa Indonesia Tingkat Lanjut, Bahasa Inggris Tingkat Lanjut, Bahasa Asing",
    },
    {
      label: "Vokasi dan Prakarya",
      value: "Vokasi",
      detail: "Seni dan Prakarya/Kewirausahaan",
    },
  ],
  MA: [
    {
      label: "Umum MIPA",
      value: "MIPA",
      detail: "Sains, Matematika, Ilmu Pengetahuan Alam",
    },
    {
      label: "Umum IPS",
      value: "IPS",
      detail: "Ilmu Pengetahuan Sosial",
    },
    {
      label: "Umum Bahasa",
      value: "Bahasa",
      detail: "Bahasa dan Sastra",
    },
    {
      label: "Peminatan Keagamaan Islam",
      value: "Agama Islam",
      detail: "Tafsir, Hadis, Fikih, Ilmu Kalam, Bahasa Arab Keagamaan",
    },
  ],
  SMK: [
    {
      label: "Teknologi Informasi",
      value: "Teknologi Informasi",
      detail: "PPLG, TJKT",
    },
    {
      label: "Bisnis dan Manajemen",
      value: "Bisnis dan Manajemen",
      detail: "Akuntansi, Perbankan Syariah, Manajemen Perkantoran, Pemasaran Digital",
    },
    {
      label: "Seni dan Ekonomi Kreatif",
      value: "Seni dan Ekonomi Kreatif",
      detail: "DKV, Animasi, Produksi Film, Kriya Kreatif",
    },
    {
      label: "Teknologi Manufaktur & Rekayasa",
      value: "Teknologi Manufaktur & Rekayasa",
      detail: "Teknik Pemesinan, Otomotif, Mekatronika, Pengelasan",
    },
    {
      label: "Energi dan Pertambangan",
      value: "Energi dan Pertambangan",
      detail: "Geologi Pertambangan, Teknik Perminyakan",
    },
    {
      label: "Teknologi Konstruksi & Properti",
      value: "Teknologi Konstruksi & Properti",
      detail: "DPIB, Konstruksi Jalan dan Jembatan, Teknik Konstruksi",
    },
    {
      label: "Agribisnis dan Agronologi",
      value: "Agribisnis dan Agronologi",
      detail: "ATPH, Agribisnis Ternak, Kesehatan Hewan",
    },
    {
      label: "Kemaritiman",
      value: "Kemaritiman",
      detail: "Nautika, Teknika, Agribisnis Perikanan",
    },
    {
      label: "Pariwisata, Kuliner & Layanan Kesehatan",
      value: "Pariwisata, Kuliner & Layanan Kesehatan",
      detail: "Kuliner, Busana, Perhotelan, Keperawatan, Farmasi",
    },
  ],
};

export function getJurusanByLevel(level) {
  const key = level?.toUpperCase();
  if (JURUSAN[key]) return JURUSAN[key];
  if (key === "SMK" || key === "MAK") return JURUSAN.SMK;
  if (key === "MA") return JURUSAN.MA;
  if (["SMA", "SMP", "SD"].includes(key)) return JURUSAN.SMA;
  return [];
}

export function getJurusanValues(level) {
  return getJurusanByLevel(level).map((j) => j.value);
}

export function parseMajorFromClass(className, level) {
  if (!className) return "";
  const values = getJurusanValues(level);
  const tokens = className.split(" ");
  // Try longest match first (for multi-word jurusan like "Teknologi Informasi")
  for (let len = tokens.length - 2; len >= 1; len--) {
    for (let i = 1; i + len <= tokens.length - 1; i++) {
      const candidate = tokens.slice(i, i + len).join(" ");
      if (values.includes(candidate)) return candidate;
    }
  }
  return "";
}

export default JURUSAN;
