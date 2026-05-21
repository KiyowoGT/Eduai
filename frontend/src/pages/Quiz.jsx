import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { submitQuiz, getQuizResult, cancelResult, waitForStatus, getQuiz, saveQuizProgress, getQuizProgress } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";

const LETTERS = ["A","B","C","D"];

export default function Quiz() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingResultId, setPendingResultId] = useState(null);
  const [abortCtl, setAbortCtl] = useState(null);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = location.state?.quiz;
      const q = cached || await getQuiz(id).catch(() => null);
      if (cancelled) return;
      if (!q) {
        toast.error("Kuis tidak ditemukan. Mulai dari dokumen lagi.");
        navigate("/dokumen", { replace: true });
        return;
      }
      setQuiz(q);

      try {
        const p = await getQuizProgress(id);
        if (!cancelled && p?.answers) {
          setAnswers(p.answers.map(a => a === -1 ? undefined : a));
          setStep(p.current_step ?? 0);
        }
      } catch {}

      if (!cancelled) setReady(true);
    })();

    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || submitting) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const total = quiz?.questions?.length ?? 0;
        const saveAnswers = Array.from({ length: total }, (_, i) =>
          answers[i] !== undefined ? answers[i] : -1
        );
        await saveQuizProgress(id, saveAnswers, step);
      } catch {}
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [answers, step, ready, submitting, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quiz || !ready) {
    return (
      <div className="w-full" data-testid="quiz-page">
        <div className="flex items-center justify-center py-20 text-[#646675]">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#1D2D50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Memuat kuis…
        </div>
      </div>
    );
  }

  const total = quiz.questions?.length ?? 0;
  const q = quiz.questions[step];
  const selected = answers[step];

  const pick = (i) => {
    const next = [...answers]; next[step] = i; setAnswers(next);
  };

  const next = () => {
    if (selected === undefined) { toast.error("Pilih jawaban dulu"); return; }
    if (step < total - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const submit = async () => {
    if (selected === undefined) { toast.error("Pilih jawaban dulu"); return; }
    setSubmitting(true);
    const ctl = new AbortController();
    setAbortCtl(ctl);
    toast.info("AI menilai dengan deep feedback… ini bisa 30–60 detik.");
    let init;
    try {
      init = await submitQuiz(id, answers);
      setPendingResultId(init.result_id);
      await waitForStatus("quiz_result", init.result_id, { signal: ctl.signal });
      const result = await getQuizResult(init.result_id);
      navigate(`/hasil/${result.result_id}`, { state: { result } });
    } catch (e) {
      if (e.cancelled) toast.info("Penilaian dibatalkan");
      else toast.error(e?.response?.data?.detail || e?.message || "Gagal submit kuis");
    } finally {
      setSubmitting(false);
      setPendingResultId(null);
      setAbortCtl(null);
    }
  };

  const cancelGrading = async () => {
    if (pendingResultId) {
      try { await cancelResult(pendingResultId); } catch {}
    }
    abortCtl?.abort();
  };

  const progress = ((step + 1) / total) * 100;

  return (
    <div className="w-full" data-testid="quiz-page">
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

      <div className="mt-8 flex justify-between gap-3">
        <div>
          {step > 0 && (
            <Button 
              data-testid="quiz-prev" 
              onClick={prev} 
              variant="outline" 
              disabled={submitting}
              className="border-[#E2E0D8] text-[#646675] h-11 px-6 rounded-md"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
            </Button>
          )}
        </div>
        
        <div className="flex gap-3">
          {submitting && (
            <Button data-testid="cancel-submit" onClick={cancelGrading} variant="outline" className="border-[#E2E0D8] text-[#B83A4B] hover:bg-[#B83A4B]/5 h-11 px-4">
              <X className="w-4 h-4 mr-1.5" /> Batal
            </Button>
          )}
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
    </div>
  );
}
