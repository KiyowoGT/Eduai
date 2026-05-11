import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { listFolders, createFolder, deleteFolder, moveDocuments } from "@/lib/api";
import { toast } from "sonner";
import { FolderPlus, FolderOpen, Trash2, AlertTriangle, Plus, ArrowUpRight } from "lucide-react";

export default function Folders() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    try { setFolders(await listFolders()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e?.preventDefault();
    if (!name.trim()) { toast.error("Nama folder wajib"); return; }
    setCreating(true);
    try {
      await createFolder(name.trim());
      toast.success("Folder dibuat");
      setName(""); setOpen(false); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    } finally { setCreating(false); }
  };

  const onDelete = async (id, fname) => {
    try {
      const r = await deleteFolder(id);
      toast.success(`"${fname}" dihapus${r.documents_deleted ? ` (${r.documents_deleted} dokumen)` : ""}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    }
  };

  const onDrop = async (e, folderId) => {
    e.preventDefault();
    const ids = e.dataTransfer.getData("doc-ids");
    if (!ids) return;
    const idList = ids.split(",").filter(Boolean);
    if (!idList.length) return;
    try {
      const res = await moveDocuments(idList, folderId);
      toast.success(`${res.moved} dokumen dipindahkan`);
      load();
    } catch (err) {
      toast.error("Gagal memindahkan");
    }
  };

  return (
    <div className="max-w-6xl" data-testid="folders-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Pengelompokan</div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Folder Materi</h1>
          <p className="text-sm text-[#646675] mt-2">Atur dokumen per pertemuan, mata pelajaran, atau topik. Drag dokumen ke folder untuk memindahkan.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-folder-btn" className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-5">
              <FolderPlus className="w-4 h-4 mr-2" /> Folder Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="font-heading">Buat Folder Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-3">
              <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Nama Folder</Label>
              <Input
                data-testid="folder-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Pertemuan 7 — Polymorphism"
                className="h-11"
                autoFocus
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
                <Button data-testid="folder-create-confirm" type="submit" disabled={creating} className="bg-[#1D2D50] hover:bg-[#15223E] text-white">
                  {creating ? "Membuat…" : "Buat"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat…</div>
      ) : folders.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-12 text-center" data-testid="empty-folders">
          <FolderOpen className="w-10 h-10 text-[#A0A2B1] mx-auto mb-3" />
          <div className="font-heading text-lg text-[#1A1B26]">Belum ada folder</div>
          <p className="text-sm text-[#646675] mt-1 max-w-sm mx-auto">Buat folder untuk mengelompokkan modul per pertemuan, semester, atau tema.</p>
          <Button onClick={() => setOpen(true)} className="mt-5 bg-[#1D2D50] hover:bg-[#15223E] text-white" data-testid="empty-create-folder">
            <Plus className="w-4 h-4 mr-2" /> Buat Folder Pertama
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {folders.map((f) => (
            <div
              key={f.folder_id}
              data-testid={`folder-card-${f.folder_id}`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2","ring-[#1D2D50]"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("ring-2","ring-[#1D2D50]")}
              onDrop={(e) => { e.currentTarget.classList.remove("ring-2","ring-[#1D2D50]"); onDrop(e, f.folder_id); }}
              className="card-lift bg-white border border-[#E2E0D8] rounded-xl p-5 relative group transition-all"
            >
              <button onClick={() => navigate(`/folder/${f.folder_id}`)} className="absolute inset-0 rounded-xl" aria-label={f.name} />
              <div className="flex items-start justify-between pointer-events-none">
                <FolderOpen className="w-5 h-5 text-[#E5A93C]" />
                <ArrowUpRight className="w-4 h-4 text-[#A0A2B1]" />
              </div>
              <div className="font-heading text-lg text-[#1A1B26] mt-3 line-clamp-2 pointer-events-none">{f.name}</div>
              <div className="mt-3 flex items-center justify-between text-xs pointer-events-none">
                <span className="text-[#646675]">{f.document_count || 0} dokumen</span>
                <span className="font-mono text-[#A0A2B1]">{new Date(f.created_at).toLocaleDateString("id-ID")}</span>
              </div>
              <div className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button data-testid={`folder-delete-${f.folder_id}`} size="sm" variant="ghost" onClick={(e) => e.stopPropagation()} className="h-7 w-7 p-0 bg-white border border-[#E2E0D8] text-[#646675] hover:text-[#B83A4B]" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-heading flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Hapus folder?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="font-medium text-[#1A1B26]">{f.name}</span> akan dihapus permanen, <strong>termasuk {f.document_count || 0} dokumen di dalamnya</strong> beserta semua kuis & hasilnya.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction data-testid={`folder-delete-confirm-${f.folder_id}`} onClick={() => onDelete(f.folder_id, f.name)} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white">
                        Hapus permanen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
