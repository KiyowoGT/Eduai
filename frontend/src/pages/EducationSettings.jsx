import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { fetchMe, saveEducationSettings, getEducationSettings, generateMaterial, listMaterials, deleteMaterial, uploadSubjectMaterial, listDocuments, updateTeachingMethods } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Loader2, BrainCircuit, CalendarDays, Bot, BookText, Upload, Camera, FileText, ArrowRight, Eye, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DualLoader from "@/components/DualLoader";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

let subjCounter = 0;
function nextSubjId() { subjCounter += 1; return `subj_${Date.now()}_${subjCounter}`; }

export default function EducationSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [docs, setDocs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newSubj, setNewSubj] = useState("");
  const [generating, setGenerating] = useState(null);
  const [showMaterial, setShowMaterial] = useState(null);
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const [uploading, setUploading] = useState({});
  const [teachingMethods, setTeachingMethods] = useState(["real_world", "imagination", "independence", "confidence"]);
  const [savingMethods, setSavingMethods] = useState(false);
  const fileRefs = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const [edu, mats, d, me] = await Promise.all([getEducationSettings(), listMaterials(), listDocuments(), fetchMe()]);
        setSubjects(edu.subjects || []);
        setSchedule(edu.schedule || []);
        setMaterials(mats.materials || []);
        setDocs(d || []);
        if (me?.teaching_methods) {
          setTeachingMethods(me.teaching_methods);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const addSubject = () => {
    const name = newSubj.trim();
    if (!name) { toast.error("Masukkan nama mapel"); return; }
    if (subjects.find((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Mapel sudah ada"); return;
    }
    setSubjects([...subjects, { id: nextSubjId(), name, folder_id: null }]);
    setNewSubj("");
  };

  const removeSubject = (id) => {
    setSubjects(subjects.filter((s) => s.id !== id));
    setSchedule(schedule.filter((s) => s.subject_id !== id));
  };

  const addSchedule = () => {
    if (subjects.length === 0) { toast.error("Tambah mapel dulu"); return; }
    setSchedule([...schedule, { day: "Senin", start_time: "07:00", end_time: "08:30", subject_id: subjects[0].id }]);
  };

  const updateSchedule = (idx, field, value) => {
    const s = [...schedule];
    s[idx] = { ...s[idx], [field]: value };
    setSchedule(s);
  };

  const removeSchedule = (idx) => {
    setSchedule(schedule.filter((_, i) => i !== idx));
  };

  const doSave = async () => {
    if (subjects.length === 0) { toast.error("Tambah minimal 1 mapel"); return; }
    setSaving(true);
    try {
      const res = await saveEducationSettings({ subjects, schedule });
      setSubjects(res.subjects || []);
      setSchedule(res.schedule || []);
      toast.success("Pengaturan belajar disimpan");
      setShowUploadPrompt(true);
    } catch { toast.error("Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  const doGenerate = async (subj) => {
    const inDb = subjects.find((s) => s.id === subj.id && s.folder_id);
    if (!inDb) {
      toast.error("Simpan pengaturan dulu sebelum generate materi");
      return;
    }
    setGenerating(subj.id);
    try {
      await generateMaterial({ subject_id: subj.id, subject_name: subj.name });
      toast.success(`Materi "${subj.name}" dibuat!`);
      const mats = await listMaterials();
      setMaterials(mats.materials || []);
    } catch (e) {
      toast.error("Gagal generate: " + (e.response?.data?.detail || e.message));
    } finally { setGenerating(null); }
  };

  const doUploadFiles = async (subj, fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading((prev) => ({ ...prev, [subj.id]: "uploading" }));
    const files = Array.from(fileList);
    let successCount = 0;
    try {
      for (const file of files) {
        // Upload sequentially to avoid Vercel body size limits (4.5MB) and timeouts
        await uploadSubjectMaterial(subj.id, [file]);
        successCount++;
      }
      toast.success(`${successCount} file terupload untuk ${subj.name}`);
      setUploading((prev) => ({ ...prev, [subj.id]: "done" }));
      setTimeout(() => setUploading((prev) => ({ ...prev, [subj.id]: undefined })), 3000);
      const d = await listDocuments();
      setDocs(d || []);
    } catch (e) {
      toast.error("Gagal upload: " + (e.response?.data?.detail || e.message));
      setUploading((prev) => ({ ...prev, [subj.id]: undefined }));
      const d = await listDocuments();
      setDocs(d || []);
    }
  };

  const triggerUpload = (subjId) => {
    fileRefs.current[subjId]?.click();
  };

  const triggerCamera = (subjId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.multiple = true;
    input.onchange = (e) => {
      if (e.target.files?.length) {
        const subj = subjects.find((s) => s.id === subjId);
        if (subj) doUploadFiles(subj, e.target.files);
      }
    };
    input.click();
  };

  const doDeleteMaterial = async (id) => {
    try {
      await deleteMaterial(id);
      setMaterials(materials.filter((m) => m.material_id !== id));
      toast.success("Materi dihapus");
    } catch { toast.error("Gagal menghapus"); }
  };

  const subjectDocs = {};
  const folderDocs = {};
  docs.forEach((d) => {
    const sid = d.subject_id || "__none__";
    if (!subjectDocs[sid]) subjectDocs[sid] = [];
    subjectDocs[sid].push(d);
    const fid = d.folder_id || "__none__";
    if (!folderDocs[fid]) folderDocs[fid] = [];
    folderDocs[fid].push(d);
  });

  const materialsBySubject = {};
  const materialsByFolder = {};
  materials.forEach((m) => {
    const sid = m.subject_id || "__none__";
    if (!materialsBySubject[sid]) materialsBySubject[sid] = [];
    materialsBySubject[sid].push(m);
    const fid = m.folder_id || "__none__";
    if (!materialsByFolder[fid]) materialsByFolder[fid] = [];
    materialsByFolder[fid].push(m);
  });

  const getSubjectDocs = (subj) => {
    const bySubj = subjectDocs[subj.id] || [];
    const byFolder = subj.folder_id ? (folderDocs[subj.folder_id] || []) : [];
    const merged = [...new Map([...bySubj, ...byFolder].map(d => [d.document_id, d])).values()];
    return merged;
  };

  const getSubjectMats = (subj) => {
    const bySubj = materialsBySubject[subj.id] || [];
    const byFolder = subj.folder_id ? (materialsByFolder[subj.folder_id] || []) : [];
    const merged = [...new Map([...bySubj, ...byFolder].map(m => [m.material_id || m.document_id, m])).values()];
    return merged;
  };

  const hasProfile = user?.education_level && user?.current_semester;

  if (loading) {
    return <DualLoader type="education-settings" text="Memuat kurikulum belajar..." />;
  }

  return (
    <div className="w-full" data-testid="education-settings-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" /> Pengaturan Belajar
        </div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-2 leading-tight">Atur Kelas & Mapel</h1>
        <p className="text-sm text-[#646675] mt-2">
          Atur mata pelajaran dan jadwal kamu supaya AI bisa menyiapkan materi sesuai kurikulum.
        </p>
      </div>

      {!hasProfile && (
        <div className="bg-[#FFF8E1] border border-[#E5A93C]/30 rounded-xl p-5 mb-8 flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-[#E5A93C] shrink-0" />
          <div className="text-sm text-[#1A1B26]">
            Isi profil pendidikan kamu dulu{" "}
            <button onClick={() => navigate("/profil")} className="underline text-[#1D2D50] font-medium">di sini</button>
            {" "}agar materi sesuai kelas & jurusan.
          </div>
        </div>
      )}

      {/* Mata Pelajaran */}
      <section className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2 mb-5">
          <BookText className="w-4 h-4 text-[#E5A93C]" /> Mata Pelajaran
        </h2>

        <div className="flex gap-3 mb-4">
          <Input
            value={newSubj}
            onChange={(e) => setNewSubj(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubject()}
            placeholder="Nama mapel, misal: Matematika"
            className="text-sm bg-[#F8F6F0] border-[#E2E0D8]"
          />
          <Button onClick={addSubject} className="bg-[#1D2D50] hover:bg-[#15223E] text-white shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {subjects.length === 0 ? (
          <div className="text-xs text-[#A0A2B1]">Belum ada mapel. Tambah mapel kamu di atas.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#F8F6F0] border border-[#E2E0D8] rounded-lg text-sm text-[#1A1B26]">
                <span>{s.name}</span>
                <button onClick={() => removeSubject(s.id)} className="text-[#A0A2B1] hover:text-[#B83A4B]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Jadwal Pelajaran */}
      <section className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2 mb-5">
          <CalendarDays className="w-4 h-4 text-[#E5A93C]" /> Jadwal Pelajaran
        </h2>

        {schedule.length === 0 ? (
          <div className="text-xs text-[#A0A2B1] mb-4">Belum ada jadwal. Tambah jadwal mapel kamu.</div>
        ) : (
          <div className="space-y-2 mb-4">
            {schedule.map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm min-w-0 overflow-hidden">
                <Select value={s.day} onValueChange={(v) => updateSchedule(i, "day", v)}>
                  <SelectTrigger className="w-[120px] shrink-0 text-xs bg-[#F8F6F0] border-[#E2E0D8]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={s.start_time}
                  onChange={(e) => updateSchedule(i, "start_time", e.target.value)}
                  className="w-[100px] shrink-0 text-xs bg-[#F8F6F0] border-[#E2E0D8]"
                />
                <span className="text-[#A0A2B1] shrink-0">-</span>
                <Input
                  type="time"
                  value={s.end_time}
                  onChange={(e) => updateSchedule(i, "end_time", e.target.value)}
                  className="w-[100px] shrink-0 text-xs bg-[#F8F6F0] border-[#E2E0D8]"
                />
                <Select value={s.subject_id} onValueChange={(v) => updateSchedule(i, "subject_id", v)}>
                  <SelectTrigger className="flex-1 min-w-0 text-xs bg-[#F8F6F0] border-[#E2E0D8]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((sub) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => removeSchedule(i)} className="text-[#A0A2B1] hover:text-[#B83A4B]">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={addSchedule} className="inline-flex items-center gap-1.5 text-xs text-[#1D2D50] hover:underline">
          <Plus className="w-3 h-3" /> Tambah Jadwal
        </button>
      </section>

      {/* Metode Mengajar ala Anand Kumar */}
      <section className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2 mb-5">
          <BrainCircuit className="w-4 h-4 text-[#E5A93C]" /> Metode Mengajar
        </h2>
        <p className="text-xs text-[#646675] mb-4">
          Aktifkan metode pengajaran ala Anand Kumar. Metode ini mengubah cara AI mengajar —
          dari sekadar memberi materi menjadi pengalaman belajar yang hidup dan bermakna.
        </p>

        <div className="space-y-3 mb-5">
          {[
            { id: "real_world", label: "Pemanfaatan Lingkungan Sekitar", desc: "AI mengaitkan setiap konsep dengan fenomena sehari-hari, menggunakan analogi kehidupan nyata (kecepatan bola, laju kereta, transaksi jual-beli).", icon: "🌍" },
            { id: "imagination", label: "Membangkitkan Imajinasi & Kreativitas", desc: "AI mendorong visualisasi konsep, pertanyaan terbuka, dan skenario 'bagaimana jika' — bukan sekadar menghafal rumus.", icon: "💡" },
            { id: "independence", label: "Kemandirian dalam Keterbatasan", desc: "AI memberi tantangan yang memaksa siswa berpikir kreatif dan menemukan jawaban sendiri — menanamkan mentalitas problem-solver.", icon: "🛠️" },
            { id: "confidence", label: "Peningkatan Kepercayaan Diri", desc: "AI mengapresiasi proses berpikir, menggunakan bahasa yang membangun, dan menantang di zona nyaman atas.", icon: "⭐" },
          ].map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                teachingMethods.includes(m.id)
                  ? "border-[#1D2D50] bg-[#1D2D50]/5"
                  : "border-[#E2E0D8] bg-white hover:border-[#1D2D50]/30"
              }`}
            >
              <input
                type="checkbox"
                checked={teachingMethods.includes(m.id)}
                onChange={() => {
                  setTeachingMethods((prev) =>
                    prev.includes(m.id)
                      ? prev.filter((x) => x !== m.id)
                      : [...prev, m.id]
                  );
                }}
                className="mt-1 accent-[#1D2D50]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1A1B26]">{m.label}</div>
                <div className="text-xs text-[#646675] mt-0.5">{m.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <Button
          onClick={async () => {
            setSavingMethods(true);
            try {
              await updateTeachingMethods(teachingMethods);
              toast.success("Metode mengajar diperbarui!");
            } catch (e) {
              toast.error("Gagal menyimpan: " + (e.response?.data?.detail || e.message));
            } finally {
              setSavingMethods(false);
            }
          }}
          disabled={savingMethods}
          className="bg-[#1D2D50] hover:bg-[#15223E] text-white"
        >
          {savingMethods ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Simpan Metode Mengajar
        </Button>
      </section>

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        <Button onClick={doSave} disabled={saving} className="bg-[#1D2D50] hover:bg-[#15223E] text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Simpan Pengaturan
        </Button>
      </div>

      {/* Upload Prompt Modal */}
      {showUploadPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setShowUploadPrompt(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-[#1D2D50]" />
            </div>
            <h3 className="font-heading text-xl text-[#1A1B26] text-center mb-2">Ada Buku atau Modul?</h3>
            <p className="text-sm text-[#646675] text-center mb-6">
              Upload foto halaman buku, PDF, atau e-book terkait mapel kamu. 
              Biar AI belajar langsung dari materi yang kamu pakai di sekolah!
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="border-[#E2E0D8]"
                onClick={() => setShowUploadPrompt(false)}
              >
                Nanti Saja
              </Button>
              <Button
                className="bg-[#1D2D50] hover:bg-[#15223E] text-white"
                onClick={() => { setShowUploadPrompt(false); }}
              >
                Upload Sekarang
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Materi Per Mapel */}
      <section className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2 mb-5">
          <Upload className="w-4 h-4 text-[#E5A93C]" /> Upload Materi Belajar
        </h2>
        <p className="text-xs text-[#646675] mb-5">
          Upload foto halaman buku, PDF, atau e-book untuk setiap mapel. AI akan menganalisisnya 
          dan menyiapkan rangkuman, kuis, dan materi belajar sesuai buku kamu.
        </p>

        <div className="space-y-4">
          {subjects.map((subj) => {
            const subDocs = getSubjectDocs(subj);
            const subMats = getSubjectMats(subj);
            const status = uploading[subj.id];

            return (
              <div key={subj.id} className="border border-[#E2E0D8] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookText className="w-4 h-4 text-[#1D2D50]" />
                    <span className="font-medium text-sm text-[#1A1B26]">{subj.name}</span>
                    <span className="text-[10px] text-[#A0A2B1]">
                      {subDocs.length} file · {subMats.length} materi AI
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === "uploading" && (
                      <span className="text-xs text-[#E5A93C] animate-pulse">Mengupload...</span>
                    )}
                    {status === "done" && (
                      <span className="text-xs text-[#2D6A4F] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Selesai
                      </span>
                    )}
                  </div>
                </div>

                {/* Upload buttons */}
                <div className="flex gap-2">
                  <input
                    ref={(el) => { fileRefs.current[subj.id] = el; }}
                    type="file"
                    accept=".pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.length) doUploadFiles(subj, e.target.files); e.target.value = ""; }}
                  />
                  <Button
                    onClick={() => triggerUpload(subj.id)}
                    disabled={!!status}
                    variant="outline"
                    className="border-[#E2E0D8] text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Pilih File
                  </Button>
                  <Button
                    onClick={() => triggerCamera(subj.id)}
                    disabled={!!status}
                    variant="outline"
                    className="border-[#E2E0D8] text-xs"
                  >
                    <Camera className="w-3.5 h-3.5" /> Foto Buku
                  </Button>
                </div>

                {/* Uploaded files */}
                {subDocs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {subDocs.map((d) => (
                      <div key={d.document_id} className="flex items-center justify-between py-1.5 px-3 bg-[#F8F6F0] rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-[#646675] shrink-0" />
                          <span className="text-xs text-[#1A1B26] truncate">{d.title || d.filename}</span>
                          {d.status === "processing" && <Loader2 className="w-3 h-3 animate-spin text-[#E5A93C]" />}
                          {d.status === "ready" && <CheckCircle2 className="w-3 h-3 text-[#2D6A4F]" />}
                          {d.status === "failed" && <AlertCircle className="w-3 h-3 text-[#B83A4B]" />}
                        </div>
                        {d.status === "ready" && (
                          <button
                            onClick={() => navigate(`/dokumen/${d.document_id}`)}
                            className="text-[#1D2D50] hover:text-[#15223E]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Generate Material per Subject */}
      <section className="bg-white border border-[#E2E0D8] rounded-xl p-6">
        <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2 mb-5">
          <BrainCircuit className="w-4 h-4 text-[#E5A93C]" /> Materi AI
        </h2>

        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {subjects.map((subj) => (
            <div key={subj.id} className="flex items-center justify-between gap-3 p-4 border border-[#E2E0D8] rounded-xl min-w-0 overflow-hidden">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[#1A1B26] truncate">{subj.name}</div>
                <div className="text-[10px] text-[#A0A2B1] mt-0.5">
                  {getSubjectMats(subj).length} materi
                </div>
              </div>
              <Button
                onClick={() => doGenerate(subj)}
                disabled={generating === subj.id}
                className="bg-[#1D2D50] hover:bg-[#15223E] text-white text-xs px-4"
              >
                {generating === subj.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                {generating === subj.id ? " Membuat..." : " Buat Materi"}
              </Button>
            </div>
          ))}
        </div>

        {/* List generated materials */}
        {materials.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-3">Materi Tersedia</div>
            <div className="space-y-2">
              {materials.map((m) => (
                <div key={m.material_id} className="flex items-center justify-between p-3 border border-[#E2E0D8] rounded-lg">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <BookText className="w-4 h-4 text-[#E5A93C] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#1A1B26] truncate">{m.title}</div>
                      <div className="text-[10px] text-[#A0A2B1]">{m.subject_name} · {new Date(m.created_at).toLocaleDateString("id-ID")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowMaterial(m)} className="text-[#1D2D50] hover:text-[#15223E]">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => doDeleteMaterial(m.material_id)} className="text-[#A0A2B1] hover:text-[#B83A4B]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Material Modal */}
      {showMaterial && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setShowMaterial(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading text-xl text-[#1A1B26]">{showMaterial.title}</h3>
              <button onClick={() => setShowMaterial(null)} className="text-[#A0A2B1] hover:text-[#1A1B26]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mb-1">Ringkasan</div>
            <p className="text-sm text-[#1A1B26] leading-relaxed mb-6 whitespace-pre-wrap break-words">{showMaterial.summary}</p>

            {showMaterial.key_concepts?.length > 0 && (
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mb-2">Konsep Kunci</div>
                <div className="space-y-2">
                  {showMaterial.key_concepts.map((kc, i) => (
                    <div key={i} className="p-3 bg-[#F8F6F0] rounded-lg overflow-hidden">
                      <div className="text-sm font-medium text-[#1A1B26] break-words">{kc.concept || `Konsep ${i+1}`}</div>
                      <div className="text-xs text-[#646675] mt-1 break-words">{kc.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showMaterial.practice_questions?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mb-2">Soal Latihan</div>
                <div className="space-y-3">
                  {showMaterial.practice_questions.map((q, i) => (
                    <div key={i} className="p-3 border border-[#E2E0D8] rounded-lg">
                      <div className="text-sm text-[#1A1B26]">{i + 1}. {q.question}</div>
                      {q.options?.map((opt, j) => (
                        <div key={j} className={`text-xs mt-1 ml-4 ${j === q.correct_index ? "text-[#2D6A4F] font-medium" : "text-[#646675]"}`}>
                          {String.fromCharCode(65 + j)}. {opt}
                        </div>
                      ))}
                      <div className="text-xs text-[#2D6A4F] mt-2">Jawaban: {String.fromCharCode(65 + (q.correct_index || 0))}</div>
                      {q.explanation && <div className="text-xs text-[#646675] mt-1">{q.explanation}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showMaterial.study_notes && (
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mb-2">Catatan Belajar</div>
                <div className="text-sm text-[#646675] whitespace-pre-wrap leading-relaxed break-words">{showMaterial.study_notes}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}