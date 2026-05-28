import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPribadiStudentsAnalysis, analyzeStudentCharacter, getTeacherDashboard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Search, X, ChevronRight, Brain, Sparkles, Clock, BookOpen, Target, ArrowUp, ArrowDown, Minus } from "lucide-react";

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
      <div className={`inline-flex w-8 h-8 rounded-md border items-center justify-center ${accent ? "bg-[#1D2D50] border-[#1D2D50]" : "bg-[#F8F6F0] border-[#E2E0D8]"}`}>
        <Icon className={`w-4 h-4 ${accent ? "text-[#E5A93C]" : "text-[#1D2D50]"}`} />
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">{label}</div>
      <div className={`font-heading text-3xl mt-1 ${accent ? "text-[#E5A93C]" : "text-[#1A1B26]"}`}>{value ?? 0}</div>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (!trend) return null;
  const isUp = trend === "meningkat";
  const isDown = trend === "menurun";
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const cls = isUp ? "text-[#2D6A4F] bg-[#2D6A4F]/10" : isDown ? "text-[#B83A4B] bg-[#B83A4B]/10" : "text-[#A0A2B1] bg-[#A0A2B1]/10";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" /> {trend}
    </span>
  );
}

function SkillBar({ label, percentage }) {
  const color = percentage >= 70 ? "bg-[#2D6A4F]" : percentage >= 50 ? "bg-[#E5A93C]" : "bg-[#B83A4B]";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#646675] w-32 shrink-0 truncate">{label.replaceAll("_", " ")}</span>
      <div className="flex-1 h-2 bg-[#F8F6F0] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs font-mono text-[#646675] w-10 text-right">{percentage}%</span>
    </div>
  );
}

export default function AnalyticsMandiri() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [metrics, setMetrics] = useState({ student_count: 0, quizzes_count: 0, average_score: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedSkillStudent, setSelectedSkillStudent] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, dashRes] = await Promise.all([
        getPribadiStudentsAnalysis().catch(() => ({ students: [] })),
        getTeacherDashboard().catch(() => null),
      ]);
      setStudents(studentsRes.students || []);
      if (dashRes?.metrics) {
        setMetrics(dashRes.metrics);
      } else {
        const s = studentsRes.students || [];
        setMetrics({
          student_count: s.length,
          quizzes_count: s.reduce((sum, st) => sum + (st.quiz_count || 0), 0),
          average_score: s.length > 0 ? Math.round(s.reduce((sum, st) => sum + (st.overall_average || 0), 0) / s.length) : 0,
        });
      }
    } catch { console.error("load failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openDetail = async (student) => {
    setSelectedStudent(student);
    setAiAnalysis(null);
    setAnalyzing(true);
    try {
      const res = await analyzeStudentCharacter(student.user_id);
      setAiAnalysis(res);
    } catch { setAiAnalysis({ analysis: "Gagal memuat analisis.", summary: "" }); }
    finally { setAnalyzing(false); }
  };

  const filtered = students.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center py-20 text-[#646675]">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#1D2D50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Menganalisis data pelajar…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full fade-up">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Analisis Guru Mandiri</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Analisis Pelajar</h1>
        <p className="text-sm text-[#646675] mt-1.5">Perkembangan, karakter, dan performa belajar pelajar Anda.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard icon={Users} label="Total Pelajar" value={metrics.student_count} />
        <StatCard icon={BarChart3} label="Total Kuis" value={metrics.quizzes_count} />
        <StatCard icon={TrendingUp} label="Rata-rata Skor" value={`${metrics.average_score ?? 0}%`} accent />
      </div>

      {students.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-[#A0A2B1] mx-auto mb-3" />
          <div className="text-sm text-[#646675]">Belum ada pelajar yang terdaftar. Bagikan token kelas untuk mulai.</div>
        </div>
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari pelajar…"
              className="w-full pl-9 pr-4 py-2.5 border border-[#E2E0D8] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 focus:border-[#1D2D50] bg-white text-[#1A1B26] placeholder:text-[#A0A2B1]"
            />
          </div>

          <div className="space-y-3 mb-6">
            {filtered.map(s => (
              <button
                key={s.user_id}
                onClick={() => setSelectedSkillStudent(selectedSkillStudent?.user_id === s.user_id ? null : s)}
                className="w-full text-left bg-white border border-[#E2E0D8] rounded-xl p-5 hover:border-[#1D2D50]/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#1D2D50]/10 grid place-items-center shrink-0">
                      <span className="font-heading text-sm text-[#1D2D50]">{s.name?.[0] || "?"}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-[#1A1B26]">{s.name}</div>
                      <div className="text-[11px] text-[#646675]">{s.email || ""}{s.enrolled_class ? ` · ${s.enrolled_class}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A2B1]">Kuis</div>
                      <div className="text-sm font-medium text-[#1A1B26]">{s.quiz_count}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A2B1]">Rata-rata</div>
                      <div className={`text-sm font-heading ${(s.overall_average || 0) >= 70 ? "text-[#2D6A4F]" : (s.overall_average || 0) >= 50 ? "text-[#E5A93C]" : "text-[#B83A4B]"}`}>
                        {s.overall_average ?? 0}%
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A0A2B1]" />
                  </div>
                </div>

                {/* Expanded skill breakdown */}
                {selectedSkillStudent?.user_id === s.user_id && (
                  <div className="mt-4 pt-4 border-t border-[#E2E0D8]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-[0.15em] text-[#A0A2B1]">Breakdown Skill</span>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openDetail(s); }}
                        className="bg-[#1D2D50] hover:bg-[#15223E] text-white text-xs h-8"
                      >
                        <Brain className="w-3.5 h-3.5 mr-1" /> Analisis AI
                      </Button>
                    </div>
                    {Object.keys(s.skill_breakdown || {}).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(s.skill_breakdown).map(([sk, st]) => (
                          <SkillBar key={sk} label={sk} percentage={st.percentage} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[#A0A2B1]">Belum ada data skill.</div>
                    )}

                    {s.score_history?.length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs uppercase tracking-[0.15em] text-[#A0A2B1]">Riwayat Skor</span>
                        <div className="mt-2 space-y-1.5">
                          {s.score_history.slice(0, 10).map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-[#646675] truncate">{h.quiz_title}</span>
                              <span className={`font-mono ${h.score >= 70 ? "text-[#2D6A4F]" : h.score >= 50 ? "text-[#E5A93C]" : "text-[#B83A4B]"}`}>
                                {h.score}/100
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* AI Analysis Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-heading text-xl text-[#1A1B26]">{selectedStudent.name}</h2>
                <p className="text-xs text-[#646675]">{selectedStudent.email}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="w-8 h-8 rounded-full hover:bg-[#F8F6F0] grid place-items-center">
                <X className="w-4 h-4 text-[#646675]" />
              </button>
            </div>

            {analyzing ? (
              <div className="flex items-center justify-center py-10 text-sm text-[#646675]">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#1D2D50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menganalisis karakter belajar…
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-4">
                {aiAnalysis.summary && (
                  <div className="bg-[#1D2D50]/5 rounded-lg p-4 border border-[#1D2D50]/10">
                    <div className="text-xs uppercase tracking-[0.15em] text-[#A0A2B1] mb-1">Ringkasan</div>
                    <p className="text-sm text-[#1A1B26]">{aiAnalysis.summary}</p>
                  </div>
                )}

                {aiAnalysis.average_score !== undefined && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-[#E2E0D8] rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A2B1]">Total Kuis</div>
                      <div className="font-heading text-xl text-[#1A1B26]">{aiAnalysis.total_quizzes}</div>
                    </div>
                    <div className="bg-white border border-[#E2E0D8] rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A2B1]">Rata-rata</div>
                      <div className="font-heading text-xl text-[#1A1B26]">{aiAnalysis.average_score}%</div>
                    </div>
                  </div>
                )}

                {aiAnalysis.trend && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#A0A2B1]" />
                    <span className="text-xs text-[#646675]">Tren: </span>
                    <TrendBadge trend={aiAnalysis.trend} />
                  </div>
                )}

                {(aiAnalysis.strong_skills?.length > 0 || aiAnalysis.weak_skills?.length > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    {aiAnalysis.strong_skills?.length > 0 && (
                      <div className="bg-[#2D6A4F]/5 border border-[#2D6A4F]/20 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-[#2D6A4F] flex items-center gap-1">
                          <ArrowUp className="w-3 h-3" /> Kekuatan
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {aiAnalysis.strong_skills.map((sk, i) => (
                            <li key={i} className="text-xs text-[#1A1B26]">{sk.replaceAll("_", " ")}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiAnalysis.weak_skills?.length > 0 && (
                      <div className="bg-[#B83A4B]/5 border border-[#B83A4B]/20 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-[#B83A4B] flex items-center gap-1">
                          <ArrowDown className="w-3 h-3" /> Perlu Ditingkatkan
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {aiAnalysis.weak_skills.map((sk, i) => (
                            <li key={i} className="text-xs text-[#1A1B26]">{sk.replaceAll("_", " ")}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {aiAnalysis.analysis && (
                  <div className="bg-[#FFF8E7] border border-[#E5A93C]/30 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-4 h-4 text-[#E5A93C]" />
                      <span className="text-xs uppercase tracking-[0.15em] text-[#E5A93C]">Analisis Karakter AI</span>
                    </div>
                    <p className="text-sm text-[#1A1B26] leading-relaxed whitespace-pre-line">{aiAnalysis.analysis}</p>
                  </div>
                )}

                <Button onClick={() => setSelectedStudent(null)} className="w-full bg-[#1D2D50] hover:bg-[#15223E] text-white">
                  Tutup
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
