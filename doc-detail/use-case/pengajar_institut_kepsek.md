# Use Case: Pengajar Institut - Kepala Sekolah
**Peran:** Pimpinan institusi yang mengatur kebijakan akademik dan memantau performa sekolah secara makro.

## Fitur Utama
- Dashboard Makro: metrik sekolah (rata-rata nilai, distribusi nilai, engagement).
- Tahun Ajaran & Promosi: aktifkan tahun ajaran baru dan jalankan proses promosi kelas.
- Audit & Keamanan: akses audit log untuk aktivitas penting.
- SDM: manajemen akun guru dan peran.
- Governance: opsi persetujuan kuis pada level institusi sebelum publikasi.

## Alur Kerja
1. Gunakan Academic Summary untuk melihat jurusan/tingkatan yang perlu intervensi.
2. Validasi kebijakan pembelajaran (mis. approval flow untuk kuis institutional).
3. Atur kebijakan tahun ajaran dan kelola SDM.

## Mapping ke kode
- Frontend: admin dashboard pages
- API: endpoints untuk school-wide stats, audit logs, academic summary
- Notes: beberapa fitur (approval flow) bersifat opsional dan dapat diaktifkan pada konfigurasi institusi.