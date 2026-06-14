import { useState } from "react";
import { http } from "@/lib/api";
import { toast } from "sonner";
import { Bug, X } from "lucide-react";

export default function ReportBugModal({ onClose }) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await http.post("/system/report-bug", { title, severity });
      toast.success("Bug berhasil dilaporkan!");
      onClose();
    } catch (e) {
      toast.error("Gagal melapor: " + (e.response?.data?.detail || "Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1A1B26]/60 backdrop-blur-sm fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-[#E2E0D8]">
        <div className="flex justify-between items-center">
          <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2">
            <Bug className="w-5 h-5 text-[#B83A4B]" /> Lapor Bug
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#F8F6F0] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#646675]" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input 
            className="w-full border border-[#E2E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D50]" 
            placeholder="Apa masalahnya?" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            required 
          />
          <select 
            className="w-full border border-[#E2E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D50]" 
            value={severity} 
            onChange={e => setSeverity(e.target.value)}
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-[#1D2D50] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1D2D50]/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Mengirim..." : "Kirim Laporan"}
          </button>
        </form>
      </div>
    </div>
  );
}
