import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getFolder, generateQuiz, getQuiz, createRecap, getRecap, cancelQuiz, cancelRecap } from "@/lib/api";
import { pollUntilReady } from "@/lib/poll";
import { toast } from "sonner";
import { FolderOpen, BrainCircuit, BookOpen, FileText, ArrowLeft, ArrowUpRight, X } from "lucide-react";

export default function FolderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [folder, setFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);

  const load = async () => {
    try { setFolder(await getFolder(id)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const docs = folder?.documents || [];
  const readyDocs = docs.filter((d) => d.status === "ready");
  const usingFolderMode = selected.size === 0;
  const targetIds = usingFolderMode ? readyDocs.map((d) => d.document_id) : Array.from(selected);

  const toggle = (docId) => {
    const next = new Set(selected);
    if (next.has(docId)) next.delete(docId); else next.add(docId);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(readyDocs.map((d) => d.document_id)));
  const clearSel = () => setSelected(new Set());

  const startQuiz = async () => {
    if (!targetIds.length) { toast.error("Tidak ada dokumen siap di folder ini"); return; }
    setBusy(true);
    toast.info(`Menyiapkan kuis HOTS dari ${targetIds.length} dokumen…`);
    let init;
    try {
      init = await generateQuiz({ document_ids: targetIds, folder_id: usingFolderMode ? id : undefined, question_count: 5 });
      setPending({ type: "quiz", id: init.quiz_id });
      const quiz = await pollUntilReady(() => getQuiz(init.quiz_id));
      navigate(`/kuis/${quiz.quiz_id}`, { state: { quiz } });
    } catch (e) {
      if (e.cancelled) toast.info("Dibatalkan");
      else toast.error(e?.response?.data?.detail || e?.message || "Gagal");
    } finally { setBusy(false); setPending(null); }
  };

  const startRecap = async () => {
    if (!targetIds.length) { toast.error("Tidak ada dokumen siap di folder ini"); return; }
    setBusy(true);
    toast.info(`Membuat rangkuman gabungan dari ${targetIds.length} dokumen…`);
    let init;
    try {
      init = await createRecap({ document_ids: targetIds, folder_id: usingFolderMode ? id : undefined });
      setPending({ type: "recap", id: init.recap_id });
      const recap = await pollUntilReady(() => getRecap(init.recap_id));
      navigate(`/recap/${recap.recap_id}`, { state: { recap } });
    } catch (e) {
      if (e.cancelled) toast.info("Dibatalkan");
      else toast.error(e?.response?.data?.detail || e?.message || "Gagal");
    } finally { setBusy(false); setPending(null); }
  };

  const cancelBusy = async () => {
    if (!pending) return;
    try {
      if (pending.type === "quiz") await cancelQuiz(pending.id);
      else await cancelRecap(pending.id);
      toast.info("Dibatalkan");
    } catch {}
  };

  if (loading) return <div className="text-sm text-[#646675]">Memuat folder…</div>;
  if (!folder) return <div className="text-sm text-[#646675]">Folder tidak ditemukan.</div>;

  return (
    <div className="max-w-6xl" data-testid="folder-detail-page">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] mb-6" data-testid="folder-back">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8 fade-up">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-[#E5A93C]" /> Folder
          </div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-2 leading-tight">{folder.name}</h1>
          <p className="text-sm text-[#646675] mt-1.5">{readyDocs.length} dokumen siap · {docs.length - readyDocs.length} masih diproses</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button data-testid="folder-recap-btn" onClick={startRecap} disabled={busy || readyDocs.length === 0} variant="outline" className="border-[#E2E0D8] text-[#1D2D50] hover:bg-[#1D2D50] hover:text-white h-11 px-5">
            <BookOpen className="w-4 h-4 mr-2" /> {busy && pending?.type === "recap" ? "Membuat…" : "Rangkuman Gabungan"}
          </Button>
          <Button data-testid="folder-quiz-btn" onClick={startQuiz} disabled={busy || readyDocs.length === 0} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white h-11 px-5">
            <BrainCircuit className="w-4 h-4 mr-2" /> {busy && pending?.type === "quiz" ? "Menyiapkan…" : "Mulai Kuis"}
          </Button>
          {busy && (
            <Button data-testid="folder-cancel" onClick={cancelBusy} variant="outline" className="border-[#E2E0D8] text-[#B83A4B] hover:bg-[#B83A4B]/5 h-11 px-4">
              <X className="w-4 h-4 mr-1.5" /> Batal
            </Button>
          )}
        </div>
      </div>

      {/* Selection bar */}
      <div className="mb-5 flex items-center justify-between text-sm">
        <div className="text-[#646675]">
          {usingFolderMode ? (
            <span>Semua <strong className="text-[#1A1B26]">{readyDocs.length}</strong> dokumen siap dipakai. Centang untuk batasi pilihan.</span>
          ) : (
            <span><strong className="text-[#1A1B26]">{selected.size}</strong> dokumen dipilih.</span>
          )}
        </div>
        <div className="flex gap-3 text-xs">
          <button onClick={selectAll} className="text-[#1D2D50] hover:text-[#B83A4B]" data-testid="select-all">Pilih semua</button>
          {selected.size > 0 && <button onClick={clearSel} className="text-[#646675] hover:text-[#1A1B26]" data-testid="clear-selection">Batalkan pilihan</button>}
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
          Folder kosong. Drag dokumen ke folder ini dari halaman Dokumen.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.map((d) => (
            <label key={d.document_id} className="relative" data-testid={`folder-doc-${d.document_id}`}>
              <div className={`card-lift bg-white border rounded-xl p-5 cursor-pointer transition-all ${selected.has(d.document_id) ? "border-[#1D2D50] ring-2 ring-[#1D2D50]/20" : "border-[#E2E0D8]"}`}>
                <div className="flex items-start justify-between">
                  <Checkbox
                    checked={selected.has(d.document_id)}
                    onCheckedChange={() => toggle(d.document_id)}
                    disabled={d.status !== "ready"}
                    data-testid={`folder-doc-check-${d.document_id}`}
                  />
                  <button onClick={(e) => { e.preventDefault(); navigate(`/dokumen/${d.document_id}`); }} title="Buka detail" className="text-[#A0A2B1] hover:text-[#1D2D50]" data-testid={`folder-doc-open-${d.document_id}`}>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <FileText className="w-4 h-4 text-[#1D2D50]" />
                  <div className="font-heading text-base text-[#1A1B26] line-clamp-2">{d.title || d.filename}</div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[#A0A2B1]">{new Date(d.created_at).toLocaleDateString("id-ID")}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                    d.status === "ready" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" :
                    d.status === "failed" ? "bg-[#B83A4B]/10 text-[#B83A4B]" :
                    d.status === "cancelled" ? "bg-[#A0A2B1]/10 text-[#646675]" :
                    "bg-[#E5A93C]/10 text-[#E5A93C]"
                  }`}>{d.status === "ready" ? "Siap" : d.status === "failed" ? "Gagal" : d.status === "cancelled" ? "Dibatal" : "Proses"}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
