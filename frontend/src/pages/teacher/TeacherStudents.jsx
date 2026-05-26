import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listTeacherStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadStudentsCsv,
  listTeacherMaterialsClasses,
} from "@/lib/api";
import { Plus, Trash2, Loader2, Upload, Edit3, X, Key, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const buildDefaultEmail = (nisn, instCode) => {
  if (!nisn) return "";
  const codeClean = (instCode || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  return `${nisn.trim()}@s.${codeClean}.sch.id`;
};

const buildDefaultPassword = (instName, tahunMasuk) => {
  if (!instName) return `EDUAI${tahunMasuk || ""}`;
  const nameClean = instName
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return `${nameClean}${tahunMasuk || ""}`;
};

export default function TeacherStudents() {
  const { user } = useAuth();
  const needsMajor = user?.education_level && !["SD", "SMP"].includes(user.education_level);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [fetchedClasses, setFetchedClasses] = useState([]);

  // Student credentials modal
  const [credentialsModal, setCredentialsModal] = useState(null); // { name, email, password }

  // Student form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", nisn: "", kelas: "", tahun_masuk: new Date().getFullYear(), major: "" });

  // CSV
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Get available classes from student data + teacher's assigned classes + fetched classes
  useEffect(() => {
    const cls = new Set(fetchedClasses);
    students.forEach((s) => { if (s.enrolled_class) cls.add(s.enrolled_class); });
    if (user?.assigned_class) cls.add(user.assigned_class);
    (user?.teaching_classes || []).forEach((c) => cls.add(c));
    setAvailableClasses([...cls].sort());
  }, [students, user, fetchedClasses]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, cList] = await Promise.all([
        listTeacherStudents().catch(() => []),
        listTeacherMaterialsClasses().catch(() => [])
      ]);
      setStudents(sList);
      setFetchedClasses(cList || []);
    } catch (e) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setForm({ name: "", nisn: "", kelas: "", tahun_masuk: new Date().getFullYear(), major: "" });
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name || "",
      nisn: s.nisn || "",
      kelas: s.enrolled_class || "",
      tahun_masuk: s.tahun_masuk || new Date().getFullYear(),
      major: s.major || user?.major || ""
    });
    setEditId(s.user_id);
    setShowForm(true);
  };

  const handleShowCredentials = (s) => {
    const email = s.email || buildDefaultEmail(s.nisn, user?.institution_code);
    const password = buildDefaultPassword(user?.institution || s.institution || "", s.tahun_masuk);
    setCredentialsModal({
      name: s.name,
      email: email,
      password: password,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.nisn || !form.kelas) {
      toast.error("Nama, NISN, dan kelas wajib diisi");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      nisn: form.nisn.trim(),
      enrolled_class: form.kelas.trim(),
      tahun_masuk: form.tahun_masuk,
      major: needsMajor ? form.major.trim() : undefined,
    };
    try {
      if (editId) {
        await updateStudent(editId, payload);
        toast.success("Siswa berhasil diperbarui");
      } else {
        const res = await createStudent(payload);
        toast.success("Siswa berhasil ditambahkan");
        if (res && res.email && res.password) {
          setCredentialsModal({
            name: form.name.trim(),
            email: res.email,
            password: res.password,
          });
        }
      }
      resetForm();
      loadData();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let errMsg = "Gagal menyimpan";
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (detail && typeof detail === "object") {
        errMsg = JSON.stringify(detail);
      }
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Hapus siswa ${s.name} (${s.nisn || s.email})? Aksi ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteStudent(s.user_id);
      toast.success("Siswa berhasil dihapus");
      setStudents(students.filter((st) => st.user_id !== s.user_id));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let errMsg = "Gagal menghapus";
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (detail && typeof detail === "object") {
        errMsg = JSON.stringify(detail);
      }
      toast.error(errMsg);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await uploadStudentsCsv(file);
      setUploadResult(res);
      if (res.success_count > 0) {
        toast.success(`${res.success_count} siswa berhasil ditambahkan`);
        loadData();
      }
      if (res.failed_count > 0) {
        toast.error(`${res.failed_count} siswa gagal`);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let errMsg = "Gagal upload CSV";
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (detail && typeof detail === "object") {
        errMsg = JSON.stringify(detail);
      }
      toast.error(errMsg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const filtered = students.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.nisn?.includes(search));

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Kelas</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Siswa</h1>
        <p className="text-sm text-[#646675] mt-1.5">{user?.institution} · {students.length} siswa terdaftar</p>
      </div>

      {/* Top actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-9 text-sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Siswa
        </Button>
        <label className="inline-flex items-center gap-2 px-4 py-2 border border-[#E2E0D8] text-sm text-[#646675] rounded-lg hover:bg-[#F8F6F0] transition-colors cursor-pointer h-9">
          <Upload className="w-4 h-4" />
          Upload CSV
          <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" disabled={uploading} />
        </label>
        <div className="flex-1" />
        <Input
          placeholder="Cari nama atau NISN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div className="mb-6 p-4 bg-white border border-[#E2E0D8] rounded-xl text-sm fade-up">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-[#1A1B26]">Hasil Upload CSV</span>
            <button onClick={() => setUploadResult(null)}><X className="w-4 h-4 text-[#A0A2B1]" /></button>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-[#2D6A4F]">✓ {uploadResult.success_count} berhasil</span>
            <span className="text-[#B83A4B]">✗ {uploadResult.failed_count} gagal</span>
          </div>
          {uploadResult.results?.failed?.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {uploadResult.results.failed.map((f, i) => (
                <div key={i} className="text-xs text-[#B83A4B] bg-[#B83A4B]/5 rounded px-2 py-1">Baris {f.row}: {f.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student create/edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg text-[#1A1B26]">{editId ? "Edit Siswa" : "Tambah Siswa Baru"}</h3>
            <button type="button" onClick={resetForm}><X className="w-4 h-4 text-[#A0A2B1]" /></button>
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${needsMajor ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#646675] mb-1">Nama Lengkap</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama siswa" required className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#646675] mb-1">NISN</label>
              <Input value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} placeholder="Nomor induk" required className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#646675] mb-1">Kelas</label>
              <Input
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                placeholder="Pilih atau ketik kelas baru"
                list="classes-datalist"
                required
                className="mt-1 h-9 text-sm border-[#E2E0D8] bg-[#F8F6F0]"
              />
              <datalist id="classes-datalist">
                {availableClasses.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#646675] mb-1">Tahun Masuk</label>
              <Input type="number" value={form.tahun_masuk} onChange={(e) => setForm({ ...form, tahun_masuk: parseInt(e.target.value) || new Date().getFullYear() })} className="mt-1 h-9 text-sm" />
            </div>
            {needsMajor && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#646675] mb-1">Jurusan</label>
                <Input
                  value={form.major}
                  onChange={(e) => setForm({ ...form, major: e.target.value })}
                  placeholder={user?.major ? `Ikuti data jurusan: ${user.major}` : "Jurusan siswa"}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={resetForm} className="h-9 text-sm">Batal</Button>
            <Button type="submit" disabled={saving} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-9 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editId ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </form>
      )}

      {/* Student table */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#1D2D50]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-[#646675] p-8 text-center">
            {search ? "Tidak ada siswa yang cocok." : "Belum ada siswa. Tambahkan via form atau upload CSV."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F8F6F0] border-b border-[#E2E0D8]">
              <tr className="text-[11px] uppercase tracking-[0.15em] text-[#A0A2B1]">
                <th className="text-left py-3 px-4 font-semibold">Nama</th>
                <th className="text-left py-3 px-4 font-semibold">NISN</th>
                <th className="text-left py-3 px-4 font-semibold">Kelas</th>
                {needsMajor && <th className="text-left py-3 px-4 font-semibold">Jurusan</th>}
                <th className="text-left py-3 px-4 font-semibold">Tahun</th>
                <th className="text-right py-3 px-4 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.user_id} className="border-b border-[#E2E0D8]/50 last:border-0 hover:bg-[#F8F6F0]/30 transition-colors">
                  <td className="py-3 px-4 text-[#1A1B26] font-medium">{s.name}</td>
                  <td className="py-3 px-4 text-[#646675] font-mono text-xs">{s.nisn || "-"}</td>
                  <td className="py-3 px-4 text-[#646675]">{s.enrolled_class || s.class_name || "-"}</td>
                  {needsMajor && <td className="py-3 px-4 text-[#646675]">{s.major || "-"}</td>}
                  <td className="py-3 px-4 text-[#646675]">{s.tahun_masuk || "-"}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleShowCredentials(s)} className="text-[#A0A2B1] hover:text-[#1D2D50] transition-colors p-1 mr-1.5" title="Lihat Kredensial"><Key className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(s)} className="text-[#A0A2B1] hover:text-[#1D2D50] transition-colors p-1" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s)} className="text-[#A0A2B1] hover:text-[#B83A4B] transition-colors p-1 ml-1" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Credentials Modal */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white border border-[#E2E0D8] rounded-2xl p-6 w-full max-w-md shadow-2xl scale-100 transform transition-transform duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E0D8]/60 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#1D2D50]/10 p-2 rounded-xl text-[#1D2D50]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-lg text-[#1A1B26] font-semibold">Kredensial Akun Siswa</h3>
                  <p className="text-xs text-[#646675]">Gunakan informasi berikut untuk masuk</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setCredentialsModal(null)} 
                className="text-[#A0A2B1] hover:text-[#1A1B26] transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#646675]">Nama Siswa</Label>
                <div className="mt-1 text-sm font-semibold text-[#1A1B26] bg-[#F8F6F0] px-3.5 py-2.5 rounded-xl border border-[#E2E0D8]/50">
                  {credentialsModal.name}
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-[#646675]">Email / Username</Label>
                <div className="mt-1 flex items-center justify-between bg-[#F8F6F0] px-3.5 py-2.5 rounded-xl border border-[#E2E0D8]/50 font-mono text-xs text-[#1D2D50]">
                  <span>{credentialsModal.email}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.email);
                      toast.success("Email berhasil disalin");
                    }} 
                    className="text-[#A0A2B1] hover:text-[#1D2D50] transition-colors p-1"
                    title="Salin Email"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-[#646675]">Password Default</Label>
                <div className="mt-1 flex items-center justify-between bg-[#F8F6F0] px-3.5 py-2.5 rounded-xl border border-[#E2E0D8]/50 font-mono text-xs text-[#1D2D50]">
                  <span>{credentialsModal.password}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.password);
                      toast.success("Password berhasil disalin");
                    }} 
                    className="text-[#A0A2B1] hover:text-[#1D2D50] transition-colors p-1"
                    title="Salin Password"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[#E2E0D8]/60 pt-4">
              <Button 
                onClick={() => {
                  const text = `Nama: ${credentialsModal.name}\nEmail: ${credentialsModal.email}\nPassword: ${credentialsModal.password}`;
                  navigator.clipboard.writeText(text);
                  toast.success("Kredensial disalin ke clipboard");
                }}
                className="bg-[#F8F6F0] hover:bg-[#E2E0D8]/50 text-[#1D2D50] border border-[#E2E0D8] text-xs h-9"
              >
                Salin Semua
              </Button>
              <Button 
                onClick={() => setCredentialsModal(null)} 
                className="bg-[#1D2D50] hover:bg-[#15223E] text-white text-xs h-9"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
