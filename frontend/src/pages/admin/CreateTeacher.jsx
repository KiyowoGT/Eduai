import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { http } from "@/lib/api";

const TITLE_OPTIONS = [
  { value: "guru_pengajar", label: "Guru Pengajar" },
  { value: "guru_kelas", label: "Guru Kelas (Wali Kelas)" },
  { value: "kurikulum", label: "Kurikulum" },
  { value: "kepala_sekolah", label: "Kepala Sekolah" },
];

export default function CreateTeacher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    nip: "",
    password: "",
    title: "guru_pengajar",
    assigned_class: "",
    assigned_subject: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error("Nama, email, dan password wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await http.post("/admin/users/teachers", form);
      toast.success(`Guru ${form.name} berhasil ditambahkan`);
      navigate("/admin/users");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menambahkan guru");
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
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Akun</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Tambah Guru Baru</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · Registrasi guru/staf baru
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E0D8] rounded-xl p-6 space-y-5">
        {/* Nama */}
        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Nama Lengkap</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nama lengkap dengan gelar"
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          />
        </div>

        {/* Email & NIP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Email Institusi</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="guru@sekolah.sch.id"
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">NIP</label>
            <input
              type="text"
              value={form.nip}
              onChange={(e) => handleChange("nip", e.target.value)}
              placeholder="Nomor Induk Pegawai"
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Password Awal</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            placeholder="Minimal 8 karakter"
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          />
        </div>

        {/* Jabatan */}
        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Jabatan Awal</label>
          <select
            value={form.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          >
            {TITLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Assign Class & Subject (conditional) */}
        {(form.title === "guru_kelas" || form.title === "guru_pengajar") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {form.title === "guru_kelas" && (
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Kelas</label>
                <input
                  type="text"
                  value={form.assigned_class}
                  onChange={(e) => handleChange("assigned_class", e.target.value)}
                  placeholder="10-A, 11-B, dll"
                  className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                />
              </div>
            )}
            {form.title === "guru_pengajar" && (
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Mapel</label>
                <input
                  type="text"
                  value={form.assigned_subject}
                  onChange={(e) => handleChange("assigned_subject", e.target.value)}
                  placeholder="Matematika, Bahasa Inggris, dll"
                  className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                />
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="px-4 py-2.5 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
