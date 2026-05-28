import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getTeacherDashboard, getClassSummary } from "@/lib/api";
import { BarChart3, TrendingUp, Users } from "lucide-react";
import PageSkeleton from "@/components/PageSkeleton";

export default function TeacherAnalytics() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTeacherDashboard().catch(() => null),
      getClassSummary().catch(() => []),
    ]).then(([d, cs]) => {
      setDashboard(d);
      setClassSummary(cs?.students || cs || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton variant="teacher-dashboard" />;

  const metrics = dashboard?.metrics || {};
  const recentQuizzes = dashboard?.recent_quizzes || [];

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Analitik Pengajaran</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Analitik</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · {user?.assigned_class || "Semua kelas"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="inline-flex w-8 h-8 rounded-md bg-[#F8F6F0] border border-[#E2E0D8] items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#1D2D50]" />
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Total Kuis</div>
          <div className="font-heading text-3xl mt-1 text-[#1A1B26]">{metrics.quizzes_count ?? 0}</div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="inline-flex w-8 h-8 rounded-md bg-[#F8F6F0] border border-[#E2E0D8] items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#1D2D50]" />
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Skor Rata-rata</div>
          <div className="font-heading text-3xl mt-1 text-[#1A1B26]">{metrics.average_score ?? 0}%</div>
        </div>
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="inline-flex w-8 h-8 rounded-md bg-[#F8F6F0] border border-[#E2E0D8] items-center justify-center">
            <Users className="w-4 h-4 text-[#1D2D50]" />
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Siswa</div>
          <div className="font-heading text-3xl mt-1 text-[#1A1B26]">{metrics.student_count ?? 0}</div>
        </div>
      </div>

      {classSummary.length > 0 && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
          <h2 className="font-heading text-xl text-[#1A1B26] mb-4">Ringkasan per Siswa</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E0D8]">
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Siswa</th>
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Kuis</th>
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {classSummary.map((s, i) => (
                  <tr key={s.user_id || i} className="border-b border-[#E2E0D8]/50 last:border-0">
                    <td className="py-3 px-2 text-[#1A1B26] font-medium">{s.name}</td>
                    <td className="py-3 px-2 text-[#646675]">{s.quiz_count ?? 0}</td>
                    <td className="py-3 px-2">
                      <span className="text-[#2D6A4F]">{s.overall_average ?? 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentQuizzes.length > 0 && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <h2 className="font-heading text-xl text-[#1A1B26] mb-4">Kuis Terbaru</h2>
          <div className="space-y-3">
            {recentQuizzes.map((q, i) => (
              <div key={q.quiz_id || i} className="flex items-center justify-between py-2 border-b border-[#E2E0D8]/50 last:border-0">
                <div>
                  <div className="text-sm text-[#1A1B26] font-medium">{q.title}</div>
                  <div className="text-xs text-[#646675]">{q.subject_name} · {q.class_name}</div>
                </div>
                <div className="text-xs text-[#2D6A4F] font-medium">{q.total_submissions} pengumpulan · {q.average_score ?? "-"}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


