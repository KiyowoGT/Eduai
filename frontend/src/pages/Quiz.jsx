import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { submitQuiz, getQuizResult } from "@/lib/api";
import { pollUntilReady } from "@/lib/poll";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight } from "lucide-react";

const LETTERS = ["A","B","C","D"];

export default function Quiz() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [quiz] = useState(location.state?.quiz);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!quiz) {
      toast.error("Kuis tidak ditemukan. Mulai dari dokumen lagi.");
      navigate("/dokumen", { replace: true });
    }
  }, [quiz, navigate]);

  if (!quiz) return null;

  const total = quiz.questions.length;
  const q = quiz.questions[step];
  const selected = answers[step];

  const pick = (i) => {
    const next = [...answers]; next[step] = i; setAnswers(next);
  };

  const next = () => {
    if (selected === undefined) { toast.error("Pilih jawaban dulu"); return; }
    if (step < total - 1) setStep(step + 1);
  };

  const submit = async () => {
    if (selected === undefined) { toast.error("Pilih jawaban dulu"); return; }
    setSubmitting(true);
    toast.info("AI menilai dengan deep feedback… ini bisa 30–60 detik.");
    try {
      const init = await submitQuiz(id, answers);
      const result = await pollUntilReady(() => getQuizResult(init.result_id));
      navigate(`/hasil/${result.result_id}`, { state: { result } });
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Gagal submit kuis");
    } finally { setSubmitting(false); }
  };

  const progress = ((step + 1) / total) * 100;

  return (
    <div className="max-w-3xl mx-auto" data-testid="quiz-page">
      <button onClick={() => navigate(-1)} data-testid="quiz-back" className="inline-flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali
      </button>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Kuis HOTS</span>
        <span data-testid="quiz-counter" className="font-mono text-sm text-[#1D2D50]">{step + 1} / {total}</span>
      </div>
      <div className="h-1 bg-[#E2E0D8] rounded-full overflow-hidden mb-10">
        <div className="h-full bg-[#1D2D50] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 md:p-10 fade-up" key={step}>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#B83A4B] font-mono mb-3">
          {q.skill_type?.replaceAll("_"," ")}
        </div>
        <h2 className="font-heading text-xl lg:text-2xl text-[#1A1B26] leading-snug whitespace-pre-line">{q.question}</h2>

        <div className="mt-7 space-y-3">
          {q.options.map((opt, i) => {
            const active = selected === i;
            return (
              <button
                key={i}
                data-testid={`quiz-option-${LETTERS[i].toLowerCase()}`}
                onClick={() => pick(i)}
                className={`w-full text-left flex items-start gap-4 px-5 py-4 rounded-lg border transition-all duration-200 ${
                  active
                    ? "border-[#1D2D50] bg-[#1D2D50] text-white"
                    : "border-[#E2E0D8] bg-white text-[#1A1B26] hover:border-[#1D2D50]/40 hover:bg-[#F8F6F0]"
                }`}
              >
                <span className={`font-mono text-xs mt-0.5 ${active ? "text-[#E5A93C]" : "text-[#A0A2B1]"}`}>{LETTERS[i]}</span>
                <span className="text-sm leading-relaxed">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        {step < total - 1 ? (
          <Button data-testid="quiz-next" onClick={next} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-6 rounded-md">
            Soal Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button data-testid="quiz-submit" onClick={submit} disabled={submitting} className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white h-11 px-6 rounded-md">
            {submitting ? "Menilai dengan AI…" : "Kumpulkan Jawaban"}
          </Button>
        )}
      </div>
    </div>
  );
}
