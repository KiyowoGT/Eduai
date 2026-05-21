import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { getFolder, generateQuiz, getQuiz, createRecap, getRecap, cancelQuiz, cancelRecap, getLatestFolderResult, waitForStatus } from "@/lib/api";
import { toast } from "sonner";
import { FolderOpen, BrainCircuit, BookOpen, FileText, ArrowLeft, ArrowUpRight, X, Sparkles, TrendingUp, History } from "lucide-react";

export default function FolderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [folder, setFolder] = useState(null);
  const [latestResult, setLatestResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedRecapId, setSelectedRecapId] = useState("");
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(10);

  const load = useCallback(async () => {
    try {
      const [f, res] = await Promise.all([
        getFolder(id),
        getLatestFolderResult(id)
      ]);
      setFolder(f);
      setLatestResult(res);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [id, load]);

  const docs = folder?.documents || [];
  const readyDocs = docs.filter((d) => d.status === "ready");
  const recaps = folder?.recaps || [];

  const toggle = (docId) => {
    const next = new Set(selected);
    if (next.has(docId)) next.delete(docId); else next.add(docId);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(readyDocs.map((d) => d.document_id)));
  const clearSel = () => setSelected(new Set());

  const openRecapPicker = (mode) => {
    if (selected.size < 2) {
      toast.error("Pilih minimal 2 dokumen");
      return;
    }
    if (recaps.length > 0) {
      setDialogMode(mode);
      setSelectedRecapId(recaps[0].recap_id);
      setDialogOpen(true);
    } else {
      if (mode === "recap") doCreateRecap();
      else doStartQuiz(null);
    }
  };

  const doCreateRecap = async () => {
    setBusy(true);
    const targetIds = Array.from(selected);
    toast.info(`Membuat rangkuman gabungan dari ${targetIds.length} dokumen…`);
    try {
      const init = await createRecap({ document_ids: targetIds, folder_id: id });
      setPending({ type: "recap", id: init.recap_id });
      // Tunggu status via WebSocket, bukan polling
      await waitForStatus("recap", init.recap_id);
      const recap = await getRecap(init.recap_id);
      navigate(`/recap/${recap.recap_id}`, { state: { recap } });
    } catch (e) {
      if (e.cancelled) toast.info("Dibatalkan");
      else toast.error(e?.response?.data?.detail || e?.message || "Gagal");
    } finally { setBusy(false); setPending(null); }
  };

  const doStartQuiz = async (recapId, questionCount = 5) => {
    setBusy(true);
    const targetIds = Array.from(selected);
    toast.info(`Menyiapkan ${questionCount} soal kuis HOTS dari ${targetIds.length} dokumen…`);
    try {
      const init = await generateQuiz({
        document_ids: targetIds,
        folder_id: id,
        recap_id: recapId || undefined,
        question_count: questionCount,
      });
      setPending({ type: "quiz", id: init.quiz_id });
      // Tunggu status via WebSocket, bukan polling
      await waitForStatus("quiz", init.quiz_id);
      const quiz = await getQuiz(init.quiz_id);
      navigate(`/kuis/${quiz.quiz_id}`, { state: { quiz } });
    } catch (e) {
      if (e.cancelled) toast.info("Dibatalkan");
      else toast.error(e?.response?.data?.detail || e?.message || "Gagal");
    } finally { setBusy(false); setPending(null); }
  };

  const handleDialogConfirm = () => {
    setDialogOpen(false);
    if (dialogMode === "recap" && selectedRecapId === "__new__") {
      doCreateRecap();
    } else if (dialogMode === "recap") {
      navigate(`/recap/${selectedRecapId}`);
    } else if (dialogMode === "quiz" && selectedRecapId === "__none__") {
      doStartQuiz(null, selectedQuestionCount);
    } else if (dialogMode === "quiz") {
      doStartQuiz(selectedRecapId, selectedQuestionCount);
    }
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
    <div className="w-full" data-testid="folder-detail-page">
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

          {latestResult && latestResult.status !== 'none' && (
            <div className="mt-4 bg-[#FBFAF7] border border-[#E2E0D8] rounded-lg px-4 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500 max-w-2xl">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold font-heading text-lg ${latestResult.score >= 80 ? 'border-green-500 text-green-600' : latestResult.score >= 60 ? 'border-[#E5A93C] text-[#E5A93C]' : 'border-[#B83A4B] text-[#B83A4B]'}`}>
                {latestResult.score}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#1D2D50] uppercase tracking-wider mb-0.5">
                  <Sparkles className="w-3 h-3 text-[#E5A93C]" /> Fokus Belajar Berikutnya
                </div>
                <p className="text-xs text-[#646675] line-clamp-2 leading-relaxed italic">
                  "{latestResult.summary}"
                </p>
              </div>
              <button
                onClick={() => navigate(`/hasil/${latestResult.result_id || latestResult._id}`)}
                className="flex items-center gap-1 text-[10px] font-bold text-[#1D2D50] hover:text-[#B83A4B] transition-colors bg-white px-2 py-1 rounded border border-[#E2E0D8]"
              >
                Detail <TrendingUp className="w-3 h-3" />
              </button>
            </div>
          )}

          {folder.recap_id && (
            <div className="mt-3 bg-white border border-[#E2E0D8] rounded-lg px-4 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500 max-w-2xl">
              <div className="w-12 h-12 rounded-full border-2 border-[#1D2D50] bg-[#1D2D50]/5 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#1D2D50]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#1D2D50] uppercase tracking-wider mb-0.5">
                  <Sparkles className="w-3 h-3 text-[#E5A93C]" /> Rangkuman Gabungan
                </div>
                <p className="text-xs text-[#646675] line-clamp-2 leading-relaxed">
                  {folder.recap_summary || "Rangkuman sudah tersimpan. Klik lihat detail untuk membuka."}
                </p>
                <p className="text-[10px] text-[#A0A2B1] mt-1">
                  {folder.recap_document_ids?.length || 0} dokumen · {new Date(folder.recap_generated_at).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => navigate(`/recap/${folder.recap_id}`)}
                className="flex items-center gap-1 text-[10px] font-bold text-[#1D2D50] hover:text-[#B83A4B] transition-colors bg-[#FBFAF7] px-2 py-1 rounded border border-[#E2E0D8] shrink-0"
              >
                Lihat Detail <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {recaps.length > 0 && (
            <div className="mt-4 max-w-2xl">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mb-2">
                <History className="w-3 h-3" /> Riwayat Rangkuman ({recaps.length})
              </div>
              <div className="space-y-1.5">
                {recaps.map((r) => (
                  <div key={r.recap_id} className="flex items-center justify-between px-3 py-2 bg-[#FBFAF7] border border-[#E2E0D8] rounded-lg">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <BookOpen className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                      <span className="text-xs text-[#1A1B26] truncate">{r.title || "Rangkuman"}</span>
                      <span className="text-[10px] text-[#A0A2B1] shrink-0">
                        {new Date(r.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/recap/${r.recap_id}`)}
                      className="text-[#1D2D50] hover:text-[#B83A4B] shrink-0 ml-2"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button data-testid="folder-recap-btn" onClick={() => openRecapPicker("recap")} disabled={busy || readyDocs.length === 0} variant="outline" className="border-[#E2E0D8] text-[#1D2D50] hover:bg-[#1D2D50] hover:text-white h-11 px-5">
            <BookOpen className="w-4 h-4 mr-2" /> {busy && pending?.type === "recap" ? "Membuat…" : "Rangkuman Gabungan"}
          </Button>
          <Button data-testid="folder-quiz-btn" onClick={() => openRecapPicker("quiz")} disabled={busy || readyDocs.length === 0} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white h-11 px-5">
            <BrainCircuit className="w-4 h-4 mr-2" /> {busy && pending?.type === "quiz" ? "Menyiapkan…" : "Mulai Kuis"}
          </Button>
          {busy && (
            <Button data-testid="folder-cancel" onClick={cancelBusy} variant="outline" className="border-[#E2E0D8] text-[#B83A4B] hover:bg-[#B83A4B]/5 h-11 px-4">
              <X className="w-4 h-4 mr-1.5" /> Batal
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between text-sm">
        <div className="text-[#646675]">
          <strong className="text-[#1A1B26]">{selected.size}</strong> dokumen dipilih
          {selected.size > 0 && selected.size < 2 && (
            <span className="ml-2 text-[#B83A4B] text-xs">(pilih minimal 2 untuk mulai)</span>
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
                  {d.summary && d.status === "ready" && (
                    <p className="text-[11px] text-[#646675] mt-2 leading-relaxed line-clamp-3">{d.summary}</p>
                  )}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {dialogMode === "recap" ? "Pilih Rangkuman" : "Gunakan Rangkuman untuk Kuis"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "recap"
                ? "Pilih rangkuman yang sudah ada, atau buat yang baru dari dokumen yang dipilih."
                : "Pilih rangkuman sebagai sumber soal kuis, atau gunakan langsung dokumen yang dipilih."}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={selectedRecapId} onValueChange={setSelectedRecapId} className="space-y-2">
            {recaps.map((r) => {
              const recapDocCount = r.document_ids?.length || 0;
              const label = r.title || "Rangkuman";
              const subtitle = `${recapDocCount} dokumen · ${new Date(r.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })}`;
              return (
                <div key={r.recap_id} className="flex items-start gap-3 p-3 border border-[#E2E0D8] rounded-lg has-[:checked]:border-[#1D2D50] has-[:checked]:ring-1 has-[:checked]:ring-[#1D2D50]/20">
                  <RadioGroupItem value={r.recap_id} id={r.recap_id} className="mt-0.5" />
                  <Label htmlFor={r.recap_id} className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm text-[#1A1B26]">{label}</div>
                    <div className="text-[11px] text-[#646675]">{subtitle}</div>
                  </Label>
                </div>
              );
            })}
            {dialogMode === "recap" && (
              <div className="flex items-start gap-3 p-3 border border-dashed border-[#E2E0D8] rounded-lg has-[:checked]:border-[#1D2D50] has-[:checked]:ring-1 has-[:checked]:ring-[#1D2D50]/20">
                <RadioGroupItem value="__new__" id="__new__" className="mt-0.5" />
                <Label htmlFor="__new__" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm text-[#1A1B26]">Buat Rangkuman Baru</div>
                  <div className="text-[11px] text-[#646675]">Dari {selected.size} dokumen yang dipilih</div>
                </Label>
              </div>
            )}
            {dialogMode === "quiz" && (
              <div className="flex items-start gap-3 p-3 border border-dashed border-[#E2E0D8] rounded-lg has-[:checked]:border-[#1D2D50] has-[:checked]:ring-1 has-[:checked]:ring-[#1D2D50]/20">
                <RadioGroupItem value="__none__" id="__none__" className="mt-0.5" />
                <Label htmlFor="__none__" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm text-[#1A1B26]">Gunakan Langsung Dokumen</div>
                  <div className="text-[11px] text-[#646675]">Soal dibuat dari {selected.size} dokumen tanpa rangkuman</div>
                </Label>
              </div>
            )}
          </RadioGroup>

          {dialogMode === "quiz" && (
            <div className="border-t border-[#E2E0D8] pt-4 mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#1D2D50] uppercase tracking-wider">Kustomisasi Kuis HOTS</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 30, 60].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSelectedQuestionCount(count)}
                      className={`py-2 px-1 text-center rounded-md border text-xs font-bold transition-all duration-200 ${
                        selectedQuestionCount === count
                          ? "border-[#B83A4B] bg-[#B83A4B]/5 text-[#B83A4B]"
                          : "border-[#E2E0D8] hover:border-[#A0A2B1] bg-[#FBFAF7] text-[#1A1B26]"
                      }`}
                    >
                      {count} Soal
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-[#646675]">Jumlah Soal Kustom</span>
                  <span className="text-xs font-bold text-[#B83A4B] bg-[#B83A4B]/10 px-2 py-0.5 rounded-full">
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
                <div className="flex justify-between text-[9px] text-[#A0A2B1]">
                  <span>5 Soal</span>
                  <span>60 Soal</span>
                </div>
              </div>

              <div className="bg-[#FBFAF7] border border-[#E2E0D8] rounded-lg p-2.5 text-[11px] text-[#646675] space-y-1">
                <div className="flex justify-between">
                  <span>Estimasi Pembuatan:</span>
                  <strong className="text-[#1A1B26]">~{Math.max(5, Math.ceil(selectedQuestionCount / 10) * 3)} Detik</strong>
                </div>
                <div className="flex justify-between">
                  <span>Waktu Pengerjaan Kuis:</span>
                  <strong className="text-[#1A1B26]">~{selectedQuestionCount * 2} Menit</strong>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#E2E0D8]">Batal</Button>
            <Button onClick={handleDialogConfirm} className="bg-[#1D2D50] hover:bg-[#151f3d] text-white">
              {dialogMode === "recap" && selectedRecapId === "__new__" ? "Buat" : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
