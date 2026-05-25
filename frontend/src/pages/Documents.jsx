import { useEffect, useState, useRef } from "react";
import {
  listDocuments,
  listFolders,
  cancelDocument,
  deleteDocument,
  moveDocuments,
  listTeacherMaterials,
  listTeacherMaterialsClasses,
  uploadTeacherMaterial,
  publishTeacherMaterial,
  generateTeacherQuiz,
  publishTeacherQuiz,
  generateRedeemCode,
  updateTeacherMaterial
} from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  FileText,
  ArrowUpRight,
  FolderInput,
  Trash2,
  X,
  AlertTriangle,
  FolderOpen,
  MoreVertical,
  Upload,
  Loader2,
  BookOpen,
  Send,
  Plus,
  QrCode,
  CheckCircle2,
  Bot,
  Edit3
} from "lucide-react";
import DualLoader from "@/components/DualLoader";
import { useAuth } from "@/context/AuthContext";
import useRealtimeSocket from "@/hooks/useRealtimeSocket";

export default function Documents() {
  const { user } = useAuth();
  const isTeacher = user?.role === "pengajar";
  const navigate = useNavigate();

  // Common states
  const [loading, setLoading] = useState(true);

  // Student specific states
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(new Set());

  // Teacher specific states
  const [materials, setMaterials] = useState([]);
  const [classes, setClasses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [quizCountMap, setQuizCountMap] = useState({});
  const [quizGeneratingMap, setQuizGeneratingMap] = useState({});
  const [publishClassMap, setPublishClassMap] = useState({});
  const [publishingQuizMap, setPublishingQuizMap] = useState({});
  const [redeemExpMap, setRedeemExpMap] = useState({});
  const [generatingRedeemMap, setGeneratingRedeemMap] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const [editingDocClasses, setEditingDocClasses] = useState(null);
  const [editSelectedClasses, setEditSelectedClasses] = useState([]);
  const [savingClasses, setSavingClasses] = useState(false);

  // Realtime updates for teacher/student documents
  useRealtimeSocket((payload) => {
    if (payload?.type === "document_status") {
      if (isTeacher) {
        // Refresh materials list if there is a processing state change
        listTeacherMaterials().then(setMaterials).catch(() => []);
      } else {
        // Refresh student docs
        listDocuments().then(setDocs).catch(() => []);
      }
    }
  });

  const loadStudentData = async () => {
    try {
      const [d, f] = await Promise.all([listDocuments(), listFolders()]);
      setDocs(d ?? []);
      setFolders(f ?? []);
    } catch {
      toast.error("Gagal memuat pustaka dokumen");
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherData = async () => {
    try {
      const [mList, cList] = await Promise.all([
        listTeacherMaterials(),
        listTeacherMaterialsClasses()
      ]);
      setMaterials(mList ?? []);
      setClasses(cList ?? []);
    } catch {
      toast.error("Gagal memuat materi pengajar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isTeacher) {
      loadTeacherData();
    } else {
      loadStudentData();
    }
  }, [isTeacher]);

  // ================= STUDENT ACTIONS =================
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const selectAllReady = () => setSelected(new Set(docs.filter(d => d.status === "ready").map(d => d.document_id)));
  const clearSel = () => setSelected(new Set());

  const onCancel = async (id) => {
    try {
      await cancelDocument(id);
      toast.success("Dibatalkan");
      if (isTeacher) loadTeacherData(); else loadStudentData();
    }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  const onDelete = async (id, name) => {
    try {
      await deleteDocument(id);
      toast.success(`Dihapus: ${name}`);
      if (isTeacher) {
        loadTeacherData();
      } else {
        clearSel();
        loadStudentData();
      }
    }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const moveSelectedTo = async (folderId) => {
    if (selected.size === 0) return;
    try {
      const r = await moveDocuments(Array.from(selected), folderId);
      toast.success(`${r.moved} dokumen dipindahkan${folderId ? "" : " keluar dari folder"}`);
      clearSel(); loadStudentData();
    } catch (e) { toast.error("Gagal memindahkan"); }
  };

  const bulkDelete = async () => {
    let success = 0;
    for (const id of Array.from(selected)) {
      try { await deleteDocument(id); success++; } catch {}
    }
    toast.success(`${success} dokumen dihapus`);
    clearSel(); loadStudentData();
  };

  const handleDragStart = (e, docId) => {
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
      clearSel(); loadStudentData();
    } catch { toast.error("Gagal memindahkan"); }
  };

  const folderById = (id) => folders.find(f => f.folder_id === id);

  // ================= TEACHER ACTIONS =================
  const handleTeacherUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const subjectName = user?.assigned_subject || subjectInput.trim();
    if (!subjectName) {
      toast.error("Isi mata pelajaran terlebih dahulu.");
      return;
    }

    setUploading(true);
    try {
      await uploadTeacherMaterial(file, subjectName, selectedClasses);
      toast.success("Materi berhasil diunggah dan sedang dianalisis oleh AI.");
      setSelectedClasses([]);
      setSubjectInput("");
      loadTeacherData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mengunggah materi.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateClasses = async () => {
    if (!editingDocClasses) return;
    setSavingClasses(true);
    try {
      await updateTeacherMaterial(editingDocClasses.document_id, {
        target_class_rooms: editSelectedClasses
      });
      toast.success("Sasaran kelas materi berhasil diperbarui!");
      setEditingDocClasses(null);
      loadTeacherData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal memperbarui sasaran kelas.");
    } finally {
      setSavingClasses(false);
    }
  };

  const handlePublishMaterial = async (docId) => {
    try {
      await publishTeacherMaterial(docId);
      toast.success("Materi berhasil dipublikasikan ke siswa sekolah!");
      loadTeacherData();
    } catch (err) {
      toast.error("Gagal mempublikasikan materi.");
    }
  };

  const handleGenerateQuiz = async (docId) => {
    const qCount = quizCountMap[docId] || 5;
    setQuizGeneratingMap(prev => ({ ...prev, [docId]: true }));
    try {
      await generateTeacherQuiz(docId, qCount);
      toast.success("Kuis AI sedang diproses. Silakan tunggu.");
      loadTeacherData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal membuat kuis.");
    } finally {
      setQuizGeneratingMap(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handlePublishQuiz = async (quizId, docId) => {
    const className = publishClassMap[quizId];
    if (!className) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }
    setPublishingQuizMap(prev => ({ ...prev, [quizId]: true }));
    try {
      await publishTeacherQuiz(quizId, className);
      toast.success(`Kuis berhasil diterbitkan untuk kelas ${className}`);
      loadTeacherData();
    } catch (err) {
      toast.error("Gagal menerbitkan kuis.");
    } finally {
      setPublishingQuizMap(prev => ({ ...prev, [quizId]: false }));
    }
  };

  const handleGenerateRedeemCode = async (quizId) => {
    const rawExp = redeemExpMap[quizId];
    const expiresAt = rawExp ? new Date(rawExp) : null;
    setGeneratingRedeemMap(prev => ({ ...prev, [quizId]: true }));
    try {
      await generateRedeemCode(quizId, expiresAt);
      toast.success("Kode redeem berhasil diterbitkan!");
      loadTeacherData();
    } catch (err) {
      toast.error("Gagal membuat kode redeem.");
    } finally {
      setGeneratingRedeemMap(prev => ({ ...prev, [quizId]: false }));
    }
  };

  // Toggle selected classes for upload
  const toggleClassSelect = (clsName) => {
    if (selectedClasses.includes(clsName)) {
      setSelectedClasses(selectedClasses.filter((c) => c !== clsName));
    } else {
      setSelectedClasses([...selectedClasses, clsName]);
    }
  };

  // ================= RENDER INTERFACE =================

  // 1. TEACHER MATERIAL MANAGEMENT VIEW
  if (isTeacher) {
    return (
      <div className="w-full" data-testid="teacher-documents-page">
        <div className="mb-6 fade-up">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Pengajar Portal</div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Materi & Kuis</h1>
          <p className="text-sm text-[#646675] mt-2">
            Unggah modul ajar ({user?.assigned_subject || subjectInput || "mata pelajaran"}) dan hasilkan kuis AI untuk siswa Anda.
          </p>
        </div>

        {/* Drag & Drop Upload Zone with Class Selection */}
        {user?.permissions?.includes("studio_materi") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleTeacherUpload(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`dropzone cursor-pointer rounded-xl bg-white p-8 border border-[#E2E0D8] text-center transition-all ${dragActive ? "drag bg-[#F8F6F0]" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => { handleTeacherUpload(e.target.files); e.target.value = ""; }}
                />
                <div className="w-12 h-12 rounded-full bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center mx-auto mb-3">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-[#1D2D50] animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-[#1D2D50]" />
                  )}
                </div>
                <div className="font-heading text-lg text-[#1A1B26] font-semibold">Unggah File Modul Baru</div>
                <p className="text-xs text-[#646675] mt-1.5">
                  Pilih atau seret file PDF / Gambar. AI akan menganalisis konten untuk kuis.
                </p>
                {user?.assigned_subject ? (
                  <p className="text-[10px] text-[#A0A2B1] font-mono mt-3 uppercase tracking-wider bg-[#F8F6F0] inline-block px-2.5 py-1 rounded">
                    Mata Pelajaran: {user?.assigned_subject}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="Masukkan mata pelajaran..."
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 w-full max-w-xs mx-auto px-3 py-1.5 text-xs text-center border border-[#E2E0D8] rounded-lg bg-white text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                  />
                )}
              </div>
            </div>

            {/* Class Targeting checkboxes for uploaded material */}
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 shadow-sm">
              <h3 className="font-heading text-sm text-[#1A1B26] uppercase tracking-wider mb-3">
                Sasaran Kelas Unggahan
              </h3>
              {classes.length === 0 ? (
                <p className="text-xs text-[#646675] bg-[#F8F6F0] p-3 rounded-lg border border-dashed border-[#E2E0D8]">
                  Belum ada kelas terdaftar. Hasilkan token kelas di menu Kelas terlebih dahulu.
                </p>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {classes.map((clsName) => (
                    <label key={clsName} className="flex items-center gap-2 text-xs font-medium text-[#1A1B26] cursor-pointer hover:bg-[#F8F6F0]/50 p-1.5 rounded transition-all">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(clsName)}
                        onChange={() => toggleClassSelect(clsName)}
                        className="rounded border-[#E2E0D8] text-[#1D2D50] focus:ring-0"
                      />
                      {clsName}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-[#A0A2B1] mt-3">
                Centang untuk mengaitkan materi langsung ke kelas sasaran Anda.
              </p>
            </div>
          </div>
        )}

        {/* Materials List */}
        <h2 className="font-heading text-2xl text-[#1A1B26] mb-4">Perpustakaan Modul Ajar</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#1D2D50]" />
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
            Belum ada materi ajar yang diunggah. Gunakan area unggah di atas.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6">
            {materials.map((m) => (
              <div key={m.document_id} className="bg-white border border-[#E2E0D8] rounded-xl p-5 shadow-sm transition-all hover:border-[#1D2D50]/30">
                
                {/* Header of Material Card */}
                <div className="flex items-start justify-between">
                  <div
                    onClick={() => navigate(`/dokumen/${m.document_id}`)}
                    className="flex items-center gap-3 cursor-pointer group/title"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center group-hover/title:border-[#B83A4B]/50 transition-colors">
                      <FileText className="w-5 h-5 text-[#1D2D50]" />
                    </div>
                    <div>
                      <h3 className="font-heading text-lg font-bold text-[#1A1B26] group-hover/title:text-[#B83A4B] transition-colors">{m.title || m.filename}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#646675] mt-1">
                        <span className="font-semibold text-[#1D2D50]">{m.subject_name}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          Kelas: <strong>{m.target_class_rooms?.join(", ") || m.target_class_room || "Umum"}</strong>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDocClasses(m);
                              setEditSelectedClasses(m.target_class_rooms || (m.target_class_room ? [m.target_class_room] : []));
                            }}
                            className="p-1 text-[#A0A2B1] hover:text-[#B83A4B] transition-colors"
                            title="Ubah sasaran kelas"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[#A0A2B1]">{new Date(m.created_at).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top actions/status */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      m.status === "published" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" :
                      m.status === "ready" ? "bg-[#E5A93C]/10 text-[#E5A93C]" :
                      m.status === "failed" ? "bg-[#B83A4B]/10 text-[#B83A4B]" :
                      "bg-[#646675]/10 text-[#646675]"
                    }`}>
                      {m.status === "published" ? "Terbit" : m.status === "ready" ? "Draf" : m.status === "failed" ? "Gagal" : "Proses"}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="text-[#A0A2B1] hover:text-[#B83A4B] p-1.5 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-heading flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#B83A4B]" /> Hapus Materi ini?</AlertDialogTitle>
                          <AlertDialogDescription>Materi, kuis, dan hasil belajar terkait akan dihapus permanen.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(m.document_id, m.title)} className="bg-[#B83A4B] text-white">Hapus permanen</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Operations area: Publish & AI quiz creator */}
                {m.status === "processing" ? (
                  <div className="mt-4 p-3 bg-[#F8F6F0] border border-[#E2E0D8]/60 rounded-lg flex items-center gap-2 text-xs text-[#646675]">
                     <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E5A93C]" />
                    AI sedang menganalisis file Anda. Halaman akan terupdate otomatis.
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-[#E2E0D8]/50 flex flex-wrap gap-3 items-center justify-between">
                    
                    {/* Left: Material Publish */}
                    <div>
                      {m.status === "ready" && (
                        <Button
                          onClick={() => handlePublishMaterial(m.document_id)}
                          size="sm"
                          className="bg-[#2D6A4F] hover:bg-[#204e39] text-white text-xs"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Terbitkan Modul Ke Siswa
                        </Button>
                      )}
                      {m.status === "published" && (
                        <p className="text-xs text-[#2D6A4F] flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Modul telah diterbitkan ke perpustakaan siswa.
                        </p>
                      )}
                    </div>

                    {/* Right: AI Quiz generator tool */}
                    {user?.permissions?.includes("studio_materi") && (
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-[#646675]">Jumlah Soal:</div>
                        <Select
                          value={String(quizCountMap[m.document_id] || 5)}
                          onValueChange={(val) => setQuizCountMap(prev => ({ ...prev, [m.document_id]: parseInt(val) }))}
                        >
                          <SelectTrigger className="w-[70px] h-8 text-xs border-[#E2E0D8]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="15">15</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => handleGenerateQuiz(m.document_id)}
                          disabled={quizGeneratingMap[m.document_id]}
                          size="sm"
                          className="bg-[#1D2D50] hover:bg-[#15223E] text-white text-xs"
                        >
                          {quizGeneratingMap[m.document_id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Bot className="w-3.5 h-3.5 mr-1 text-[#E5A93C]" />
                          )}
                          Buat Kuis AI
                        </Button>
                      </div>
                    )}

                  </div>
                )}

                {/* Linked Quizzes Sub-section */}
                {m.quizzes && m.quizzes.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#E2E0D8]/40 space-y-3">
                    <h4 className="text-xs font-semibold text-[#A0A2B1] uppercase tracking-wider">Kuis Terkait Materi</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {m.quizzes.map((q) => (
                        <div key={q.quiz_id} className="p-3 bg-[#F8F6F0]/80 border border-[#E2E0D8]/80 rounded-xl relative">
                          <div className="text-xs font-bold text-[#1A1B26] truncate">
                            {q.title || "Kuis AI"}
                          </div>
                          <div className="text-[10px] text-[#646675] mt-0.5">
                            Status: <span className={q.status === "published" ? "text-[#2D6A4F] font-bold" : "text-[#E5A93C]"}>
                              {q.status === "published" ? "Terbit" : "Draf"}
                            </span>
                          </div>

                          {/* Publish Quiz Controls */}
                          {q.status === "processing" ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#A0A2B1]">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              AI sedang merumuskan butir kuis...
                            </div>
                          ) : q.status === "published" ? (
                            <div className="mt-2 space-y-1">
                              {q.class_name && (
                                <div className="text-[10px] text-[#1D2D50] bg-[#1D2D50]/5 px-2 py-0.5 rounded inline-block font-semibold">
                                  Diterbitkan di: {q.class_name}
                                </div>
                              )}
                              {q.redeem_code && (
                                <div className="text-[10px] text-[#E5A93C] bg-[#E5A93C]/10 border border-[#E5A93C]/20 px-2 py-1 rounded flex items-center gap-1 justify-between font-mono font-bold mt-1">
                                  <span>Kode Redeem: {q.redeem_code}</span>
                                  {q.redeem_usage_count > 0 && <span className="text-[9px] text-[#646675]">({q.redeem_usage_count} kali dipakai)</span>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 pt-2.5 border-t border-[#E2E0D8]/40 space-y-2">
                              {user.account_type === "pribadi" ? (
                                /* B2C / Guru Mandiri: Generate Redeem Code */
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="datetime-local"
                                      onChange={(e) => setRedeemExpMap(prev => ({ ...prev, [q.quiz_id]: e.target.value }))}
                                      className="h-7 text-[10px] p-1 bg-white border-[#E2E0D8]"
                                      title="Exp Date"
                                    />
                                    <Button
                                      onClick={() => handleGenerateRedeemCode(q.quiz_id)}
                                      disabled={generatingRedeemMap[q.quiz_id]}
                                      size="xs"
                                      className="bg-[#E5A93C] hover:bg-[#c9912e] text-[#1D2D50] h-7 text-[10px] px-2"
                                    >
                                      {generatingRedeemMap[q.quiz_id] ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <QrCode className="w-3 h-3 mr-1" />
                                      )}
                                      Hasilkan Kode
                                    </Button>
                                  </div>
                                  <span className="text-[9px] text-[#A0A2B1] block">Kosongkan tgl kadaluwarsa jika aktif selamanya.</span>
                                </div>
                              ) : (
                                /* B2B / Institutional Teacher: Assign/Publish to Class */
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={publishClassMap[q.quiz_id] || ""}
                                    onValueChange={(val) => setPublishClassMap(prev => ({ ...prev, [q.quiz_id]: val }))}
                                  >
                                    <SelectTrigger className="w-full h-8 text-[10px] bg-white border-[#E2E0D8]">
                                      <SelectValue placeholder="Pilih Kelas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {classes.map((cls) => (
                                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    onClick={() => handlePublishQuiz(q.quiz_id, m.document_id)}
                                    disabled={publishingQuizMap[q.quiz_id]}
                                    size="sm"
                                    className="bg-[#2D6A4F] hover:bg-[#204e39] text-white text-[10px] h-8 px-3 shrink-0"
                                  >
                                    {publishingQuizMap[q.quiz_id] ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      "Terbit"
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        {/* Dialog untuk Ubah Sasaran Kelas */}
        <Dialog open={!!editingDocClasses} onOpenChange={(open) => !open && setEditingDocClasses(null)}>
          <DialogContent className="max-w-md bg-white border border-[#E2E0D8] rounded-xl shadow-xl p-6">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#1A1B26]">Ubah Sasaran Kelas</DialogTitle>
              <DialogDescription className="text-xs text-[#646675] mt-1">
                Pilih kelas sasaran baru untuk modul ajar: <strong>{editingDocClasses?.title || editingDocClasses?.filename}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {classes.length === 0 ? (
                <p className="text-xs text-[#646675] bg-[#F8F6F0] p-3 rounded-lg border border-dashed border-[#E2E0D8]">
                  Belum ada kelas terdaftar. Hasilkan token kelas di menu Kelas terlebih dahulu.
                </p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {classes.map((clsName) => {
                    const isChecked = editSelectedClasses.includes(clsName);
                    return (
                      <label key={clsName} className="flex items-center gap-2.5 text-sm font-medium text-[#1A1B26] cursor-pointer hover:bg-[#F8F6F0]/50 p-2 rounded transition-all">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => {
                            const nextSelected = editSelectedClasses.includes(clsName)
                              ? editSelectedClasses.filter((c) => c !== clsName)
                              : [...editSelectedClasses, clsName];
                            setEditSelectedClasses(nextSelected);
                          }}
                        />
                        <span className="select-none">{clsName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingDocClasses(null)}
                className="border-[#E2E0D8] text-[#646675] hover:bg-slate-50"
              >
                Batal
              </Button>
              <Button
                onClick={handleUpdateClasses}
                disabled={savingClasses}
                className="bg-[#1D2D50] hover:bg-[#151f3d] text-white"
              >
                {savingClasses ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </>
        )}
      </div>
    );
  }

  // 2. ORIGINAL STUDENT LIBRARY VIEW
  return (
    <div className="w-full" data-testid="documents-page">
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
        <DualLoader type="documents" text="Memuat pustaka berkas..." />
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
                      <DropdownMenuItem onClick={() => moveDocuments([d.document_id], null).then(loadStudentData)} data-testid={`doc-move-none-${d.document_id}`}>
                        Tanpa folder
                      </DropdownMenuItem>
                      {folders.map((f) => (
                        <DropdownMenuItem key={f.folder_id} onClick={() => moveDocuments([d.document_id], f.folder_id).then(loadStudentData)} data-testid={`doc-move-${f.folder_id}-${d.document_id}`}>
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
                  <div className="mt-3 flex items-center justify-between text-xs relative pointer-events-none">
                    <div className="flex items-center gap-2 min-w-0">
                      {folder && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E5A93C]/10 text-[#1A1B26] min-w-0 max-w-[120px] sm:max-w-[180px]">
                          <FolderOpen className="w-2.5 h-2.5 text-[#E5A93C] shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </span>
                      )}
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
