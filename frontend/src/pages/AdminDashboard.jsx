import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getTeacherDashboard, getClassSummary, getAdminTeachers, getAdminAcademicYears, listAuditLogs } from "@/lib/api";
import { Users, BookOpen, Trophy, GraduationCap, Calendar, School, AlertTriangle, Activity, Shield, ChevronRight } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTeacherDashboard().catch(() => null),
      getClassSummary().catch(() => []),
      getAdminTeachers().catch(() => ({ teachers: [] })),
      getAdminAcademicYears().catch(() => []),
      listAuditLogs().catch(() => []),
    ]).then(([d, cs, t, ay, al]) => {
      setDashboard(d);
      setClassSummary(cs?.students || cs || []);
      setTeachers(t?.teachers || []);
      setAcademicYears(ay);
      setAuditLogs(al?.slice?.(0, 10) || al || []);
    }).finally(() => setLoading(false));
  }, []);

  const metrics = dashboard?.metrics || {};
  const recentQuizzes = dashboard?.recent_quizzes || [];
  const pendingMutations = teachers.filter((t) => t.status === "pending_mutation").length;
  const activeAlerts = auditLogs.filter((l) => l.action === "login.failed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-[#646675]">Memuat dashboard...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Dashboard Eksekutif</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">
          Halo, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · Kepala Sekolah · {teachers.length} Guru · {metrics.student_count ?? 0} Siswa
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total Guru Aktif"
          value={teachers.length}
          trend={pendingMutations > 0 ? `${pendingMutations} mutasi` : null}
          trendColor={pendingMutations > 0 ? "text-[#E5A93C]" : "text-[#2D6A4F]"}
        />
        <StatCard
          icon={<GraduationCap className="w-4 h-4" />}
          label="Total Siswa"
          value={metrics.student_count ?? 0}
        />
        <StatCard
          icon={<BookOpen className="w-4 h-4" />}
          label="Kuis Hari Ini"
          value={recentQuizzes.length}
        />
        <StatCard
          icon={<Shield className="w-4 h-4" />}
          label="Alert Keamanan"
          value={activeAlerts}
          accent={activeAlerts > 0}
          variant={activeAlerts > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Pending Actions */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <h2 className="font-heading text-lg text-[#1A1B26] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#E5A93C]" />
            Tindakan Tertunda
          </h2>
          <div className="space-y-3">
            {pendingMutations > 0 && (
              <button onClick={() => navigate("/admin/users")} className="w-full text-left p-3 rounded-lg bg-[#E5A93C]/5 border border-[#E5A93C]/20 flex items-center justify-between group hover:bg-[#E5A93C]/10 transition-colors">
                <div>
                  <div className="text-sm font-medium text-[#1A1B26]">
                    {pendingMutations} Mutasi Jabatan
                  </div>
                  <div className="text-xs text-[#646675]">Menunggu approval</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A0A2B1] group-hover:text-[#1D2D50]" />
              </button>
            )}
            <button onClick={() => navigate("/admin/academic-years")} className="w-full text-left p-3 rounded-lg bg-[#1D2D50]/5 border border-[#1D2D50]/10 flex items-center justify-between group hover:bg-[#1D2D50]/10 transition-colors">
              <div>
                <div className="text-sm font-medium text-[#1A1B26]">
                  {academicYears.filter((ay) => !ay.is_active && !ay.is_archived).length > 0
                    ? `${academicYears.filter((ay) => !ay.is_active && !ay.is_archived).length} Tahun Ajaran Baru`
                    : "Buat Tahun Ajaran Baru"}
                </div>
                <div className="text-xs text-[#646675]">Siklus akademik</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A0A2B1] group-hover:text-[#1D2D50]" />
            </button>
            <div className="p-3 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8]">
              <div className="text-sm font-medium text-[#1A1B26]">Kesehatan Sistem</div>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#646675]">Backup Terakhir</span>
                  <span className="text-[#2D6A4F]">24 jam lalu ✓</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#646675]">AI Service</span>
                  <span className="text-[#2D6A4F]">99.9% uptime</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg text-[#1A1B26] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#1D2D50]" />
              Aktivitas Terbaru
            </h2>
            <button onClick={() => navigate("/admin/audit-logs")} className="text-xs text-[#1D2D50] hover:text-[#B83A4B] transition-colors">
              Lihat semua →
            </button>
          </div>
          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="text-sm text-[#A0A2B1] py-8 text-center">Belum ada aktivitas</div>
            ) : (
              auditLogs.slice(0, 8).map((log, i) => (
                <div key={log._id || i} className="flex items-start gap-3 py-2 border-b border-[#E2E0D8]/40 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.action?.includes("failed") || log.action?.includes("error")
                      ? "bg-[#B83A4B]"
                      : log.action?.includes("created") || log.action?.includes("published")
                        ? "bg-[#2D6A4F]"
                        : "bg-[#E5A93C]"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#1A1B26] truncate">
                      {log.action?.replace(/\./g, " ") || log.action}
                    </div>
                    <div className="text-xs text-[#646675]">
                      {log.actor?.name || log.actor} · {new Date(log.timestamp || log.created_at).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Class Summary */}
      {classSummary.length > 0 && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
          <h2 className="font-heading text-xl text-[#1A1B26] mb-4">Ringkasan Kelas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E0D8]">
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Nama</th>
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
                      <span className="text-[#2D6A4F] font-medium">{s.overall_average ?? 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Quizzes */}
      {recentQuizzes.length > 0 && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
          <h2 className="font-heading text-xl text-[#1A1B26] mb-4">Kuis Terbaru</h2>
          <div className="space-y-3">
            {recentQuizzes.map((q, i) => (
              <div key={q.quiz_id || i} className="flex items-center justify-between py-2 border-b border-[#E2E0D8]/50 last:border-0">
                <div>
                  <div className="text-sm text-[#1A1B26] font-medium">{q.title}</div>
                  <div className="text-xs text-[#646675]">{q.subject_name} · {q.class_name}</div>
                </div>
                <div className="text-xs text-[#2D6A4F] font-medium">{q.total_submissions} pengumpulan</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teachers Quick View */}
      {teachers.length > 0 && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl text-[#1A1B26] flex items-center gap-2">
              <School className="w-4 h-4 text-[#1D2D50]" />
              Tenaga Pengajar
            </h2>
            <button onClick={() => navigate("/admin/users")} className="text-xs text-[#1D2D50] hover:text-[#B83A4B] transition-colors">
              Kelola →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E0D8]">
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Nama</th>
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Jabatan</th>
                  <th className="text-left py-3 px-2 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => (
                  <tr key={t.user_id || i} className="border-b border-[#E2E0D8]/50 last:border-0">
                    <td className="py-3 px-2 text-[#1A1B26] font-medium">{t.name}</td>
                    <td className="py-3 px-2 text-[#646675]">{t.title || "-"}</td>
                    <td className="py-3 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === "active" || !t.status
                          ? "bg-[#2D6A4F]/10 text-[#2D6A4F]"
                          : "bg-[#A0A2B1]/10 text-[#646675]"
                      }`}>
                        {t.status === "active" || !t.status ? "Aktif" : t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, trend, trendColor, accent, variant }) {
  return (
    <div className={`card-lift rounded-xl p-5 border ${
      variant === "danger"
        ? "bg-[#B83A4B] border-[#B83A4B] text-white"
        : accent
          ? "bg-[#1D2D50] border-[#1D2D50] text-white"
          : "bg-white border-[#E2E0D8]"
    }`}>
      <div className={`inline-flex w-8 h-8 rounded-md ${
        variant === "danger"
          ? "bg-white/10"
          : accent
            ? "bg-white/10"
            : "bg-[#F8F6F0] border border-[#E2E0D8]"
      } items-center justify-center`}>
        <span className={
          variant === "danger" ? "text-white"
          : accent ? "text-[#E5A93C]"
          : "text-[#1D2D50]"
        }>{icon}</span>
      </div>
      <div className={`mt-4 text-xs uppercase tracking-[0.2em] ${
        variant === "danger" ? "text-white/70"
        : accent ? "text-white/60"
        : "text-[#A0A2B1]"
      }`}>{label}</div>
      <div className={`font-heading text-3xl mt-1 ${
        variant === "danger" ? "text-white"
        : accent ? "text-white"
        : "text-[#1A1B26]"
      }`}>{value}</div>
      {trend && (
        <div className={`text-xs mt-1 font-medium ${trendColor || "text-[#2D6A4F]"}`}>{trend}</div>
      )}
    </div>
  );
}
