import { useState } from "react";
import { X } from "lucide-react";
import { http } from "@/lib/api";
import { toast } from "sonner";

export default function BugReportModal({ isOpen, onClose }) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!title) return;
    setLoading(true);
    try {
      await http.post("/report-bug", { 
        title, 
        severity: "Medium" // Default internal
      });
      toast.success("Laporan terkirim ke tim CS.");
      setTitle("");
      onClose();
    } catch {
      toast.error("Gagal mengirim laporan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="font-heading text-lg text-[#1A1B26]">Lapor Masalah ke CS</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-[#646675]"/></button>
        </div>
        <textarea 
          className="w-full border border-[#E2E0D8] p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20" 
          placeholder="Ceritakan masalah atau kendala kamu..." 
          value={title} 
          onChange={e => setTitle(e.target.value)}
          rows={5}
        />
        <button onClick={submit} disabled={loading} className="w-full bg-[#1D2D50] text-white py-2.5 rounded-lg text-sm font-bold hover:bg-[#15223E] transition-colors disabled:opacity-50">
          {loading ? "Mengirim..." : "Kirim Laporan"}
        </button>
      </div>
    </div>
  );
}
