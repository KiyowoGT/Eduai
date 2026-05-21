import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getQuizResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowLeft, BookMarked, Bot, MessageCircle } from "lucide-react";

export default function QuizResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(!location.state?.result);

  useEffect(() => {
    if (result) return;
    (async () => {
      try { setResult(await getQuizResult(id)); } finally { setLoading(false); }
    })();
  }, [id, result]);

  if (loading) return <div className="text-sm text-[#646675]">Memuat hasil…</div>;
  if (!result) return <div className="text-sm text-[#646675]">Hasil tidak ditemukan.</div>;

  const score = result.score || 0;
  const scoreClass = score >= 80 ? "text-[#2D6A4F]" : score >= 60 ? "text-[#E5A93C]" : "text-[#B83A4B]";
  const aiChatUrl = `/dokumen/${result.document_id}?tab=ai&mention=${result.result_id}`;

  return (
    <div className="w-full" data-testid="quiz-result-page">
      <button onClick={() => navigate("/dashboard")} data-testid="result-back" className="inline-flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
      </button>

      <div className="grid md:grid-cols-12 gap-6 mb-10 fade-up">
        <div className="md:col-span-4 bg-white border border-[#E2E0D8] rounded-xl p-7">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Skor Akhir</div>
          <div className={`font-heading text-6xl mt-3 ${scoreClass}`}>{score}<span className="text-2xl text-[#A0A2B1]">/100</span></div>
          <div className="font-mono text-[11px] text-[#A0A2B1] mt-3 truncate" title={result.result_id}>{result.result_id}</div>
        </div>
        <div className="md:col-span-8 bg-[#1D2D50] text-white rounded-xl p-7">
          <div className="text-xs uppercase tracking-[0.2em] text-[#E5A93C]">Ringkasan AI</div>
          <p className="font-heading text-xl lg:text-2xl mt-2 leading-snug">{result.summary}</p>
        </div>
      </div>

      <h2 className="font-heading text-2xl text-[#1A1B26] mb-5">Deep Feedback</h2>
      <div className="space-y-5">
        {(result.items || []).map((it, i) => (
          <div key={i} data-testid={`feedback-item-${i}`} className="bg-white border border-[#E2E0D8] rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${it.is_correct ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : "bg-[#B83A4B]/10 text-[#B83A4B]"}`}>
                {it.is_correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-1">Soal {i + 1}</div>
                <p className="font-heading text-lg text-[#1A1B26] leading-snug">{it.question}</p>
                <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="px-3 py-2 rounded-md bg-[#F8F6F0] border border-[#E2E0D8]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1]">Jawaban Lu</div>
                    <div className={`mt-1 ${it.is_correct ? "text-[#2D6A4F]" : "text-[#B83A4B]"}`}>{it.selected || "—"}</div>
                  </div>
                  <div className="px-3 py-2 rounded-md bg-[#F8F6F0] border border-[#E2E0D8]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1]">Jawaban Benar</div>
                    <div className="mt-1 text-[#2D6A4F]">{it.correct}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-[#1A1B26] leading-relaxed whitespace-pre-line">{it.explanation}</div>
                {it.references?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E2E0D8]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-1.5 mb-2">
                      <BookMarked className="w-3 h-3" /> Referensi Akademik
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#646675]">
                      {it.references.map((r, j) => (
                        <li key={j} className="flex gap-2"><span className="font-mono text-[#B83A4B]">[{j+1}]</span><span>{r}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-white border border-[#E2E0D8] rounded-xl p-6" data-testid="quiz-ai-cta">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#E5A93C]/20 grid place-items-center shrink-0">
            <Bot className="w-5 h-5 text-[#E5A93C]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-lg text-[#1A1B26]">Tanya AI tentang kuis ini</h3>
            <p className="text-sm text-[#646675] mt-1 leading-relaxed">
              Percakapan disimpan di tab Tanya AI dokumen. Hasil kuis ini akan otomatis disebut dengan{" "}
              <span className="font-mono text-[#E5A93C]">@</span> supaya AI tahu konteksnya.
            </p>
            <Button
              data-testid="open-document-ai-chat"
              onClick={() => navigate(aiChatUrl)}
              className="mt-4 bg-[#1D2D50] hover:bg-[#15223E] text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Buka Tanya AI di dokumen
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <Button data-testid="back-to-doc" onClick={() => navigate(`/dokumen/${result.document_id}`)} variant="outline" className="border-[#E2E0D8]">
          Kembali ke Dokumen
        </Button>
        <Button data-testid="go-dashboard" onClick={() => navigate("/dashboard")} className="bg-[#1D2D50] hover:bg-[#15223E] text-white">
          Dashboard
        </Button>
      </div>
    </div>
  );
}
