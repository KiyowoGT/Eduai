import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listQuizResults } from "@/lib/api";
import { ScrollText, BrainCircuit, ArrowRight, Loader2, AlertCircle, ChevronDown, ChevronUp, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuizHistory() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listQuizResults();
      if (res && res.results) {
        setResults(res.results);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat kuis:", err);
      setError(err?.response?.data?.detail || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scoreColor = (s) => {
    if (s >= 80) return "text-green-600 bg-green-50";
    if (s >= 60) return "text-[#E5A93C] bg-orange-50";
    return "text-[#B83A4B] bg-red-50";
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) {
        const hrs = Math.floor(diff / 3600000);
        if (hrs === 0) return "baru saja";
        return `${hrs}j lalu`;
      }
      if (days < 30) return `${days}h lalu`;
      return new Date(dateStr).toLocaleDateString("id-ID");
    } catch {
      return "—";
    }
  };

  const toggleExpand = (e, id) => {
    e.stopPropagation();
    setExpanded(expanded === id ? null : id);
  };

  return (
    <div className="w-full" data-testid="quiz-history-page">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-2">
            <BrainCircuit className="w-3.5 h-3.5" /> Kuis
          </div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-2 leading-tight">Riwayat Kuis</h1>
          <p className="text-sm text-[#646675] mt-2">Lihat perkembangan belajar dan saran dari AI.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={load} 
          disabled={loading}
          className="border-[#E2E0D8] text-[#646675]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Perbarui
        </Button>
      </div>

      {loading && results.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-[#646675]">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat riwayat...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <div className="text-sm text-red-600 font-medium">Ups! Terjadi kesalahan</div>
          <div className="text-xs text-red-500 mt-1">{error}</div>
          <Button variant="link" onClick={load} className="text-red-600 mt-2 h-auto p-0">Coba lagi</Button>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-12 text-center">
          <BrainCircuit className="w-12 h-12 text-[#A0A2B1] mx-auto mb-3" />
          <div className="text-sm text-[#646675]">Belum ada riwayat kuis. Kerjakan kuis dari dokumen kamu!</div>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((r) => {
            const src = r.source_titles?.join(", ") || "Dokumen";
            const isProcessing = r.status === "processing";
            const isFailed = r.status === "failed";
            const isExpanded = expanded === r.result_id;

            return (
              <div
                key={r.result_id}
                onClick={() => !isProcessing && navigate(`/hasil/${r.result_id}`)}
                className={`bg-white border border-[#E2E0D8] rounded-xl overflow-hidden transition-all ${isProcessing ? 'opacity-70 cursor-wait' : 'hover:border-[#1D2D50]/30 cursor-pointer'}`}
              >
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full grid place-items-center font-heading text-xl font-bold ${scoreColor(r.score)}`}>
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : (r.score ?? "?")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-[#1A1B26]">
                          {isProcessing ? "Sedang Dinilai..." : `Skor ${r.score}`}
                        </div>
                        {isFailed && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Gagal
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#646675] mt-0.5 line-clamp-1 max-w-[200px] md:max-w-md">{src}</div>
                      <div className="text-[10px] text-[#A0A2B1] mt-1">{timeAgo(r.created_at)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {r.summary && (
                      <button 
                        onClick={(e) => toggleExpand(e, r.result_id)}
                        className="p-2 hover:bg-[#F8F6F0] rounded-lg transition-colors text-[#1D2D50]"
                        title="Lihat Saran AI"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    )}
                    {!isProcessing && <ArrowRight className="w-4 h-4 text-[#A0A2B1]" />}
                  </div>
                </div>

                {isExpanded && r.summary && (
                  <div className="px-5 pb-5 pt-0 border-t border-[#F8F6F0] bg-[#FBFAF7]/50">
                    <div className="mt-4 p-4 bg-white border border-[#E2E0D8] rounded-lg">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1D2D50] mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" /> Saran Pengembangan AI
                      </div>
                      <p className="text-xs text-[#646675] leading-relaxed whitespace-pre-line">
                        {r.summary}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}