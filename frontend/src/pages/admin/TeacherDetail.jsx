import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { http } from "@/lib/api";
import { ArrowLeft, Mail, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import DualLoader from "@/components/DualLoader";

const TITLE_OPTIONS = [
  { value: "guru_pengajar", label: "Guru Pengajar" },
  { value: "guru_kelas", label: "Guru Kelas (Wali Kelas)" },
  { value: "kurikulum", label: "Kurikulum" },
];

const titleLabels = {
  kepala_sekolah: "Kepala Sekolah",
  kurikulum: "Kurikulum",
  guru_kelas: "Guru Kelas (Wali Kelas)",
  guru_pengajar: "Guru Pengajar",
};

export default function TeacherDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resigning, setResigning] = useState(false);
  const [showResign, setShowResign] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [editForm, setEditForm] = useState({
    name: "",
    nip: "",
    titles: [],
    assigned_class: "",
    assigned_subject: "",
    teaching_classes: [],
  });

  useEffect(() => {
    http.get("/teacher/materials/classes")
      .then((r) => {
        setAvailableClasses(r.data || []);
      })
      .catch((err) => {
        console.error("Gagal memuat daftar kelas:", err);
      });
  }, []);

  useEffect(() => {
    http.get(`/admin/users/teachers/${id}`)
      .then((r) => {
        setTeacher(r.data);
        setEditForm({
          name: r.data.name || "",
          nip: r.data.nip || "",
          titles: r.data.titles || (r.data.title ? [r.data.title] : []),
          assigned_class: r.data.assigned_class || "",
          assigned_subject: r.data.assigned_subject || "",
          teaching_classes: r.data.teaching_classes || [],
        });
      })
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCheckboxChange = (value) => {
    setEditForm((prev) => {
      let nextTitles;
      if (prev.titles.includes(value)) {
        nextTitles = prev.titles.filter((t) => t !== value);
      } else {
        nextTitles = [...prev.titles, value];
      }
      return {
        ...prev,
        titles: nextTitles,
      };
    });
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    if (editForm.titles.length === 0) {
      toast.error("Pilih minimal satu jabatan/role");
      return;
    }
    setSavingUpdates(true);
    try {
      const r = await http.put(`/admin/users/teachers/${id}`, editForm);
      setTeacher(r.data.user || r.data);
      setIsEditing(false);
      toast.success("Profil guru berhasil diperbarui");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal memperbarui profil");
    } finally {
      setSavingUpdates(false);
    }
  };

  const handleResign = async () => {
    setResigning(true);
    try {
      await http.post(`/admin/users/${id}/resign`);
      toast.success("Akun guru dinonaktifkan");
      navigate("/admin/users");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menonaktifkan");
    } finally {
      setResigning(false);
      setShowResign(false);
    }
  };

  if (loading) {
    return <DualLoader type="teacher-detail" text="Memuat profil pengajar..." />;
  }

  if (!teacher) {
    return (
      <div className="text-sm text-[#B83A4B] bg-white border border-[#E2E0D8] rounded-xl p-8 text-center">
        Guru tidak ditemukan
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        onClick={() => navigate("/admin/users")}
        className="flex items-center gap-1.5 text-sm text-[#646675] hover:text-[#1D2D50] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      <div className="mb-8 fade-up">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1D2D50] grid place-items-center text-xl font-bold text-[#E5A93C]">
              {teacher.name?.charAt(0) || "?"}
            </div>
            <div>
              <h1 className="font-heading text-3xl text-[#1A1B26]">{teacher.name}</h1>
              <div className="flex flex-wrap gap-2 mt-1">
                {(teacher.titles && teacher.titles.length > 0 ? teacher.titles : [teacher.title]).filter(Boolean).map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#1D2D50]/10 text-[#1D2D50]">
                    {titleLabels[t] || t}
                  </span>
                ))}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  teacher.status === "active" || !teacher.status
                    ? "bg-[#2D6A4F]/10 text-[#2D6A4F]"
                    : "bg-[#A0A2B1]/10 text-[#646675]"
                }`}>
                  {teacher.status === "active" || !teacher.status ? "Aktif" : teacher.status}
                </span>
              </div>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-[#1D2D50] hover:bg-[#1D2D50]/90 text-white text-sm rounded-lg transition-colors shadow-sm"
            >
              Edit Profil
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 space-y-5 mb-8">
          <h2 className="font-heading text-xl text-[#1A1B26] mb-4">Edit Profil Pengajar</h2>
          
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">NIP</label>
            <input
              type="text"
              value={editForm.nip}
              onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-2.5">Jabatan / Peran</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#F8F6F0] border border-[#E2E0D8] rounded-lg">
              {TITLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer text-sm text-[#1A1B26] select-none">
                  <input
                    type="checkbox"
                    checked={editForm.titles.includes(opt.value)}
                    onChange={() => handleCheckboxChange(opt.value)}
                    className="rounded border-[#E2E0D8] text-[#1D2D50] focus:ring-[#1D2D50]/20 w-4 h-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {(editForm.titles.includes("guru_kelas") || editForm.titles.includes("guru_pengajar")) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editForm.titles.includes("guru_kelas") && (
                <div>
                  <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Kelas Wali</label>
                  <input
                    type="text"
                    value={editForm.assigned_class}
                    onChange={(e) => setEditForm({ ...editForm, assigned_class: e.target.value })}
                    placeholder="10-A, 11-B, dll"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                  />
                </div>
              )}
              {editForm.titles.includes("guru_pengajar") && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Mapel Pengajar</label>
                    <input
                      type="text"
                      value={editForm.assigned_subject}
                      onChange={(e) => setEditForm({ ...editForm, assigned_subject: e.target.value })}
                      placeholder="Matematika, Bahasa Inggris, dll"
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Kelas yang Diajar</label>
                    {availableClasses.length === 0 ? (
                      <p className="text-xs text-[#A0A2B1] italic mt-1">Belum ada kelas yang terdaftar di sekolah ini.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 p-3 bg-[#F8F6F0] border border-[#E2E0D8] rounded-lg max-h-48 overflow-y-auto mt-1">
                        {availableClasses.map((cls) => (
                          <label key={cls} className="flex items-center gap-2.5 cursor-pointer text-sm text-[#1A1B26] select-none">
                            <input
                              type="checkbox"
                              checked={editForm.teaching_classes?.includes(cls)}
                              onChange={() => {
                                const nextClasses = editForm.teaching_classes?.includes(cls)
                                  ? editForm.teaching_classes.filter((c) => c !== cls)
                                  : [...(editForm.teaching_classes || []), cls];
                                setEditForm({ ...editForm, teaching_classes: nextClasses });
                              }}
                              className="rounded border-[#E2E0D8] text-[#1D2D50] focus:ring-[#1D2D50]/20 w-4 h-4"
                            />
                            {cls}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditForm({
                  name: teacher.name || "",
                  nip: teacher.nip || "",
                  titles: teacher.titles || (teacher.title ? [teacher.title] : []),
                  assigned_class: teacher.assigned_class || "",
                  assigned_subject: teacher.assigned_subject || "",
                  teaching_classes: teacher.teaching_classes || [],
                });
              }}
              className="px-4 py-2 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={savingUpdates}
              className="px-5 py-2 bg-[#1D2D50] hover:bg-[#1D2D50]/90 text-white text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {savingUpdates ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
            <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Informasi Dasar</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#A0A2B1]" />
                <span className="text-sm text-[#646675]">{teacher.email || "-"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#A0A2B1]" />
                <span className="text-sm text-[#646675]">NIP: {teacher.nip || "-"}</span>
              </div>
              {teacher.assigned_class && (
                <div className="text-sm text-[#646675] flex items-center gap-2 mt-2 p-2 bg-[#1D2D50]/5 rounded border border-[#1D2D50]/10">
                  <span className="font-semibold text-[#1D2D50]">Kelas Wali:</span>
                  <span className="text-[#646675]">{teacher.assigned_class}</span>
                </div>
              )}
              {teacher.assigned_subject && (
                <div className="text-sm text-[#646675] flex flex-col gap-1.5 mt-2 p-2 bg-[#E5A93C]/5 rounded border border-[#E5A93C]/10">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#E5A93C]">Mapel Pengajar:</span>
                    <span className="text-[#646675]">{teacher.assigned_subject}</span>
                  </div>
                  {teacher.teaching_classes && teacher.teaching_classes.length > 0 && (
                    <div className="text-xs text-[#646675] mt-0.5 pl-1 border-t border-[#E5A93C]/20 pt-1">
                      <span className="font-medium">Kelas yang diajar:</span> {teacher.teaching_classes.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {teacher.institution && (
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
              <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Institusi</h2>
              <div className="text-sm text-[#646675]">{teacher.institution}</div>
            </div>
          )}
        </div>
      )}

      {/* Resign Action */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] mb-4 text-[#B83A4B] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Zone Berbahaya
        </h2>
        <p className="text-sm text-[#646675] mb-4">
          Menonaktifkan akun guru akan mengarsipkan data historis dan membebaskan email institusi untuk digunakan guru baru.
        </p>
        {!showResign ? (
          <button
            onClick={() => setShowResign(true)}
            className="px-4 py-2.5 bg-[#B83A4B] text-white text-sm rounded-lg hover:bg-[#B83A4B]/90 transition-colors"
          >
            Nonaktifkan Akun
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[#B83A4B]/5 border border-[#B83A4B]/20">
              <p className="text-sm text-[#B83A4B]">
                Yakin ingin menonaktifkan <strong>{teacher.name}</strong>?
              </p>
              <p className="text-xs text-[#646675] mt-1">
                Email {teacher.email} akan diarsipkan dan data historis tetap tersimpan sebagai read-only.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowResign(false)}
                className="px-4 py-2.5 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleResign}
                disabled={resigning}
                className="px-4 py-2.5 bg-[#B83A4B] text-white text-sm rounded-lg hover:bg-[#B83A4B]/90 transition-colors disabled:opacity-50"
              >
                {resigning ? "Memproses..." : "Konfirmasi Nonaktifkan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
