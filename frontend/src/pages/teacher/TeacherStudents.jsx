import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listTeacherStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadStudentsCsv,
} from "@/lib/api";
import { Plus, Trash2, Loader2, Upload, Edit3, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);

  // Student form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", nisn: "", kelas: "", tahun_masuk: new Date().getFullYear() });

  // CSV
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Get available classes from student data + teacher's assigned classes
  useEffect(() => {
    const cls = new Set();
    students.forEach((s) => { if (s.enrolled_class) cls.add(s.enrolled_class); });
    if (user?.assigned_class) cls.add(user.assigned_class);
    (user?.teaching_classes || []).forEach((c) => cls.add(c));
    setAvailableClasses([...cls].sort());
  }, [students, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const sList = await listTeacherStudents().catch(() => []);
      setStudents(sList);
    } catch (e) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setForm({ name: "", nisn: "", kelas: "", tahun_masuk: new Date().getFullYear() });
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (s) => {
    setForm({ name: s.name || "", nisn: s.nisn || "", kelas: s.enrolled_class || "", tahun_masuk: s.tahun_masuk || new Date().getFullYear() });
    setEditId(s.user_id);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.nisn || !form.kelas) {
      toast.error("Nama, NISN, dan kelas wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateStudent(editId, form);
        toast.success("Siswa berhasil diperbarui");
      } else {
        await createStudent(form);
        toast.success("Siswa berhasil ditambahkan");
      }
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan");
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
      toast.error(err?.response?.data?.detail || "Gagal menghapus");
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
      toast.error(err?.response?.data?.detail || "Gagal upload CSV");
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
        <form onSubmit={handleSave} className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6 space-y-4 fade-up">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg text-[#1A1B26]">{editId ? "Edit Siswa" : "Tambah Siswa Baru"}</h3>
            <button type="button" onClick={resetForm}><X className="w-4 h-4 text-[#A0A2B1]" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#646675]">Nama Lengkap</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama siswa" required className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#646675]">NISN</Label>
              <Input value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} placeholder="Nomor induk" required className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#646675]">Kelas</Label>
              <Select value={form.kelas} onValueChange={(v) => setForm({ ...form, kelas: v })} required>
                <SelectTrigger className="mt-1 h-9 text-sm border-[#E2E0D8] bg-[#F8F6F0]">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#646675]">Tahun Masuk</Label>
              <Input type="number" value={form.tahun_masuk} onChange={(e) => setForm({ ...form, tahun_masuk: parseInt(e.target.value) || new Date().getFullYear() })} className="mt-1 h-9 text-sm" />
            </div>
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
                  <td className="py-3 px-4 text-[#646675]">{s.tahun_masuk || "-"}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => openEdit(s)} className="text-[#A0A2B1] hover:text-[#1D2D50] transition-colors p-1" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s)} className="text-[#A0A2B1] hover:text-[#B83A4B] transition-colors p-1 ml-1" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

