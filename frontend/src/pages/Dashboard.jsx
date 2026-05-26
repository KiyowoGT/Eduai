import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { listDocuments, getProgress, uploadDocument, cancelDocument, deleteDocument } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import useRealtimeSocket from "@/hooks/useRealtimeSocket";
import { toast } from "sonner";
import { Upload, FileText, Trophy, BookOpen, ArrowUpRight, X, Trash2, Loader2, AlertTriangle } from "lucide-react";
import DualLoader from "@/components/DualLoader";

const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp"];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState({});
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [d, p] = await Promise.all([listDocuments(), getProgress()]);
      setDocs(d);
      setProgress(p);
    } catch {
      if (window.location.pathname === "/") return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setJob = (docId, patch) => setJobs((prev) => ({ ...prev, [docId]: { ...(prev[docId] || {}), ...patch } }));
  const removeJob = (docId) => setJobs((prev) => {
    const next = { ...prev };
    delete next[docId];
    return next;
  });

  useRealtimeSocket((payload) => {
    if (payload?.type !== "document_status") return;
    const documentId = payload.document_id;
    const current = jobs[documentId];
    setJob(documentId, { status: payload.status });

    if (payload.status === "ready") {
      toast.success(`Analisis selesai: ${current?.filename || "dokumen"}`);
      setTimeout(() => removeJob(documentId), 1500);
      load();
    } else if (payload.status === "failed") {
      toast.error(payload.error || `Analisis gagal: ${current?.filename || "dokumen"}`);
      setTimeout(() => removeJob(documentId), 2500);
      load();
    } else if (payload.status === "cancelled" || payload.status === "deleted") {
      setTimeout(() => removeJob(documentId), 800);
      load();
    }
  });

  const processOne = async (file) => {
    const lower = file.name.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      toast.error(`${file.name} bukan format yang didukung`);
      return;
    }

    const tempKey = `tmp-${file.name}-${Date.now()}`;
    setJob(tempKey, { filename: file.name, status: "uploading" });
    try {
      const doc = await uploadDocument(file);
      removeJob(tempKey);
      setJob(doc.document_id, { filename: file.name, status: doc.status || "processing" });
      await load();
    } catch (e) {
      removeJob(tempKey);
      toast.error(`${file.name}: ${e?.response?.data?.detail || "gagal upload"}`);
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    for (const file of files) {
      await processOne(file);
    }
  };

  const onCancel = async (docId) => {
    try {
      await cancelDocument(docId);
      toast.success("Proses dibatalkan");
      setJob(docId, { status: "cancelled" });
      setTimeout(() => removeJob(docId), 800);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membatalkan");
    }
  };

  const onDelete = async (docId, filename) => {
    try {
      await deleteDocument(docId);
      toast.success(`Dihapus: ${filename}`);
      removeJob(docId);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus");
    }
  };

  const activeJobs = Object.entries(jobs);

  if (loading) {
    return <DualLoader type="dashboard" text="Mempersiapkan dasbor belajar..." />;
  }

  return (
    <div className="w-full" data-testid="dashboard-page">
      <div className="flex items-baseline justify-between mb-8 fade-up">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Selamat datang kembali</div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Halo, {user?.name?.split(" ")[0]}.</h1>
          <p className="text-sm text-[#646675] mt-1.5">
            {user?.education_level}
            {user?.major ? ` · ${user.major}` : ""}
            {" · "}{user?.institution}
            {" · "}{user?.education_level === "Universitas" ? `Semester ${user?.current_semester}` : `Kelas ${user?.current_semester}`}
          </p>
        </div>
      </div>

      {user?.role === "pelajar" && user?.institution_code ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D8] bg-white p-10 mb-6 text-center fade-up">
          <div className="w-12 h-12 rounded-full bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center mx-auto mb-4">
            <BookOpen className="w-5 h-5 text-[#1D2D50] dark:text-[#E5A93C]" />
          </div>
          <div className="font-heading text-xl text-[#1A1B26]">Materi Terbimbing Sekolah</div>
          <p className="text-sm text-[#646675] mt-2 max-w-md mx-auto">
            Materi belajar dan tugas Anda dikelola dan diterbitkan secara langsung oleh guru kelas Anda. Silakan lihat daftar dokumen di bawah.
          </p>
        </div>
      ) : (
        <div
          data-testid="upload-zone"
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`dropzone ${drag ? "drag" : ""} cursor-pointer rounded-xl bg-white p-10 mb-6 text-center fade-up`}
        >
          <input
            ref={fileRef}
            data-testid="upload-pdf-input"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <div className="w-12 h-12 rounded-full bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center mx-auto mb-4">
            <Upload className="w-5 h-5 text-[#1D2D50] dark:text-[#E5A93C]" />
          </div>
          <div className="font-heading text-xl text-[#1A1B26]">Upload PDF atau Gambar</div>
          <p className="text-sm text-[#646675] mt-2">
            Tarik & lepas atau klik. Format didukung: PDF, JPG, PNG, WEBP, BMP.
          </p>
        </div>
      )}

      {activeJobs.length > 0 && (
        <div className="mb-10 space-y-2.5 fade-up" data-testid="active-jobs">
          {activeJobs.map(([docId, job]) => (
            <div key={docId} className="flex items-center gap-3 bg-white border border-[#E2E0D8] rounded-lg px-4 py-3" data-testid={`job-${docId}`}>
              <Loader2 className={`w-4 h-4 ${job.status === "ready" || job.status === "failed" || job.status === "cancelled" ? "" : "animate-spin"} text-[#1D2D50] dark:text-[#E5A93C] shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#1A1B26] truncate">{job.filename}</div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#A0A2B1]">
                  {job.status === "uploading" && "Mengunggah..."}
                  {job.status === "processing" && "AI menganalisis..."}
                  {job.status === "ready" && "Selesai"}
                  {job.status === "failed" && "Gagal"}
                  {job.status === "cancelled" && "Dibatalkan"}
                </div>
              </div>
              {job.status === "processing" && !docId.startsWith("tmp-") && (
                <Button data-testid={`cancel-${docId}`} variant="ghost" size="sm" onClick={() => onCancel(docId)} className="text-[#B83A4B] hover:bg-[#B83A4B]/5 h-8">
                  <X className="w-3.5 h-3.5 mr-1" /> Batal
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <StatCard tid="stat-docs" icon={<FileText className="w-4 h-4" />} label="Dokumen Dianalisis" value={progress?.documents ?? 0} />
        <StatCard tid="stat-quizzes" icon={<BookOpen className="w-4 h-4" />} label="Kuis Dikerjakan" value={progress?.quizzes ?? 0} />
        <StatCard tid="stat-score" icon={<Trophy className="w-4 h-4" />} label="Skor Rata-rata" value={`${progress?.average_score ?? 0}%`} accent />
      </div>

      <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center">
              <BookOpen className="w-4 h-4 text-[#1D2D50] dark:text-[#E5A93C]" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Pengaturan Belajar</div>
              <div className="text-sm text-[#1A1B26] mt-0.5">
                {user?.education_level
                  ? `${user.education_level} · ${user.education_level === "Universitas" ? "Semester" : "Kelas"} ${user?.current_semester}`
                  : "Atur kelas, mapel, dan jadwal kamu"}
              </div>
            </div>
          </div>
          <button onClick={() => navigate("/pengaturan-belajar")} className="text-xs text-[#1D2D50] dark:text-[#E5A93C] hover:text-[#B83A4B] dark:hover:text-[#F0B853] transition-colors flex items-center gap-1">
            {user?.education_level ? "Atur Mapel" : "Atur Sekarang"} <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-heading text-2xl text-[#1A1B26]">Dokumen Terbaru</h2>
        <button data-testid="see-all-documents" onClick={() => navigate("/dokumen")} className="text-xs text-[#1D2D50] dark:text-[#E5A93C] hover:text-[#B83A4B] dark:hover:text-[#F0B853] transition-colors">
          Lihat semua →
        </button>
      </div>

      {(docs?.length || 0) === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          Belum ada dokumen. Upload file pertama di atas.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.slice(0, 3).map((d) => (
            <DocCard key={d.document_id} doc={d} onOpen={() => navigate(`/dokumen/${d.document_id}`)} onCancel={() => onCancel(d.document_id)} onDelete={() => onDelete(d.document_id, d.title || d.filename)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ tid, icon, label, value, accent }) {
  return (
    <div data-testid={tid} className={`card-lift rounded-xl p-5 border ${accent ? "bg-[#1D2D50] border-[#1D2D50] text-white" : "bg-white border-[#E2E0D8]"}`}>
      <div className={`inline-flex w-8 h-8 rounded-md ${accent ? "bg-white/10" : "bg-[#F8F6F0] border border-[#E2E0D8]"} items-center justify-center`}>
        <span className={accent ? "text-[#E5A93C]" : "text-[#1D2D50] dark:text-[#E5A93C]"}>{icon}</span>
      </div>
      <div className={`mt-4 text-xs uppercase tracking-[0.2em] ${accent ? "text-white/60" : "text-[#A0A2B1]"}`}>{label}</div>
      <div className={`font-heading text-3xl mt-1 ${accent ? "text-white" : "text-[#1A1B26]"}`}>{value}</div>
    </div>
  );
}

export function DocCard({ doc, onOpen, onCancel, onDelete }) {
  const { user } = useAuth();
  const isInstitutionalStudent = user?.role === "pelajar" && user?.institution_code;
  const isProc = doc.status === "processing";
  return (
    <div data-testid={`doc-card-${doc.document_id}`} className="card-lift bg-white border border-[#E2E0D8] rounded-xl p-5 relative group">
      <button onClick={onOpen} className="absolute inset-0 rounded-xl" aria-label="Buka dokumen" />
      <div className="flex items-start justify-between relative pointer-events-none">
        <FileText className="w-5 h-5 text-[#1D2D50] dark:text-[#E5A93C]" />
        <ArrowUpRight className="w-4 h-4 text-[#A0A2B1]" />
      </div>
      <div className="font-heading text-lg text-[#1A1B26] mt-3 line-clamp-2 relative pointer-events-none">
        {doc.title || doc.filename}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs relative pointer-events-none">
        <span className="text-[#A0A2B1] font-mono">{new Date(doc.created_at).toLocaleDateString("id-ID")}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
          doc.status === "ready" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" :
          doc.status === "failed" ? "bg-[#B83A4B]/10 text-[#B83A4B]" :
          doc.status === "cancelled" ? "bg-[#A0A2B1]/10 text-[#646675]" :
          "bg-[#E5A93C]/10 text-[#E5A93C]"
        }`}>
          {doc.status === "ready" ? "Siap" : doc.status === "failed" ? "Gagal" : doc.status === "cancelled" ? "Dibatal" : "Proses"}
        </span>
      </div>
      {!isInstitutionalStudent && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          {isProc && (
            <Button data-testid={`doc-cancel-${doc.document_id}`} size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onCancel(); }} className="h-7 w-7 p-0 bg-white border border-[#E2E0D8] text-[#646675] hover:text-[#B83A4B]" title="Batalkan">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button data-testid={`doc-delete-${doc.document_id}`} size="sm" variant="ghost" onClick={(e) => e.stopPropagation()} className="h-7 w-7 p-0 bg-white border border-[#E2E0D8] text-[#646675] hover:text-[#B83A4B]" title="Hapus">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Hapus dokumen?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-medium text-[#1A1B26]">{doc.title || doc.filename}</span> akan dihapus permanen, termasuk semua kuis dan hasil terkait.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction data-testid={`doc-delete-confirm-${doc.document_id}`} onClick={onDelete} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white">
                  Hapus permanen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
