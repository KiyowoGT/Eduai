import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  getRedeemQuiz, startRedeemQuiz, submitRedeemQuiz, getRedeemSession,
  listMyRedeemSessions, listMyRedeemMaterials, joinClassByToken, listDocuments
} from "@/lib/api";
import { getDocumentStatusClasses, getDocumentStatusMeta } from "@/lib/documentStatus";
import PageSkeleton from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Award, Code,
  FileText, Check, X, BookMarked, GraduationCap, Ticket
} from "lucide-react";

const LETTERS = ["A", "B", "C", "D"];

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PortalMandiri() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("portal");
  const [codeInput, setCodeInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [quizInfo, setQuizInfo] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sessionResult, setSessionResult] = useState(null);
  const [teacherDocs, setTeacherDocs] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingSessionId, setViewingSessionId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    const [matsRes, sessRes, docsRes] = await Promise.all([
      listMyRedeemMaterials().catch(() => ({ materials: [] })),
      listMyRedeemSessions().catch(() => ({ sessions: [] })),
      listDocuments().catch(() => []),
    ]);

    let merged = (matsRes.materials || []).filter(d => d.status !== "deleted");
    const seen = new Set(merged.map(d => d.document_id));
    for (const d of (docsRes || [])) {
      if (d.user_id === user?.user_id) continue;
      if (d.status !== "processing" && d.status !== "deleted" && !seen.has(d.document_id)) {
        seen.add(d.document_id);
        merged.push(d);
      }
    }

    setTeacherDocs(merged);
    setMySessions(sessRes.sessions || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleRedeemCode = async () => {
    const code = codeInput.trim();
    if (!code) { toast.error("Masukkan kode redeem"); return; }
    setValidating(true);
    try {
      const info = await getRedeemQuiz(code);
      setQuizInfo(info);
      setAnswers(new Array(info.questions.length).fill(undefined));
      setStep(0);
      setMode("quiz_info");
    } catch (e) {
      try {
        await joinClassByToken(code);
        toast.success("Berhasil bergabung ke kelas! Silakan refresh.");
        setCodeInput("");
        refresh();
      } catch (e2) {
        toast.error(e2?.response?.data?.detail || "Kode tidak valid");
      }
    }
    finally { setValidating(false); }
  };

  const handleStartQuiz = async () => {
    try {
      const res = await startRedeemQuiz(quizInfo.code);
      setSessionToken(res.session_token);
      setSessionId(res.session_id);
      setMode("taking_quiz");
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal memulai kuis"); }
  };

  const pick = (i) => {
    const next = [...answers]; next[step] = i; setAnswers(next);
  };

  const handleSubmit = async () => {
    if (answers[step] === undefined) { toast.error("Pilih jawaban dulu"); return; }
    setSubmitting(true);
    try {
      const finalAnswers = answers.map(a => a === undefined ? -1 : a);
      const subRes = await submitRedeemQuiz(quizInfo.code, sessionToken, finalAnswers, user?.name || "Student");
      toast.info("AI menilai dengan deep feedback…");
      let attempts = 0;
      const poll = async () => {
        const session = await getRedeemSession(subRes.session_id);
        if (session.status === "ready" || session.status === "failed") {
          setSessionResult(session);
          setMode("quiz_result");
          refresh();
          return;
        }
        if (attempts++ > 60) { toast.error("Waktu tunggu habis"); setMode("portal"); return; }
        await new Promise(r => setTimeout(r, 2000));
        return poll();
      };
      await poll();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal mengirim jawaban"); setMode("quiz_info"); }
    finally { setSubmitting(false); }
  };

  const backToPortal = () => {
    setMode("portal");
    setQuizInfo(null);
    setSessionToken(null);
    setSessionId(null);
    setAnswers([]);
    setSessionResult(null);
    setViewingSessionId(null);
  };

  const viewSession = async (sid) => {
    try {
      const s = await getRedeemSession(sid);
      setSessionResult(s);
      setViewingSessionId(sid);
      setMode("quiz_result");
    } catch { toast.error("Gagal memuat hasil"); }
  };

  if (mode !== "portal") {
    return (
      <div className="w-full">
        {mode !== "taking_quiz" && (
          <button onClick={backToPortal} className="inline-flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Portal
          </button>
        )}

        {mode === "quiz_info" && quizInfo && (
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 fade-up">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-4">
              <Code className="w-3.5 h-3.5" /> Kode: {quizInfo.code}
            </div>
            <h2 className="font-heading text-2xl text-[#1A1B26]">{quizInfo.title}</h2>
            {quizInfo.subject_name && (
              <p className="text-sm text-[#646675] mt-1">Mata Pelajaran: {quizInfo.subject_name}</p>
            )}
            <p className="text-sm text-[#646675] mt-1">{quizInfo.questions.length} Soal</p>
            <Button onClick={handleStartQuiz} className="mt-6 bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-8 rounded-md">
              Mulai Kuis <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {mode === "taking_quiz" && quizInfo && (
          <QuizTakeView
            questions={quizInfo.questions}
            step={step} setStep={setStep}
            answers={answers} pick={pick}
            submitting={submitting} onSubmit={handleSubmit}
            total={quizInfo.questions.length}
          />
        )}

        {mode === "quiz_result" && sessionResult && (
          <QuizResultView session={sessionResult} onBack={backToPortal} />
        )}
      </div>
    );
  }

  if (loading) return <PageSkeleton variant="dashboard" />;

  return (
    <div className="w-full fade-up">
        <>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-6 h-6 text-[#1D2D50]" />
              <h1 className="font-heading text-2xl text-[#1A1B26]">Portal Belajar Mandiri</h1>
            </div>
            <p className="text-sm text-[#646675]">
              Redem kode untuk akses materi dan kuis dari pengajar.
            </p>
          </div>

          <JoinedClassBanner user={user} />

          <RedeemCodeSection
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            validating={validating}
            onRedeem={handleRedeemCode}
          />

          <DocumentsSection docs={teacherDocs} loading={loading} navigate={navigate} />

          <QuizResultsSection
            sessions={mySessions}
            loading={loading}
            onViewSession={viewSession}
            navigate={navigate}
          />
        </>
    </div>
  );
}

function RedeemCodeSection({ codeInput, setCodeInput, validating, onRedeem }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="w-5 h-5 text-[#1D2D50]" />
        <h2 className="font-heading text-lg text-[#1A1B26]">Redem Kode Kuis</h2>
      </div>
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6">
        <p className="text-sm text-[#646675] mb-4">Masukkan kode redeem dari pengajar mandiri untuk mengakses kuis.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && onRedeem()}
            placeholder="Contoh: MAT-LES-X7K2"
            className="w-full sm:flex-1 px-4 py-2.5 border border-[#E2E0D8] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 focus:border-[#1D2D50] bg-white text-[#1A1B26] placeholder:text-[#A0A2B1] uppercase tracking-wider"
          />
          <Button
            onClick={onRedeem}
            disabled={validating}
            className="w-full sm:w-auto bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-6 rounded-md shrink-0"
          >
            {validating ? "Memvalidasi…" : "Redem"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function JoinedClassBanner({ user }) {
  if (!user?.class_token_used) return null;
  return (
    <section className="mb-6">
      <div className="bg-[#F8F6F0] border border-[#E2E0D8] rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#E5A93C]/15 grid place-items-center shrink-0">
          <GraduationCap className="w-5 h-5 text-[#E5A93C]" />
        </div>
        <div className="text-sm">
          <div className="text-[#646675]">
            <span className="text-[#A0A2B1]">Kode: </span>
            <span className="font-mono font-semibold text-[#1A1B26]">{user.class_token_used}</span>
          </div>
          {user.enrolled_class && (
            <div className="text-[#A0A2B1] text-xs mt-0.5">
              Kelas: {user.enrolled_class}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DocumentsSection({ docs, loading, navigate, onCancel }) {
  const grouped = {};
  for (const doc of docs) {
    const key = doc.redeem_code || doc.quiz_title || "Lainnya";
    if (!grouped[key]) grouped[key] = { code: doc.redeem_code, title: doc.quiz_title, docs: [] };
    grouped[key].docs.push(doc);
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-[#1D2D50]" />
        <h2 className="font-heading text-lg text-[#1A1B26]">Materi</h2>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-[#646675]">Memuat materi…</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 text-sm text-[#A0A2B1]">
          Redem kode atau gabung kelas dari pengajar untuk melihat materi di sini.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] uppercase tracking-[0.15em] text-[#A0A2B1] font-mono">
                  {group.code || group.title}
                </span>
              </div>
              <div className="space-y-3">
                {group.docs.map((doc) => {
                  const statusMeta = getDocumentStatusMeta(doc);
                  const isProc = doc.status === "processing";
                  return (
                    <div key={doc.document_id} className="relative group">
                      <button
                        onClick={() => navigate(`/dokumen/${doc.document_id}`)}
                        className="w-full text-left bg-white border border-[#E2E0D8] rounded-xl p-5 hover:border-[#1D2D50]/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#1D2D50]/10 grid place-items-center shrink-0">
                            {isProc ? (
                              <Loader2 className="w-4 h-4 text-[#1D2D50] animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4 text-[#1D2D50]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-[#1A1B26] truncate">{doc.title || doc.filename}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${getDocumentStatusClasses(statusMeta.tone)}`}>
                                {statusMeta.chip}
                              </span>
                            </div>
                            {doc.subject_name && <span className="text-[11px] text-[#646675]">{doc.subject_name}</span>}
                            <p className="text-xs text-[#646675] mt-2 line-clamp-2">
                              {doc.status === "ready" ? (doc.summary || "Analisis selesai.") : statusMeta.detail}
                            </p>
                          </div>
                        </div>
                      </button>
                      
                      {isProc && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel(doc.document_id);
                          }}
                          className="absolute top-4 right-4 h-8 px-2 text-[#B83A4B] hover:bg-[#B83A4B]/5"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Batal
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function QuizResultsSection({ sessions, loading, onViewSession }) {
  const ready = sessions.filter(s => s.status === "ready");
  const other = sessions.filter(s => s.status !== "ready");
  const ordered = [...ready, ...other];

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-[#1D2D50]" />
        <h2 className="font-heading text-lg text-[#1A1B26]">Hasil Kuis Redem</h2>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-[#646675]">Memuat hasil…</div>
      ) : ordered.length === 0 ? (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 text-sm text-[#A0A2B1]">Belum ada hasil kuis. Redem kode untuk mulai.</div>
      ) : (
        <div className="space-y-3">
          {ordered.map(s => (
            <button
              key={s.session_id}
              onClick={() => s.status === "ready" && onViewSession(s.session_id)}
              disabled={s.status !== "ready"}
              className={`w-full text-left bg-white border border-[#E2E0D8] rounded-xl p-5 transition-colors ${
                s.status === "ready" ? "hover:border-[#1D2D50]/40 cursor-pointer" : "opacity-60 cursor-default"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                    s.status === "ready" ? "bg-[#2D6A4F]/10" : "bg-[#A0A2B1]/10"
                  }`}>
                    <Award className={`w-4 h-4 ${s.status === "ready" ? "text-[#2D6A4F]" : "text-[#A0A2B1]"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-[#1A1B26] truncate">{s.quiz_title || "Kuis Mandiri"}</div>
                    <div className="text-[11px] text-[#646675]">{s.subject_name || ""}{s.submitted_at ? ` · ${fmt(s.submitted_at)}` : ""}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {s.status === "ready" ? (
                    <span className="font-heading text-xl text-[#2D6A4F]">{s.score}<span className="text-sm text-[#A0A2B1]">/100</span></span>
                  ) : s.status === "processing" ? (
                    <span className="text-xs text-[#E5A93C]">Dinilai…</span>
                  ) : s.status === "failed" ? (
                    <span className="text-xs text-[#B83A4B]">Gagal</span>
                  ) : (
                    <span className="text-xs text-[#A0A2B1]">{s.status}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function QuizTakeView({ questions, step, setStep, answers, pick, submitting, onSubmit, total }) {
  const q = questions[step];
  const selected = answers[step];
  const progress = ((step + 1) / total) * 100;

  const next = () => {
    if (selected === undefined) { toast.error("Pilih jawaban dulu"); return; }
    if (step < total - 1) setStep(step + 1);
  };

  const prev = () => { if (step > 0) setStep(step - 1); };

  return (
    <div className="w-full fade-up">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Kuis Redem</span>
        <span className="font-mono text-sm text-[#1D2D50]">{step + 1} / {total}</span>
      </div>
      <div className="h-1 bg-[#E2E0D8] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-[#1D2D50] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 md:p-10 fade-up" key={step}>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#B83A4B] font-mono mb-3">
          {q.skill_type?.replaceAll("_", " ")}
        </div>
        <h2 className="font-heading text-xl lg:text-2xl text-[#1A1B26] leading-snug whitespace-pre-line">{q.question}</h2>

        <div className="mt-7 space-y-3">
          {q.options.map((opt, i) => {
            const active = selected === i;
            return (
              <button
                key={i}
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
            <Button onClick={prev} variant="outline" disabled={submitting}
              className="border-[#E2E0D8] text-[#646675] h-11 px-6 rounded-md">
              <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
            </Button>
          )}
        </div>
        <div>
          {step < total - 1 ? (
            <Button onClick={next} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-6 rounded-md">
              Soal Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={submitting}
              className="bg-[#B83A4B] hover:bg-[#9c2f3d] text-white h-11 px-6 rounded-md">
              {submitting ? "Menilai dengan AI…" : "Kumpulkan Jawaban"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizResultView({ session, onBack }) {
  const score = session.score || 0;
  const scoreClass = score >= 80 ? "text-[#2D6A4F]" : score >= 60 ? "text-[#E5A93C]" : "text-[#B83A4B]";

  if (session.status === "failed") {
    return (
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 text-center">
        <div className="text-lg font-heading text-[#B83A4B] mb-2">Penilaian Gagal</div>
        <p className="text-sm text-[#646675]">{session.error || "Terjadi kesalahan saat menilai jawaban."}</p>
        <Button onClick={onBack} className="mt-4 bg-[#1D2D50] text-white">Kembali</Button>
      </div>
    );
  }

  return (
    <div className="w-full fade-up">
      <div className="grid md:grid-cols-12 gap-6 mb-8">
        <div className="md:col-span-4 bg-white border border-[#E2E0D8] rounded-xl p-7">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Skor Akhir</div>
          <div className={`font-heading text-6xl mt-3 ${scoreClass}`}>{score}<span className="text-2xl text-[#A0A2B1]">/100</span></div>
        </div>
        <div className="md:col-span-8 bg-[#1D2D50] text-white rounded-xl p-7">
          <div className="text-xs uppercase tracking-[0.2em] text-[#E5A93C]">Ringkasan AI</div>
          <p className="font-heading text-xl lg:text-2xl mt-2 leading-snug">{session.summary || "Ringkasan sedang diproses."}</p>
        </div>
      </div>

      {session.questions && session.questions.length > 0 && (
        <>
          <h2 className="font-heading text-2xl text-[#1A1B26] mb-5">Deep Feedback</h2>
          <div className="space-y-5">
            {session.questions.map((q, i) => (
              <div key={i} className="bg-white border border-[#E2E0D8] rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${q.is_correct ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : "bg-[#B83A4B]/10 text-[#B83A4B]"}`}>
                    {q.is_correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-1">Soal {i + 1}</div>
                    <p className="font-heading text-lg text-[#1A1B26] leading-snug">{q.question}</p>
                    <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="px-3 py-2 rounded-md bg-[#F8F6F0] border border-[#E2E0D8]">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1]">Jawaban Lu</div>
                        <div className={`mt-1 ${q.is_correct ? "text-[#2D6A4F]" : "text-[#B83A4B]"}`}>
                          {q.user_answer_index >= 0 ? (LETTERS[q.user_answer_index] + ". " + (q.options?.[q.user_answer_index] || "")) : "—"}
                        </div>
                      </div>
                      <div className="px-3 py-2 rounded-md bg-[#F8F6F0] border border-[#E2E0D8]">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1]">Jawaban Benar</div>
                        <div className="mt-1 text-[#2D6A4F]">
                          {q.correct_index >= 0 ? (LETTERS[q.correct_index] + ". " + (q.options?.[q.correct_index] || "")) : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-[#1A1B26] leading-relaxed whitespace-pre-line">{q.explanation}</div>
                    {q.references?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#E2E0D8]">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-1.5 mb-2">
                          <BookMarked className="w-3 h-3" /> Referensi Akademik
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#646675]">
                          {q.references.map((r, j) => (
                            <li key={j} className="flex gap-2"><span className="font-mono text-[#B83A4B]">[{j + 1}]</span><span>{r}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <Button onClick={onBack} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-6 rounded-md">
          Kembali ke Portal
        </Button>
      </div>
    </div>
  );
}

export default PortalMandiri;
