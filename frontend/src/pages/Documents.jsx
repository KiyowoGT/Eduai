import { useEffect, useState } from "react";
import { listDocuments, cancelDocument, deleteDocument } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { DocCard } from "@/pages/Dashboard";
import { toast } from "sonner";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try { setDocs(await listDocuments()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onCancel = async (id) => {
    try { await cancelDocument(id); toast.success("Dibatalkan"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  const onDelete = async (id, name) => {
    try { await deleteDocument(id); toast.success(`Dihapus: ${name}`); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="max-w-6xl" data-testid="documents-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Semua Dokumen</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Perpustakaan Akademik</h1>
        <p className="text-sm text-[#646675] mt-2">Kumpulan modul per pertemuan & jurnal yang sudah lu unggah. Hover kartu untuk hapus atau batalkan proses.</p>
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat…</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
          Belum ada dokumen. Upload PDF dari Dashboard.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.map((d) => (
            <DocCard
              key={d.document_id}
              doc={d}
              onOpen={() => navigate(`/dokumen/${d.document_id}`)}
              onCancel={() => onCancel(d.document_id)}
              onDelete={() => onDelete(d.document_id, d.title || d.filename)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
