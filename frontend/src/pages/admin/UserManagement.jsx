import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAdminTeachers, suspendUser, banUser } from "@/lib/api";
import { Search, Users, Shield, Ban, Clock, BanCircle, UserCheck } from "lucide-react";
import DualLoader from "@/components/DualLoader";

const roleLabels = {
  pengajar: "Pengajar",
  pelajar: "Pelajar",
  admin: "Admin",
  superadmin: "Super Admin",
};

export default function UserManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminTeachers()
      .then((d) => {
        const list = d?.users || d?.teachers || [];
        setUsers(list);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchName = u.name?.toLowerCase().includes(q);
    const matchEmail = u.email?.toLowerCase().includes(q);
    const matchRole = u.role?.toLowerCase().includes(q);
    return !q || matchName || matchEmail || matchRole;
  });

  const totalUsers = users.length;
  const totalStudents = users.filter((u) => u.role === "pelajar").length;
  const totalTeachers = users.filter((u) => u.role === "pengajar").length;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">System Operations</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Manajemen Akun</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          Schooly AI Core · {totalUsers} akun terdaftar
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
          <input
            type="text"
            placeholder="Cari nama, email, atau role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <DualLoader type="friends" text="Memuat daftar akun..." />
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          {search ? "Tidak ada akun yang cocok dengan pencarian." : "Belum ada akun terdaftar."}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E0D8] bg-[#F8F6F0]">
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Nama</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Email</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Role</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Status</th>
                <th className="text-right py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
                const isSuperadmin = u.is_superadmin;

                return (
                  <tr key={u.user_id || i} className="border-b border-[#E2E0D8]/50 last:border-0 hover:bg-[#F8F6F0]/50 transition-colors">
                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${isSuperadmin ? "bg-[#E5A93C] text-[#1D2D50]" : "bg-[#1D2D50] text-[#E5A93C]"}`}>
                          {u.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div className="font-medium text-[#1A1B26]">{u.name}</div>
                          {isSuperadmin && <div className="text-[10px] text-[#E5A93C] font-bold uppercase tracking-wider">Super Admin</div>}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-[#646675]">{u.email || "-"}</td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "pengajar" ? "bg-[#1D2D50]/10 text-[#1D2D50]" : u.role === "pelajar" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : "bg-[#E5A93C]/10 text-[#E5A93C]"}`}>
                        {roleLabels[u.role] || u.role || "-"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isSuspended ? "bg-red-50 text-red-600 font-medium" : "bg-[#2D6A4F]/10 text-[#2D6A4F]"}`}>
                        {isSuspended ? `Suspended` : "Aktif"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right flex justify-end gap-1">
                      {!isSuperadmin && (
                        <>
                          <button
                            onClick={async () => {
                              const durasi = prompt("Suspend user ini berapa menit?\n(misal: 60, 1440 untuk 1 hari, 10080 untuk 1 minggu)");
                              if (durasi && !isNaN(durasi)) {
                                try {
                                  await suspendUser(u.user_id, parseInt(durasi));
                                  alert(`Berhasil suspend user selama ${durasi} menit`);
                                  window.location.reload();
                                } catch (e) {
                                  alert("Gagal suspend user: " + (e.response?.data?.detail || e.message));
                                }
                              }
                            }}
                            className="p-2 text-[#E5A93C] hover:bg-[#E5A93C]/10 rounded-md transition-colors"
                            title="Suspend Sementara"
                          >
                            <Clock className="w-4 h-4" />
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`PERINGATAN!\n\nAnda yakin ingin menghapus akun "${u.name}" (${u.email}) secara permanen?\n\nTindakan ini tidak dapat dibatalkan. Semua data user akan hilang.`)) {
                                try {
                                  await banUser(u.user_id);
                                  alert("Akun berhasil dihapus permanen");
                                  window.location.reload();
                                } catch (e) {
                                  alert("Gagal menghapus akun: " + (e.response?.data?.detail || e.message));
                                }
                              }
                            }}
                            className="p-2 text-[#B83A4B] hover:bg-[#B83A4B]/10 rounded-md transition-colors"
                            title="Hapus Permanen (Ban)"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
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
            <div className="text-2xl font-heading text-[#1A1B26]">{totalUsers}</div>
            <div className="text-xs text-[#646675]">Total Akun</div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#E5A93C]/10 grid place-items-center">
            <UserCheck className="w-5 h-5 text-[#E5A93C]" />
          </div>
          <div>
            <div className="text-2xl font-heading text-[#1A1B26]">{totalTeachers}</div>
            <div className="text-xs text-[#646675]">Pengajar</div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#2D6A4F]/10 grid place-items-center">
            <Shield className="w-5 h-5 text-[#2D6A4F]" />
          </div>
          <div>
            <div className="text-2xl font-heading text-[#1A1B26]">{totalStudents}</div>
            <div className="text-xs text-[#646675]">Pelajar</div>
          </div>
        </div>
      </div>
    </div>
  );
}
