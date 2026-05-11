import { useEffect, useState } from "react";
import { listDocuments, listFolders, cancelDocument, deleteDocument, moveDocuments } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FileText, ArrowUpRight, FolderInput, Trash2, X, AlertTriangle, FolderOpen, MoreVertical } from "lucide-react";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [d, f] = await Promise.all([listDocuments(), listFolders()]);
      setDocs(d); setFolders(f);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const selectAllReady = () => setSelected(new Set(docs.filter(d => d.status === "ready").map(d => d.document_id)));
  const clearSel = () => setSelected(new Set());

  const onCancel = async (id) => {
    try { await cancelDocument(id); toast.success("Dibatalkan"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  const onDelete = async (id, name) => {
    try { await deleteDocument(id); toast.success(`Dihapus: ${name}`); clearSel(); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const moveSelectedTo = async (folderId) => {
    if (selected.size === 0) return;
    try {
      const r = await moveDocuments(Array.from(selected), folderId);
      toast.success(`${r.moved} dokumen dipindahkan${folderId ? "" : " keluar dari folder"}`);
      clearSel(); load();
    } catch (e) { toast.error("Gagal memindahkan"); }
  };

  const bulkDelete = async () => {
    let success = 0;
    for (const id of Array.from(selected)) {
      try { await deleteDocument(id); success++; } catch {}
    }
    toast.success(`${success} dokumen dihapus`);
    clearSel(); load();
  };

  const handleDragStart = (e, docId) => {
    // If selection contains the dragged doc, drag all selected; otherwise drag just this one
    const ids = selected.has(docId) ? Array.from(selected) : [docId];
    e.dataTransfer.setData("doc-ids", ids.join(","));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropToFolder = async (e, folderId) => {
    e.preventDefault();
    const ids = e.dataTransfer.getData("doc-ids");
    if (!ids) return;
    const idList = ids.split(",").filter(Boolean);
    try {
      const r = await moveDocuments(idList, folderId);
      toast.success(`${r.moved} dokumen dipindahkan`);
      clearSel(); load();
    } catch { toast.error("Gagal memindahkan"); }
  };

  const folderById = (id) => folders.find(f => f.folder_id === id);

  return (
    <div className="max-w-6xl" data-testid="documents-page">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Semua Dokumen</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Perpustakaan Akademik</h1>
        <p className="text-sm text-[#646675] mt-2">Centang untuk bulk action. Drag kartu ke folder untuk memindahkan.</p>
      </div>

      {/* Folder strip (drop targets) */}
      {folders.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" data-testid="folder-strip">
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2","ring-[#1D2D50]"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("ring-2","ring-[#1D2D50]")}
            onDrop={(e) => { e.currentTarget.classList.remove("ring-2","ring-[#1D2D50]"); onDropToFolder(e, null); }}
            className="px-3 py-2 rounded-md bg-white border border-dashed border-[#E2E0D8] text-xs text-[#646675] flex items-center gap-1.5 transition-all"
            data-testid="dropzone-no-folder"
          >
            <X className="w-3.5 h-3.5" /> Tanpa Folder
          </div>
          {folders.map((f) => (
            <button
              key={f.folder_id}
              onClick={() => navigate(`/folder/${f.folder_id}`)}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2","ring-[#E5A93C]"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("ring-2","ring-[#E5A93C]")}
              onDrop={(e) => { e.currentTarget.classList.remove("ring-2","ring-[#E5A93C]"); onDropToFolder(e, f.folder_id); }}
              data-testid={`dropzone-${f.folder_id}`}
              className="px-3 py-2 rounded-md bg-white border border-[#E2E0D8] text-xs text-[#1A1B26] flex items-center gap-1.5 hover:border-[#E5A93C] hover:bg-[#E5A93C]/5 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#E5A93C]" /> {f.name} <span className="text-[#A0A2B1] font-mono">{f.document_count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-10 mb-5 flex items-center gap-3 bg-[#1D2D50] text-white rounded-lg px-4 py-2.5 fade-up" data-testid="bulk-action-bar">
          <div className="text-sm font-medium">{selected.size} dipilih</div>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="bulk-move-btn" size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8">
                <FolderInput className="w-3.5 h-3.5 mr-1.5" /> Pindahkan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white">
              <DropdownMenuLabel>Pindahkan ke…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => moveSelectedTo(null)} data-testid="bulk-move-none">Keluar dari folder</DropdownMenuItem>
              {folders.map((f) => (
                <DropdownMenuItem key={f.folder_id} onClick={() => moveSelectedTo(f.folder_id)} data-testid={`bulk-move-${f.folder_id}`}>
                  <FolderOpen className="w-3.5 h-3.5 mr-2 text-[#E5A93C]" /> {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button data-testid="bulk-delete-btn" size="sm" variant="ghost" className="text-white hover:bg-[#B83A4B] h-8">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hapus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Hapus {selected.size} dokumen?</AlertDialogTitle>
                <AlertDialogDescription>Semua dokumen yang dipilih beserta kuis & hasilnya akan dihapus permanen.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={bulkDelete} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white" data-testid="confirm-bulk-delete">Hapus permanen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button data-testid="clear-bulk-selection" size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8" onClick={clearSel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs">
        <button onClick={selectAllReady} className="text-[#1D2D50] hover:text-[#B83A4B]" data-testid="select-all-ready">Pilih semua yang siap</button>
        <span className="text-[#A0A2B1] font-mono">{docs.length} dokumen</span>
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat…</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
          Belum ada dokumen. Upload PDF dari Dashboard.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.map((d) => {
            const isSel = selected.has(d.document_id);
            const isProc = d.status === "processing";
            const folder = d.folder_id ? folderById(d.folder_id) : null;
            return (
              <div
                key={d.document_id}
                draggable={d.status === "ready"}
                onDragStart={(e) => handleDragStart(e, d.document_id)}
                data-testid={`doc-card-${d.document_id}`}
                className={`card-lift relative bg-white border rounded-xl p-5 group transition-all ${isSel ? "border-[#1D2D50] ring-2 ring-[#1D2D50]/20" : "border-[#E2E0D8]"}`}
              >
                <div className="flex items-start justify-between">
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggle(d.document_id)}
                    disabled={d.status !== "ready"}
                    data-testid={`doc-check-${d.document_id}`}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#A0A2B1] hover:text-[#1A1B26]" data-testid={`doc-menu-${d.document_id}`}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white">
                      <DropdownMenuItem onClick={() => navigate(`/dokumen/${d.document_id}`)} data-testid={`doc-open-${d.document_id}`}>
                        <ArrowUpRight className="w-3.5 h-3.5 mr-2" /> Buka detail
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Pindahkan ke</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => moveDocuments([d.document_id], null).then(load)} data-testid={`doc-move-none-${d.document_id}`}>
                        Tanpa folder
                      </DropdownMenuItem>
                      {folders.map((f) => (
                        <DropdownMenuItem key={f.folder_id} onClick={() => moveDocuments([d.document_id], f.folder_id).then(load)} data-testid={`doc-move-${f.folder_id}-${d.document_id}`}>
                          <FolderOpen className="w-3.5 h-3.5 mr-2 text-[#E5A93C]" /> {f.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      {isProc && (
                        <DropdownMenuItem onClick={() => onCancel(d.document_id)} className="text-[#B83A4B]" data-testid={`doc-cancel-${d.document_id}`}>
                          <X className="w-3.5 h-3.5 mr-2" /> Batalkan proses
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onDelete(d.document_id, d.title || d.filename)} className="text-[#B83A4B]" data-testid={`doc-delete-${d.document_id}`}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button onClick={() => navigate(`/dokumen/${d.document_id}`)} className="w-full text-left mt-3" data-testid={`doc-open-body-${d.document_id}`}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1D2D50]" />
                    <div className="font-heading text-lg text-[#1A1B26] line-clamp-2">{d.title || d.filename}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {folder && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E5A93C]/10 text-[#1A1B26] truncate"><FolderOpen className="w-2.5 h-2.5 text-[#E5A93C]" />{folder.name}</span>}
                      <span className="font-mono text-[#A0A2B1]">{new Date(d.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                      d.status === "ready" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" :
                      d.status === "failed" ? "bg-[#B83A4B]/10 text-[#B83A4B]" :
                      d.status === "cancelled" ? "bg-[#A0A2B1]/10 text-[#646675]" :
                      "bg-[#E5A93C]/10 text-[#E5A93C]"
                    }`}>{d.status === "ready" ? "Siap" : d.status === "failed" ? "Gagal" : d.status === "cancelled" ? "Dibatal" : "Proses"}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
