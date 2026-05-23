import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAdminTeachers } from "@/lib/api";
import { Search, UserPlus, MoreVertical, Users, Shield } from "lucide-react";

const titleLabels = {
  kepala_sekolah: "Kepala Sekolah",
  kurikulum: "Kurikulum",
  guru_kelas: "Guru Kelas",
  guru_pengajar: "Guru Pengajar",
};

export default function UserManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminTeachers()
      .then((d) => setTeachers(d?.teachers || []))
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Identitas & Akses</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Manajemen Akun</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · {teachers.length} guru terdaftar
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
          <input
            type="text"
            placeholder="Cari NIP, nama, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          />
        </div>
        <button
          onClick={() => navigate("/admin/users/teachers/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Guru
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-[#646675]">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          {search ? "Tidak ada guru yang cocok dengan pencarian." : "Belum ada guru terdaftar."}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E0D8] bg-[#F8F6F0]">
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Nama</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">NIP</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Email</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Jabatan</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Status</th>
                <th className="text-right py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.user_id || i} className="border-b border-[#E2E0D8]/50 last:border-0 hover:bg-[#F8F6F0]/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1D2D50] grid place-items-center text-xs font-bold text-[#E5A93C] shrink-0">
                        {t.name?.charAt(0) || "?"}
                      </div>
                      <div className="font-medium text-[#1A1B26]">{t.name}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#646675] font-mono text-xs">{t.nip || "-"}</td>
                  <td className="py-3 px-4 text-[#646675]">{t.email || "-"}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1D2D50]/10 text-[#1D2D50]">
                      {titleLabels[t.title] || t.title || "Guru"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === "active" || !t.status
                        ? "bg-[#2D6A4F]/10 text-[#2D6A4F]"
                        : "bg-[#A0A2B1]/10 text-[#646675]"
                    }`}>
                      {t.status === "active" || !t.status ? "Aktif" : t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => navigate(`/admin/users/teachers/${t.user_id}`)}
                      className="text-xs text-[#1D2D50] hover:text-[#B83A4B] transition-colors px-2 py-1 rounded-md hover:bg-[#F8F6F0]"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#1D2D50]/10 grid place-items-center">
            <Users className="w-5 h-5 text-[#1D2D50]" />
          </div>
          <div>
            <div className="text-2xl font-heading text-[#1A1B26]">{teachers.length}</div>
            <div className="text-xs text-[#646675]">Total Guru</div>
          </div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#E5A93C]/10 grid place-items-center">
            <Shield className="w-5 h-5 text-[#E5A93C]" />
          </div>
          <div>
            <div className="text-2xl font-heading text-[#1A1B26]">
              {teachers.filter((t) => t.title === "kepala_sekolah").length}
            </div>
            <div className="text-xs text-[#646675]">Admin</div>
          </div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#2D6A4F]/10 grid place-items-center">
            <Users className="w-5 h-5 text-[#2D6A4F]" />
          </div>
          <div>
            <div className="text-2xl font-heading text-[#1A1B26]">
              {teachers.filter((t) => t.title === "guru_kelas" || t.title === "guru_pengajar").length}
            </div>
            <div className="text-xs text-[#646675]">Pengajar Aktif</div>
          </div>
        </div>
      </div>
    </div>
  );
}
