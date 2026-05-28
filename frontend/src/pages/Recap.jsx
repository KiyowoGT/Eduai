import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { getRecap, deleteRecap, generateRecapAudio, updateProfile } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, BookMarked, BookOpen, Sparkles, Compass, FileText, Trash2, AlertTriangle, Volume2, Loader2, SlidersHorizontal } from "lucide-react";
import PageSkeleton from "@/components/PageSkeleton";

export default function Recap() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const { user, setUser } = useAuth();
  const [recap, setRecap] = useState(location.state?.recap || null);
  const [loading, setLoading] = useState(!location.state?.recap);
  const [audioUrl, setAudioUrl] = useState(recap?.audio_url || null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloneEnabled, setCloneEnabled] = useState(user?.clone_voice_enabled || false);
  const [cloneUrl, setCloneUrl] = useState(user?.clone_voice_url || "");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (user) {
      setCloneEnabled(user.clone_voice_enabled || false);
      setCloneUrl(user.clone_voice_url || "");
    }
  }, [user]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await updateProfile({
        education_level: user.education_level,
        major: user.major,
        institution: user.institution,
        current_semester: user.current_semester,
        clone_voice_enabled: cloneEnabled,
        clone_voice_url: cloneUrl.trim(),
      });
      setUser(updated);
      setSettingsOpen(false);
      toast.success("Pengaturan suara disimpan");
      // Force clearing audioUrl to re-generate if voice cloning settings changed
      setAudioUrl(null);
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (recap) return;
    (async () => {
      try {
        const r = await getRecap(id);
        setRecap(r);
        if (r.audio_url) setAudioUrl(r.audio_url);
      } finally { setLoading(false); }
    })();
  }, [id, recap]);

  const handlePlayAudio = async () => {
    if (audioUrl) {
      audioRef.current?.play();
      return;
    }
    setAudioLoading(true);
    try {
      const res = await generateRecapAudio(recap.recap_id || id);
      setAudioUrl(res.audio_url);
      setTimeout(() => audioRef.current?.play(), 300);
    } catch (e) {
      toast.error("Gagal generate audio: " + (e.response?.data?.detail || e.message));
    } finally {
      setAudioLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      await deleteRecap(id);
      toast.success("Rangkuman dihapus");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error("Gagal menghapus");
    }
  };

  if (loading) return <PageSkeleton variant="list" />;
  if (!recap) return <div className="text-sm text-[#646675]">Rangkuman tidak ditemukan.</div>;

  return (
    <div className="w-full" data-testid="recap-page">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] mb-6" data-testid="recap-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8 fade-up">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" /> Rangkuman Gabungan
          </div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-2 leading-tight">{recap.title || "Rangkuman"}</h1>
          <p className="text-sm text-[#646675] mt-1.5">{recap.source_titles?.length || 0} sumber materi</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="border-[#E2E0D8] text-[#646675] hover:text-[#B83A4B] h-11 px-4" data-testid="delete-recap-btn">
              <Trash2 className="w-4 h-4 mr-1.5" /> Hapus
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Hapus rangkuman?</AlertDialogTitle>
              <AlertDialogDescription>Rangkuman ini akan dihapus permanen. Dokumen sumber tidak akan terhapus.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white" data-testid="confirm-delete-recap">Hapus permanen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Unified summary */}
      <div className="bg-[#1D2D50] text-white rounded-xl p-7 md:p-10 mb-8" data-testid="unified-summary">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[#E5A93C] flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" /> Sintesis Lintas Materi
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayAudio}
              disabled={audioLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors shrink-0"
            >
              {audioLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              {audioLoading ? "Memproses..." : "Dengarkan"}
            </button>
          </div>
        </div>
        <div className="font-heading text-lg lg:text-xl leading-relaxed whitespace-pre-line">{recap.unified_summary}</div>
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="mt-4 w-full"
            controls
          >
            Browser tidak mendukung audio.
          </audio>
        )}
      </div>

      {/* Per-document */}
      <h2 className="font-heading text-2xl text-[#1A1B26] mb-4">Per Dokumen</h2>
      <div className="space-y-4 mb-10">
        {(recap.per_document || []).map((p, i) => (
          <div key={i} data-testid={`recap-per-doc-${i}`} className="bg-white border border-[#E2E0D8] rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="font-mono text-xs text-[#B83A4B] mt-1">{String(i+1).padStart(2,"0")}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-1">
                  <FileText className="w-3 h-3" /> {p.source_title}
                </div>
                <p className="text-sm text-[#1A1B26] leading-relaxed">{p.highlight}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shared concepts */}
      {(recap.shared_concepts || []).length > 0 && (
        <>
          <h2 className="font-heading text-2xl text-[#1A1B26] mb-4">Konsep Bersama</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {recap.shared_concepts.map((c, i) => (
              <div key={i} className="bg-white border border-[#E2E0D8] rounded-xl p-5" data-testid={`shared-concept-${i}`}>
                <div className="font-heading text-lg text-[#1A1B26]">{c.concept}</div>
                <p className="text-sm text-[#646675] mt-1.5 leading-relaxed">{c.explanation}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Study path */}
      {(recap.study_path || []).length > 0 && (
        <>
          <h2 className="font-heading text-2xl text-[#1A1B26] mb-4 flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#E5A93C]" /> Alur Belajar Disarankan
          </h2>
          <ol className="space-y-2.5 mb-10">
            {recap.study_path.map((s, i) => (
              <li key={i} className="flex gap-3 bg-white border border-[#E2E0D8] rounded-lg px-4 py-3" data-testid={`study-step-${i}`}>
                <span className="font-mono text-xs text-[#B83A4B]">{String(i+1).padStart(2,"0")}</span>
                <span className="text-sm text-[#1A1B26]">{s}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
