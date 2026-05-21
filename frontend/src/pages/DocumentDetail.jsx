import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getDocument, generateQuiz, getQuiz, deleteDocument, cancelQuiz, getLatestDocResult, generateDocumentAudio, updateProfile, waitForStatus } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, BrainCircuit, FileText, GitBranch, ArrowLeft, Code2, Trash2, X, AlertTriangle, MessageSquare, Bot, FileSearch, Sparkles, TrendingUp, Volume2, Loader2, SlidersHorizontal } from "lucide-react";
import PdfViewer from "@/components/PdfViewer";
import DocumentDiscussion from "@/components/DocumentDiscussion";
import DocumentAiChat from "@/components/DocumentAiChat";

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const { user, setUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "ringkasan";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
  }, [searchParams]);
  const [doc, setDoc] = useState(null);
  const [latestResult, setLatestResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingQuizId, setPendingQuizId] = useState(null);
  const [abortCtl, setAbortCtl] = useState(null);
  const [docAudioUrl, setDocAudioUrl] = useState(null);
  const [docAudioLoading, setDocAudioLoading] = useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(10);

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
      setDocAudioUrl(null);
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDocPlayAudio = async () => {
    if (docAudioUrl) { audioRef.current?.play(); return; }
    setDocAudioLoading(true);
    try {
      const res = await generateDocumentAudio(id);
      setDocAudioUrl(res.audio_url);
      setTimeout(() => audioRef.current?.play(), 300);
    } catch (e) {
      toast.error("Gagal generate audio: " + (e.response?.data?.detail || e.message));
    } finally { setDocAudioLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try { 
        const [d, res] = await Promise.all([
          getDocument(id),
          getLatestDocResult(id)
        ]);
        setDoc(d); 
        setLatestResult(res);
      } finally { setLoading(false); }
    })();
  }, [id]);

  const startQuiz = async (questionCount = 5) => {
    setGenerating(true);
    const ctl = new AbortController();
    setAbortCtl(ctl);
    toast.info(`Menyiapkan ${questionCount} soal kuis HOTS… ini hanya memakan waktu beberapa detik karena sistem asinkronus paralel.`);
    let init;
    try {
      init = await generateQuiz(id, questionCount);
      setPendingQuizId(init.quiz_id);
      // Tunggu status via WebSocket, bukan polling
      await waitForStatus("quiz", init.quiz_id, { signal: ctl.signal });
      const quiz = await getQuiz(init.quiz_id);
      navigate(`/kuis/${quiz.quiz_id}`, { state: { quiz } });
    } catch (e) {
      if (e.cancelled) toast.info("Generate kuis dibatalkan");
      else toast.error(e?.response?.data?.detail || e?.message || "Gagal generate kuis");
    } finally {
      setGenerating(false);
      setPendingQuizId(null);
      setAbortCtl(null);
    }
  };

  const cancelGenerating = async () => {
    if (pendingQuizId) {
      try { await cancelQuiz(pendingQuizId); } catch {}
    }
    abortCtl?.abort();
  };

  const onDeleteDoc = async () => {
    try {
      await deleteDocument(id);
      toast.success("Dokumen dihapus");
      navigate("/dokumen", { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus");
    }
  };

  if (loading) return <div className="text-sm text-[#646675]">Memuat dokumen…</div>;
  if (!doc) return <div className="text-sm text-[#646675]">Dokumen tidak ditemukan.</div>;

  return (
    <div className="w-full" data-testid="document-detail-page">
      <button
        onClick={() => navigate(-1)}
        data-testid="back-btn"
        className="inline-flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8 fade-up">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> {doc.filename}
          </div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-2 leading-tight">{doc.title || doc.filename}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {latestResult && latestResult.status !== 'none' && (
          <div className="bg-[#FBFAF7] border border-[#E2E0D8] rounded-lg px-4 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className={`text-lg font-bold font-heading ${latestResult.score >= 80 ? 'text-green-600' : latestResult.score >= 60 ? 'text-[#E5A93C]' : 'text-[#B83A4B]'}`}>
              {latestResult.score}
            </div>
            <div className="h-8 w-px bg-[#E2E0D8]" />
            <div className="max-w-[200px] md:max-w-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#1D2D50] uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#E5A93C]" /> Saran Tutor AI
              </div>
              <p className="text-[11px] text-[#646675] line-clamp-1 italic">
                "{latestResult.summary}"
              </p>
            </div>
            <button 
              onClick={() => navigate(`/hasil/${latestResult.result_id || latestResult._id}`)}
              className="p-1.5 hover:bg-white rounded-md text-[#1D2D50] transition-colors"
              title="Lihat Detail Feedback"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>
        )}
        <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="start-quiz-btn"
              disabled={generating || doc.status !== "ready"}
              className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white h-11 px-5 rounded-md"
            >
              <BrainCircuit className="w-4 h-4 mr-2" />
              {generating ? "Menyiapkan…" : "Mulai Kuis HOTS"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white border border-[#E2E0D8] rounded-xl shadow-xl p-6">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#1A1B26] flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-[#B83A4B]" />
                Kustomisasi Kuis HOTS
              </DialogTitle>
              <DialogDescription className="text-xs text-[#646675]">
                Atur jumlah soal kuis dan pilih preset pengerjaan yang kamu inginkan untuk memulai latihan kuis cerdas.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#1D2D50] uppercase tracking-wider">Pilih Preset Soal</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { count: 5, label: "Latihan Kilat", desc: "5 Soal HOTS" },
                    { count: 10, label: "Ujian Harian", desc: "10 Soal HOTS" },
                    { count: 30, label: "Tryout UTS", desc: "30 Soal HOTS" },
                    { count: 60, label: "Tryout Utama", desc: "60 Soal HOTS" }
                  ].map((preset) => (
                    <button
                      key={preset.count}
                      onClick={() => setSelectedQuestionCount(preset.count)}
                      className={`p-3 text-left rounded-lg border transition-all duration-200 ${
                        selectedQuestionCount === preset.count
                          ? "border-[#B83A4B] bg-[#B83A4B]/5"
                          : "border-[#E2E0D8] hover:border-[#A0A2B1] bg-[#FBFAF7]"
                      }`}
                    >
                      <div className="text-sm font-bold text-[#1A1B26]">{preset.label}</div>
                      <div className="text-xs text-[#646675] mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-[#1D2D50] uppercase tracking-wider">Jumlah Soal Kustom</Label>
                  <span className="text-sm font-bold text-[#B83A4B] bg-[#B83A4B]/10 px-2 py-0.5 rounded-full">
                    {selectedQuestionCount} Soal
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={selectedQuestionCount}
                  onChange={(e) => setSelectedQuestionCount(parseInt(e.target.value))}
                  className="w-full accent-[#B83A4B] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#A0A2B1]">
                  <span>Minimal: 5</span>
                  <span>Maksimal: 60</span>
                </div>
              </div>

              <div className="bg-[#FBFAF7] border border-[#E2E0D8] rounded-lg p-3 text-xs text-[#646675] space-y-1.5">
                <div className="flex justify-between">
                  <span>Estimasi Pembuatan AI:</span>
                  <strong className="text-[#1A1B26]">~{Math.max(5, Math.ceil(selectedQuestionCount / 10) * 3)} Detik</strong>
                </div>
                <div className="flex justify-between">
                  <span>Waktu Pengerjaan Kuis:</span>
                  <strong className="text-[#1A1B26]">~{selectedQuestionCount * 2} Menit</strong>
                </div>
                <p className="text-[10px] text-[#A0A2B1] italic mt-1 leading-relaxed">
                  * Kuis berskala besar (lebih dari 10 soal) akan di-generate secara paralel dengan model AI tangguh untuk menjamin performa cepat dan bebas timeout.
                </p>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsQuizDialogOpen(false)}
                className="border-[#E2E0D8] text-[#646675] hover:bg-slate-50"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsQuizDialogOpen(false);
                  startQuiz(selectedQuestionCount);
                }}
                className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white"
              >
                Mulai Kuis Sekarang
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {generating && (
          <Button
            data-testid="cancel-quiz-gen"
            onClick={cancelGenerating}
            variant="outline"
            className="border-[#E2E0D8] text-[#B83A4B] hover:bg-[#B83A4B]/5 h-11 px-4"
          >
            <X className="w-4 h-4 mr-1.5" /> Batal
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button data-testid="delete-doc-btn" variant="outline" className="border-[#E2E0D8] text-[#646675] hover:text-[#B83A4B] h-11 px-4">
              <Trash2 className="w-4 h-4 mr-1.5" /> Hapus
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Hapus dokumen ini?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Termasuk semua kuis & hasil yang sudah dibuat dari dokumen ini.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={onDeleteDoc} data-testid="confirm-delete-doc" className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white">
                Hapus permanen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          const next = { tab: v };
          const mention = searchParams.get("mention");
          if (mention) next.mention = mention;
          setSearchParams(next, { replace: true });
        }}
        className="w-full"
      >
        <TabsList className="bg-white border border-[#E2E0D8] p-1 h-auto flex-wrap">
          <TabsTrigger data-testid="tab-ringkasan" value="ringkasan" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
            <BookOpen className="w-4 h-4 mr-1.5" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger data-testid="tab-konsep" value="konsep" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
            <BrainCircuit className="w-4 h-4 mr-1.5" /> Konsep
          </TabsTrigger>
          <TabsTrigger data-testid="tab-diagram" value="diagram" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
            <GitBranch className="w-4 h-4 mr-1.5" /> Diagram
          </TabsTrigger>
          {doc?.ai_generated ? (
            <TabsTrigger data-testid="tab-materi" value="materi" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
              <BookOpen className="w-4 h-4 mr-1.5" /> Materi
            </TabsTrigger>
          ) : (
            <TabsTrigger data-testid="tab-pdf" value="pdf" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
              <FileSearch className="w-4 h-4 mr-1.5" /> PDF
            </TabsTrigger>
          )}
          <TabsTrigger data-testid="tab-diskusi" value="diskusi" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
            <MessageSquare className="w-4 h-4 mr-1.5" /> Diskusi
          </TabsTrigger>
          <TabsTrigger data-testid="tab-ai" value="ai" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-3 py-2 text-xs md:text-sm">
            <Bot className="w-4 h-4 mr-1.5" /> Tanya AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-6">
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 md:p-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xl text-[#1A1B26]">Abstraksi & Ringkasan</h3>
              {doc.status === "ready" && doc.summary && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDocPlayAudio}
                    disabled={docAudioLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D2D50]/10 hover:bg-[#1D2D50]/20 text-[#1D2D50] text-xs transition-colors shrink-0"
                  >
                    {docAudioLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    {docAudioLoading ? "Memproses..." : "Dengarkan"}
                  </button>
                </div>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-[#1A1B26] leading-relaxed whitespace-pre-line">
              {doc.summary || "Belum ada ringkasan."}
            </div>
            {docAudioUrl && (
              <audio
                ref={audioRef}
                src={docAudioUrl}
                controls
                className="mt-4 w-full"
              >
                Browser tidak mendukung audio.
              </audio>
            )}
            {doc.learning_objectives?.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#E2E0D8]">
                <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-3">Tujuan Pembelajaran</div>
                <ul className="space-y-2">
                  {doc.learning_objectives.map((o, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[#1A1B26]">
                      <span className="font-mono text-[#B83A4B] text-xs mt-0.5">{String(i+1).padStart(2,"0")}</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="konsep" className="mt-6">
          <div className="grid md:grid-cols-2 gap-5">
            {(doc.key_concepts || []).map((c, i) => (
              <div key={i} data-testid={`concept-${i}`} className="card-lift bg-white border border-[#E2E0D8] rounded-xl p-6 overflow-hidden">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="font-mono text-xs text-[#A0A2B1] mt-1.5 shrink-0">{String(i+1).padStart(2,"0")}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading text-lg text-[#1A1B26] break-words">{c.concept}</h4>
                    <p className="text-sm text-[#646675] mt-2 leading-relaxed whitespace-pre-line break-words">{c.explanation}</p>
                    {c.code_example && (
                      <pre className="mt-4 bg-[#1A1B26] text-[#F8F6F0] font-mono text-[12px] p-4 rounded-md overflow-x-auto max-w-full">
                        <div className="text-[10px] text-[#E5A93C] uppercase tracking-[0.2em] mb-2 flex items-center gap-1 shrink-0"><Code2 className="w-3 h-3" />Contoh Kode</div>
                        <code className="block">{c.code_example}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(doc.key_concepts || []).length === 0 && (
              <div className="text-sm text-[#646675]">Belum ada konsep diekstrak.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="diagram" className="mt-6">
          {(doc.diagrams || []).length === 0 ? (
            <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
              Tidak terdeteksi diagram teknis di dokumen ini.
            </div>
          ) : (
            <div className="space-y-5">
              {doc.diagrams.map((dg, i) => (
                <div key={i} data-testid={`diagram-${i}`} className="bg-white border border-[#E2E0D8] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#E5A93C] font-mono">{dg.type}</span>
                  </div>
                  <h4 className="font-heading text-lg text-[#1A1B26]">{dg.name}</h4>
                  <p className="text-sm text-[#646675] mt-2 leading-relaxed">{dg.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {doc?.ai_generated && doc?.ai_content && (
          <TabsContent value="materi" className="mt-6">
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 md:p-10 space-y-8 overflow-hidden">
              <div>
                <h3 className="font-heading text-xl text-[#1A1B26] mb-4 break-words">Catatan Belajar</h3>
                <div className="text-sm text-[#1A1B26] leading-relaxed whitespace-pre-wrap break-words">
                  {doc.ai_content.study_notes || doc.summary || "Belum ada catatan."}
                </div>
              </div>

              {doc.ai_content.practice_questions?.length > 0 && (
                <div className="pt-6 border-t border-[#E2E0D8]">
                  <h3 className="font-heading text-xl text-[#1A1B26] mb-4">Soal Latihan</h3>
                  <div className="space-y-4">
                    {doc.ai_content.practice_questions.map((q, i) => (
                      <div key={i} className="p-4 border border-[#E2E0D8] rounded-xl">
                        <div className="text-sm font-medium text-[#1A1B26]">{i + 1}. {q.question}</div>
                        <div className="mt-2 space-y-1">
                          {q.options?.map((opt, j) => (
                            <div key={j} className={`text-xs ml-4 ${j === q.correct_index ? "text-[#2D6A4F] font-medium" : "text-[#646675]"}`}>
                              {String.fromCharCode(65 + j)}. {opt}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-[#2D6A4F] mt-2">Jawaban: {String.fromCharCode(65 + (q.correct_index || 0))}</div>
                        {q.explanation && <div className="text-xs text-[#646675] mt-1">{q.explanation}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="pdf" className="mt-6">
          {doc?.ai_generated ? (
            <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
              <BookOpen className="w-10 h-10 text-[#A0A2B1] mx-auto mb-3" />
              Dokumen ini dibuat oleh AI, tidak ada file PDF. Lihat tab <strong>Materi</strong> untuk konten belajar.
            </div>
          ) : (
            <PdfViewer documentId={id} filename={doc.filename} />
          )}
        </TabsContent>

        <TabsContent value="diskusi" className="mt-6">
          <DocumentDiscussion documentId={id} documentTitle={doc.title} />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <DocumentAiChat documentId={id} prefillResultId={searchParams.get("mention")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
