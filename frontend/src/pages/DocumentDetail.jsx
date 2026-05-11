import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDocument, generateQuiz, getQuiz, deleteDocument, cancelQuiz } from "@/lib/api";
import { pollUntilReady } from "@/lib/poll";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, BrainCircuit, FileText, GitBranch, ArrowLeft, Code2, Trash2, X, AlertTriangle } from "lucide-react";

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingQuizId, setPendingQuizId] = useState(null);
  const [abortCtl, setAbortCtl] = useState(null);

  useEffect(() => {
    (async () => {
      try { setDoc(await getDocument(id)); } finally { setLoading(false); }
    })();
  }, [id]);

  const startQuiz = async () => {
    setGenerating(true);
    const ctl = new AbortController();
    setAbortCtl(ctl);
    toast.info("Menyiapkan kuis HOTS… ini bisa 30–60 detik.");
    let init;
    try {
      init = await generateQuiz(id, 5);
      setPendingQuizId(init.quiz_id);
      const quiz = await pollUntilReady(() => getQuiz(init.quiz_id), { signal: ctl.signal });
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
    <div className="max-w-6xl" data-testid="document-detail-page">
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
        <Button
          data-testid="start-quiz-btn"
          onClick={startQuiz}
          disabled={generating || doc.status !== "ready"}
          className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white h-11 px-5 rounded-md"
        >
          <BrainCircuit className="w-4 h-4 mr-2" />
          {generating ? "Menyiapkan…" : "Mulai Kuis HOTS"}
        </Button>
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

      <Tabs defaultValue="ringkasan" className="w-full">
        <TabsList className="bg-white border border-[#E2E0D8] p-1 h-auto">
          <TabsTrigger data-testid="tab-ringkasan" value="ringkasan" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-4 py-2">
            <BookOpen className="w-4 h-4 mr-2" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger data-testid="tab-konsep" value="konsep" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-4 py-2">
            <BrainCircuit className="w-4 h-4 mr-2" /> Peta Konsep
          </TabsTrigger>
          <TabsTrigger data-testid="tab-diagram" value="diagram" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-4 py-2">
            <GitBranch className="w-4 h-4 mr-2" /> Diagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-6">
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 md:p-10">
            <h3 className="font-heading text-xl text-[#1A1B26] mb-4">Abstraksi & Ringkasan</h3>
            <div className="prose prose-sm max-w-none text-[#1A1B26] leading-relaxed whitespace-pre-line">
              {doc.summary || "Belum ada ringkasan."}
            </div>
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
              <div key={i} data-testid={`concept-${i}`} className="card-lift bg-white border border-[#E2E0D8] rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="font-mono text-xs text-[#A0A2B1] mt-1.5">{String(i+1).padStart(2,"0")}</div>
                  <div className="flex-1">
                    <h4 className="font-heading text-lg text-[#1A1B26]">{c.concept}</h4>
                    <p className="text-sm text-[#646675] mt-2 leading-relaxed">{c.explanation}</p>
                    {c.code_example && (
                      <pre className="mt-4 bg-[#1A1B26] text-[#F8F6F0] font-mono text-[12px] p-4 rounded-md overflow-x-auto">
                        <div className="text-[10px] text-[#E5A93C] uppercase tracking-[0.2em] mb-2 flex items-center gap-1"><Code2 className="w-3 h-3" />Contoh Kode</div>
                        {c.code_example}
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
      </Tabs>
    </div>
  );
}
