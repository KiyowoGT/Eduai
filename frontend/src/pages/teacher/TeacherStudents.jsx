import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { listTeacherStudents, getTeacherDashboard } from "@/lib/api";
import { Users } from "lucide-react";

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeacherStudents()
      .then(setStudents)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Kelas</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Siswa</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · {students.length} siswa
        </p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Cari siswa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
        />
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          {search ? "Tidak ada siswa yang cocok." : "Belum ada siswa."}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E0D8] bg-[#F8F6F0]">
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Nama</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Kelas</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.user_id || i} className="border-b border-[#E2E0D8]/50 last:border-0 hover:bg-[#F8F6F0]/50 transition-colors">
                  <td className="py-3 px-4 text-[#1A1B26] font-medium">{s.name}</td>
                  <td className="py-3 px-4 text-[#646675]">{s.enrolled_class || "-"}</td>
                  <td className="py-3 px-4 text-[#646675]">{s.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
