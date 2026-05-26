import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { listFolders, createFolder, deleteFolder, moveDocuments, renameFolder } from "@/lib/api";
import { toast } from "sonner";
import { FolderPlus, FolderOpen, Trash2, AlertTriangle, Plus, ArrowUpRight, Pencil } from "lucide-react";
import DualLoader from "@/components/DualLoader";

export default function Folders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const load = async () => {
    try {
      setFolders((await listFolders()) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e) => {
    e?.preventDefault();
    if (!createName.trim()) {
      toast.error("Nama folder wajib");
      return;
    }
    setCreating(true);
    try {
      await createFolder(createName.trim());
      toast.success("Folder dibuat");
      setCreateName("");
      setCreateOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    } finally {
      setCreating(false);
    }
  };

  const onRename = async (e) => {
    e?.preventDefault();
    if (!renameTarget || !renameName.trim()) return;
    setRenaming(true);
    try {
      await renameFolder(renameTarget.folder_id, renameName.trim());
      toast.success("Folder diubah");
      setRenameOpen(false);
      setRenameTarget(null);
      setRenameName("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal rename folder");
    } finally {
      setRenaming(false);
    }
  };

  const onDelete = async (id, fname) => {
    try {
      const r = await deleteFolder(id);
      toast.success(`"${fname}" dipindahkan ke arsip. ${r.documents_moved_out || 0} dokumen tetap aman.`);
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
    try {
      const res = await moveDocuments(idList, folderId);
      toast.success(`${res.moved} dokumen dipindahkan`);
      load();
    } catch {
      toast.error("Gagal memindahkan");
    }
  };

  const isInstitutionalStudent = user?.role === "pelajar" && user?.institution_code;

  return (
    <div className="w-full" data-testid="folders-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Pengelompokan</div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Folder Materi</h1>
          <p className="text-sm text-[#646675] mt-2">Atur dokumen per pertemuan, mata pelajaran, atau topik. Drag dokumen ke folder untuk memindahkan.</p>
        </div>
        {!isInstitutionalStudent && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Misal: Pertemuan 7 - Polymorphism" className="h-11" autoFocus />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={creating} className="bg-[#1D2D50] hover:bg-[#15223E] text-white">
                    {creating ? "Membuat..." : "Buat"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isInstitutionalStudent && (
        <div className="bg-[#FFF8E1] border border-[#E5A93C]/30 rounded-xl p-5 mb-8 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#E5A93C] shrink-0" />
          <div className="text-sm text-[#1A1B26]">
            Struktur folder dan mata pelajaran Anda dikelola secara otomatis oleh pihak sekolah sesuai kurikulum.
          </div>
        </div>
      )}

      {loading ? (
        <DualLoader type="folders" text="Memuat daftar folder..." />
      ) : folders.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-12 text-center" data-testid="empty-folders">
          <FolderOpen className="w-10 h-10 text-[#A0A2B1] mx-auto mb-3" />
          <div className="font-heading text-lg text-[#1A1B26]">Belum ada folder</div>
          <p className="text-sm text-[#646675] mt-1 max-w-sm mx-auto">Buat folder untuk mengelompokkan modul per pertemuan, semester, atau tema.</p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-[#1D2D50] hover:bg-[#15223E] text-white">
            <Plus className="w-4 h-4 mr-2" /> Buat Folder Pertama
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {folders.map((folder) => (
            <div
              key={folder.folder_id}
              data-testid={`folder-card-${folder.folder_id}`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-[#1D2D50]"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-[#1D2D50]")}
              onDrop={(e) => { e.currentTarget.classList.remove("ring-2", "ring-[#1D2D50]"); onDrop(e, folder.folder_id); }}
              className="card-lift bg-white border border-[#E2E0D8] rounded-xl p-5 relative group transition-all"
            >
              <button onClick={() => navigate(`/folder/${folder.folder_id}`)} className="absolute inset-0 rounded-xl" aria-label={folder.name} />
              <div className="flex items-start justify-between pointer-events-none">
                <FolderOpen className="w-5 h-5 text-[#E5A93C]" />
                <ArrowUpRight className="w-4 h-4 text-[#A0A2B1]" />
              </div>
              <div className="font-heading text-lg text-[#1A1B26] mt-3 line-clamp-2 pointer-events-none">{folder.name}</div>
              <div className="mt-3 flex items-center justify-between text-xs pointer-events-none">
                <span className="text-[#646675]">{folder.document_count || 0} dokumen</span>
                <span className="font-mono text-[#A0A2B1]">{new Date(folder.created_at).toLocaleDateString("id-ID")}</span>
              </div>
              {!isInstitutionalStudent && (
                <div className="absolute top-3 right-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameTarget(folder);
                      setRenameName(folder.name);
                      setRenameOpen(true);
                    }}
                    className="h-7 w-7 p-0 bg-white border border-[#E2E0D8] text-[#646675] hover:text-[#1D2D50]"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()} className="h-7 w-7 p-0 bg-white border border-[#E2E0D8] text-[#646675] hover:text-[#B83A4B]" title="Arsipkan">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Arsipkan folder?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Folder <span className="font-medium text-[#1A1B26]">{folder.name}</span> akan disembunyikan dari daftar, tetapi dokumen di dalamnya tidak dihapus dan akan dipindahkan keluar dari folder.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(folder.folder_id, folder.name)} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white">
                          Arsipkan
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="font-heading">Rename Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={onRename} className="space-y-3">
            <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Nama Folder Baru</Label>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} className="h-11" autoFocus />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>Batal</Button>
              <Button type="submit" disabled={renaming} className="bg-[#1D2D50] hover:bg-[#15223E] text-white">
                {renaming ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
