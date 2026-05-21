import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { http } from "@/lib/api";

export default function PdfViewer({ documentId, filename }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let currentUrl = null;
    (async () => {
      try {
        const response = await http.get(`/documents/${documentId}/pdf`, {
          responseType: "blob",
        });
        if (cancelled) return;
        const blob = new Blob([response.data], { type: "application/pdf" });
        currentUrl = URL.createObjectURL(blob);
        setPdfUrl(currentUrl);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || "Gagal memuat PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white border border-[#E2E0D8] rounded-xl">
        <Loader2 className="w-6 h-6 text-[#1D2D50] animate-spin" />
        <span className="ml-2 text-sm text-[#646675]">Memuat PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white border border-dashed border-[#E2E0D8] rounded-xl">
        <FileText className="w-12 h-12 text-[#A0A2B1] mb-3" />
        <div className="text-sm text-[#646675]">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden" style={{ height: "80vh" }}>
      <embed
        src={pdfUrl}
        type="application/pdf"
        className="w-full h-full"
        title={filename || "PDF Viewer"}
      />
    </div>
  );
}