import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAdminAcademicSummary } from "@/lib/api";
import { Calendar, BarChart3, Users, BookOpen } from "lucide-react";
import DualLoader from "@/components/DualLoader";

export default function AcademicYearManager() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminAcademicSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DualLoader type="default" text="Memuat siklus akademik..." />;

  const { active_year, groups, total_results } = summary || {};
  const totalStudents = groups?.reduce((a, g) => a + g.student_count, 0) || 0;
  const totalQuizzes = groups?.reduce((a, g) => a + g.quiz_count, 0) || 0;
  const overallAvg = groups?.length
    ? (groups.reduce((a, g) => a + g.avg_score * g.quiz_count, 0) / totalQuizzes).toFixed(1)
    : 0;

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Siklus Akademik</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Tahun Ajaran</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution}
          {active_year && <span className="mx-2">·</span>}
          {active_year && <span className="text-[#2D6A4F] font-medium">{active_year.name}</span>}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-[#1D2D50]/10 grid place-items-center mb-3">
            <Calendar className="w-4 h-4 text-[#1D2D50]" />
          </div>
          <div className="text-2xl font-heading text-[#1A1B26]">{active_year?.name || "-"}</div>
          <div className="text-xs text-[#646675] mt-0.5">Tahun Ajaran Aktif</div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-[#2D6A4F]/10 grid place-items-center mb-3">
            <Users className="w-4 h-4 text-[#2D6A4F]" />
          </div>
          <div className="text-2xl font-heading text-[#1A1B26]">{totalStudents}</div>
          <div className="text-xs text-[#646675] mt-0.5">Siswa Terdaftar</div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-[#E5A93C]/10 grid place-items-center mb-3">
            <BookOpen className="w-4 h-4 text-[#E5A93C]" />
          </div>
          <div className="text-2xl font-heading text-[#1A1B26]">{totalQuizzes}</div>
          <div className="text-xs text-[#646675] mt-0.5">Kuis Dikerjakan</div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-[#B83A4B]/10 grid place-items-center mb-3">
            <BarChart3 className="w-4 h-4 text-[#B83A4B]" />
          </div>
          <div className="text-2xl font-heading text-[#1A1B26]">{overallAvg}</div>
          <div className="text-xs text-[#646675] mt-0.5">Rata-rata Nilai</div>
        </div>
      </div>

      {/* Groups by Grade & Major */}
      {!groups || groups.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center">
          <BarChart3 className="w-8 h-8 text-[#A0A2B1] mx-auto mb-3" />
          Belum ada data nilai. Siswa akan muncul setelah mengerjakan kuis.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={`${g.grade}-${g.major}`} className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E0D8] flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg text-[#1A1B26]">
                    Kelas {g.grade} — {g.major}
                  </h3>
                  <p className="text-xs text-[#646675] mt-0.5">
                    {g.class_names.join(", ")} · {g.student_count} siswa · {g.quiz_count} kuis
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-heading text-[#1D2D50]">{g.avg_score}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#646675]">Rata-rata</div>
                </div>
              </div>
              {g.subjects.length > 0 && (
                <div className="px-5 py-3 bg-[#F8F6F0]/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-[#A0A2B1]">
                        <th className="text-left pb-1.5 font-medium">Mapel</th>
                        <th className="text-center pb-1.5 font-medium">Kuis</th>
                        <th className="text-right pb-1.5 font-medium">Rata-rata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.subjects.map((s) => (
                        <tr key={s.name} className="border-t border-[#E2E0D8]/50">
                          <td className="py-1.5 text-[#1A1B26]">{s.name}</td>
                          <td className="py-1.5 text-center text-[#646675]">{s.quiz_count}</td>
                          <td className="py-1.5 text-right font-medium">{s.avg_score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
