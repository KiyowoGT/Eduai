import { useEffect, useState } from "react";
import { listDocuments } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowUpRight } from "lucide-react";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try { setDocs(await listDocuments()); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="max-w-6xl" data-testid="documents-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Semua Dokumen</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Perpustakaan Akademik</h1>
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
            <button
              key={d.document_id}
              data-testid={`doc-item-${d.document_id}`}
              onClick={() => navigate(`/dokumen/${d.document_id}`)}
              className="card-lift text-left bg-white border border-[#E2E0D8] rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <FileText className="w-5 h-5 text-[#1D2D50]" />
                <ArrowUpRight className="w-4 h-4 text-[#A0A2B1]" />
              </div>
              <div className="font-heading text-lg text-[#1A1B26] mt-3 line-clamp-2">{d.title || d.filename}</div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-mono text-[#A0A2B1]">{new Date(d.created_at).toLocaleDateString("id-ID")}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                  d.status === "ready" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : d.status === "failed" ? "bg-[#B83A4B]/10 text-[#B83A4B]" : "bg-[#E5A93C]/10 text-[#E5A93C]"
                }`}>{d.status === "ready" ? "Siap" : d.status === "failed" ? "Gagal" : "Proses"}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
