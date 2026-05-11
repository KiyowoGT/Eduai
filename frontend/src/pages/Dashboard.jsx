import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listDocuments, getProgress, uploadDocument, getDocument } from "@/lib/api";
import { pollUntilReady } from "@/lib/poll";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Upload, FileText, Sparkles, Trophy, BookOpen, ArrowUpRight } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [d, p] = await Promise.all([listDocuments(), getProgress()]);
      setDocs(d); setProgress(p);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Hanya PDF yang didukung");
      return;
    }
    setUploading(true);
    toast.info("Mengunggah PDF…");
    try {
      const doc = await uploadDocument(file);
      toast.info("Menganalisis dengan AI… ini bisa 30–90 detik.");
      await pollUntilReady(() => getDocument(doc.document_id));
      toast.success("Analisis selesai!");
      navigate(`/dokumen/${doc.document_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Gagal mengunggah dokumen");
    } finally { setUploading(false); }
  };

  return (
    <div className="max-w-6xl" data-testid="dashboard-page">
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

      {/* Upload zone */}
      <div
        data-testid="upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => fileRef.current?.click()}
        className={`dropzone ${drag ? "drag" : ""} cursor-pointer rounded-xl bg-white p-10 mb-10 text-center fade-up`}
      >
        <input
          ref={fileRef}
          data-testid="upload-pdf-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="w-12 h-12 rounded-full bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center mx-auto mb-4">
          <Upload className="w-5 h-5 text-[#1D2D50]" />
        </div>
        <div className="font-heading text-xl text-[#1A1B26]">
          {uploading ? "Sedang menganalisis…" : "Upload PDF jurnal / modul kuliah"}
        </div>
        <p className="text-sm text-[#646675] mt-2">
          Tarik & lepas atau klik untuk pilih file. AI akan ekstrak ringkasan, peta konsep, dan diagram teknis.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <StatCard tid="stat-docs" icon={<FileText className="w-4 h-4" />} label="Dokumen Dianalisis" value={progress?.documents ?? 0} />
        <StatCard tid="stat-quizzes" icon={<BookOpen className="w-4 h-4" />} label="Kuis Dikerjakan" value={progress?.quizzes ?? 0} />
        <StatCard tid="stat-score" icon={<Trophy className="w-4 h-4" />} label="Skor Rata-rata" value={`${progress?.average_score ?? 0}%`} accent />
      </div>

      {/* Recent documents */}
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-heading text-2xl text-[#1A1B26]">Dokumen Terbaru</h2>
        <button
          data-testid="see-all-documents"
          onClick={() => navigate("/dokumen")}
          className="text-xs text-[#1D2D50] hover:text-[#B83A4B] transition-colors"
        >
          Lihat semua →
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat…</div>
      ) : docs.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          Belum ada dokumen. Upload PDF pertama lu di atas.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.slice(0, 6).map((d) => (
            <button
              key={d.document_id}
              data-testid={`doc-card-${d.document_id}`}
              onClick={() => navigate(`/dokumen/${d.document_id}`)}
              className="card-lift text-left bg-white border border-[#E2E0D8] rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <FileText className="w-5 h-5 text-[#1D2D50]" />
                <ArrowUpRight className="w-4 h-4 text-[#A0A2B1]" />
              </div>
              <div className="font-heading text-lg text-[#1A1B26] mt-3 line-clamp-2">
                {d.title || d.filename}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-[#A0A2B1] font-mono">{new Date(d.created_at).toLocaleDateString("id-ID")}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                  d.status === "ready" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : d.status === "failed" ? "bg-[#B83A4B]/10 text-[#B83A4B]" : "bg-[#E5A93C]/10 text-[#E5A93C]"
                }`}>{d.status === "ready" ? "Siap" : d.status === "failed" ? "Gagal" : "Proses"}</span>
              </div>
            </button>
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
        <span className={accent ? "text-[#E5A93C]" : "text-[#1D2D50]"}>{icon}</span>
      </div>
      <div className={`mt-4 text-xs uppercase tracking-[0.2em] ${accent ? "text-white/60" : "text-[#A0A2B1]"}`}>{label}</div>
      <div className={`font-heading text-3xl mt-1 ${accent ? "text-white" : "text-[#1A1B26]"}`}>{value}</div>
    </div>
  );
}
