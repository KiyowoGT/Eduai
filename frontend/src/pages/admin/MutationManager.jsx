import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAdminTeachers, http } from "@/lib/api";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const TITLE_OPTIONS = [
  { value: "guru_pengajar", label: "Guru Pengajar" },
  { value: "guru_kelas", label: "Guru Kelas (Wali Kelas)" },
  { value: "kurikulum", label: "Kurikulum" },
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
];

export default function MutationManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [assignedClass, setAssignedClass] = useState("");
  const [assignedSubject, setAssignedSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminTeachers()
      .then((d) => setTeachers(d?.teachers || []))
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = teachers.find((t) => t.user_id === selectedTeacher);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeacher || !newTitle) {
      toast.error("Pilih guru dan jabatan baru");
      return;
    }
    setSaving(true);
    try {
      await http.post("/auth/switch-role", {
        user_id: selectedTeacher,
        title: newTitle,
        assigned_class: assignedClass || undefined,
        assigned_subject: assignedSubject || undefined,
      });
      toast.success(`Mutasi ${selected?.name} berhasil`);
      setSelectedTeacher("");
      setNewTitle("");
      setAssignedClass("");
      setAssignedSubject("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mutasi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <button
        onClick={() => navigate("/admin/users")}
        className="flex items-center gap-1.5 text-sm text-[#646675] hover:text-[#1D2D50] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Jabatan</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Mutasi Jabatan</h1>
        <p className="text-sm text-[#646675] mt-1.5">{user?.institution}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E0D8] rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Pilih Guru</label>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          >
            <option value="">-- Pilih Guru --</option>
            {teachers.filter((t) => t.status !== "archived").map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.name} ({t.title || "Guru"})
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="p-3 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8]">
            <div className="text-xs text-[#A0A2B1] uppercase tracking-[0.1em]">Jabatan Saat Ini</div>
            <div className="text-sm text-[#1A1B26] font-medium mt-0.5">
              {TITLE_OPTIONS.find((o) => o.value === selected.title)?.label || selected.title || "Guru"}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Jabatan Baru</label>
          <select
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          >
            <option value="">-- Pilih Jabatan Baru --</option>
            {TITLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.value === selected?.title}>
                {opt.label}{opt.value === selected?.title ? " (saat ini)" : ""}
              </option>
            ))}
          </select>
        </div>

        {(newTitle === "guru_kelas" || newTitle === "guru_pengajar") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {newTitle === "guru_kelas" && (
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Kelas</label>
                <input
                  type="text"
                  value={assignedClass}
                  onChange={(e) => setAssignedClass(e.target.value)}
                  placeholder="10-A, 11-B"
                  className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                />
              </div>
            )}
            {newTitle === "guru_pengajar" && (
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Mapel</label>
                <input
                  type="text"
                  value={assignedSubject}
                  onChange={(e) => setAssignedSubject(e.target.value)}
                  placeholder="Matematika, IPA, dll"
                  className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate("/admin/users")} className="px-4 py-2.5 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !selectedTeacher || !newTitle}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {saving ? "Memproses..." : "Mutasi Jabatan"}
          </button>
        </div>
      </form>
    </div>
  );
}
