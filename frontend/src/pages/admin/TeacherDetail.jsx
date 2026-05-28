import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { http } from "@/lib/api";
import { getJurusanByLevel, parseMajorFromClass } from "@/lib/jurusan";
import { ArrowLeft, Mail, Shield, AlertTriangle, Plus, X, Lock } from "lucide-react";
import { toast } from "sonner";
import DualLoader from "@/components/DualLoader";

const TITLE_OPTIONS = [
  { value: "guru_pengajar", label: "Guru Pengajar" },
  { value: "guru_kelas", label: "Guru Kelas (Wali Kelas)" },
  { value: "kajur", label: "Kajur (Kepala Jurusan)" },
];

const titleLabels = {
  kepala_sekolah: "Kepala Sekolah",
  guru_kelas: "Guru Kelas (Wali Kelas)",
  guru_pengajar: "Guru Pengajar",
  kajur: "Kajur (Kepala Jurusan)",
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
    email: "",
    password: "",
    titles: [],
    assigned_class: "",
    assigned_subject: "",
    teaching_classes: [],
    major: "",
  });
  const [showNewClassInput, setShowNewClassInput] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGatePassword, setAuthGatePassword] = useState("");
  const [authGateLoading, setAuthGateLoading] = useState(false);

  const educationLevel = user?.education_level?.toUpperCase();
  const jurusanOptions = getJurusanByLevel(educationLevel);

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
        const ac = r.data.assigned_class;
        const tc = r.data.teaching_classes || [];
        const savedMajor = r.data.major || parseMajorFromClass(ac, educationLevel);
        setEditForm({
          name: r.data.name || "",
          nip: r.data.nip || "",
          email: r.data.email || "",
          password: "",
          titles: r.data.titles || (r.data.title ? [r.data.title] : []),
          assigned_class: ac || "",
          assigned_subject: r.data.assigned_subject || "",
          teaching_classes: tc,
          major: savedMajor,
        });
        setAvailableClasses((prev) => {
          const merged = new Set(prev);
          if (ac) merged.add(ac);
          tc.forEach((c) => { if (c) merged.add(c); });
          return [...merged].sort();
        });
      })
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false));
  }, [id, educationLevel]);

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

  const handleAuthGate = async (e) => {
    e?.preventDefault();
    if (!authGatePassword) return;
    setAuthGateLoading(true);
    try {
      await http.post("/auth/verify-password", { password: authGatePassword });
      setShowAuthGate(false);
      setAuthGatePassword("");
      setAdminPassword(authGatePassword);
      setIsEditing(true);
    } catch {
      toast.error("Password salah");
    } finally {
      setAuthGateLoading(false);
    }
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
    if (editForm.password && !adminPassword) {
      toast.error("Masukkan password Anda untuk verifikasi");
      return;
    }
    setSavingUpdates(true);
    try {
      const body = { ...editForm };
      if (!body.password) delete body.password;
      if (body.password) body.admin_password = adminPassword;
      const r = await http.put(`/admin/users/teachers/${id}`, body);
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
              onClick={() => setShowAuthGate(true)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="guru@sekolah.sch.id"
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Password Baru</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Kosongkan jika tidak diubah"
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
              />
            </div>
          </div>

          {editForm.password && (
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Verifikasi Password Anda</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Masukkan password Anda saat ini untuk verifikasi"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
              />
              <p className="text-xs text-[#646675] mt-1">
                {teacher.user_id === user?.user_id
                  ? "Masukkan password lama Anda untuk mengganti password sendiri."
                  : "Masukkan password Anda untuk mengotorisasi perubahan password guru ini."}
              </p>
            </div>
          )}

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

          {(editForm.titles.includes("guru_kelas") || editForm.titles.includes("guru_pengajar") || editForm.titles.includes("kajur")) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editForm.titles.includes("guru_kelas") && (
                <>
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Kelas Wali</label>
                    {!showNewClassInput ? (
                      <div className="flex gap-2">
                        <select
                          value={editForm.assigned_class}
                          onChange={(e) => setEditForm({ ...editForm, assigned_class: e.target.value })}
                          className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                        >
                          <option value="">Pilih kelas wali...</option>
                          {availableClasses.map((cls) => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowNewClassInput(true)}
                          className="px-3 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors"
                          title="Buat kelas baru"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          placeholder="Nama kelas baru..."
                          className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newClassName.trim()) {
                              const val = newClassName.trim();
                              setEditForm({ ...editForm, assigned_class: val });
                              if (!availableClasses.includes(val)) {
                                setAvailableClasses([...availableClasses, val].sort());
                              }
                              setNewClassName("");
                              setShowNewClassInput(false);
                            }
                          }}
                          className="px-3 py-2.5 bg-[#2D6A4F] text-white text-sm rounded-lg hover:bg-[#2D6A4F]/90 transition-colors"
                        >
                          Pakai
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowNewClassInput(false); setNewClassName(""); }}
                          className="px-3 py-2.5 text-[#646675] text-sm rounded-lg hover:bg-[#F8F6F0] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Jurusan</label>
                    <select
                      value={editForm.major}
                      onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                    >
                      <option value="">Pilih jurusan...</option>
                      {jurusanOptions.map((j) => (
                        <option key={j.value} value={j.value}>{j.label}</option>
                      ))}
                    </select>
                  </div>
                </>
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
              {editForm.titles.includes("kajur") && (
                <div>
                  <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Jurusan / Rumpun Keahlian</label>
                  <select
                    value={editForm.major}
                    onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                  >
                    <option value="">Pilih jurusan...</option>
                    {jurusanOptions.map((j) => (
                      <option key={j.value} value={j.value}>{j.label}</option>
                    ))}
                  </select>
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
                  email: teacher.email || "",
                  password: "",
                  titles: teacher.titles || (teacher.title ? [teacher.title] : []),
                  assigned_class: teacher.assigned_class || "",
                  assigned_subject: teacher.assigned_subject || "",
                  teaching_classes: teacher.teaching_classes || [],
                  major: teacher.major || "",
                });
                setAdminPassword("");
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
              {teacher.major && (
                <div className="text-sm text-[#646675] flex items-center gap-2 mt-2 p-2 bg-[#E5A93C]/5 rounded border border-[#E5A93C]/10">
                  <span className="font-semibold text-[#E5A93C]">Jurusan / Rumpun:</span>
                  <span className="text-[#646675]">{teacher.major}</span>
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

      {/* Auth Gate Dialog */}
      {showAuthGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleAuthGate} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#1D2D50]/10 grid place-items-center">
                <Lock className="w-5 h-5 text-[#1D2D50]" />
              </div>
              <div>
                <div className="font-heading text-lg text-[#1A1B26]">Verifikasi Identitas</div>
                <div className="text-xs text-[#646675]">Masukkan password akun Anda untuk melanjutkan</div>
              </div>
            </div>
            <input
              type="password"
              value={authGatePassword}
              onChange={(e) => setAuthGatePassword(e.target.value)}
              placeholder="Password Anda"
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowAuthGate(false); setAuthGatePassword(""); }}
                className="px-4 py-2 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={authGateLoading || !authGatePassword}
                className="px-5 py-2 bg-[#1D2D50] hover:bg-[#1D2D50]/90 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {authGateLoading ? "Memverifikasi..." : "Lanjutkan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
