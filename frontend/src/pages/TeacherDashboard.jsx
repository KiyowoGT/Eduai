import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getTeacherDashboard, listTeacherMaterials } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { BookOpen, Trophy, Users, FileText, ArrowUpRight } from "lucide-react";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  const titleLabel = {
    kepala_sekolah: "Kepala Sekolah",
    kurikulum: "Kurikulum",
    guru_kelas: "Guru Kelas",
    guru_pengajar: "Guru Pengajar",
  };

  useEffect(() => {
    Promise.all([
      getTeacherDashboard().catch(() => null),
      listTeacherMaterials().catch(() => []),
    ]).then(([d, m]) => {
      setDashboard(d);
      setMaterials(m);
    }).finally(() => setLoading(false));
  }, []);

  const metrics = dashboard?.metrics || {};
  const recentQuizzes = dashboard?.recent_quizzes || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-[#646675]">Memuat dashboard...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Dashboard Pengajar</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">
          Halo, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution && `${user.institution} · `}
          {titleLabel[user?.title] || user?.title}
          {user?.assigned_class && ` · ${user.assigned_class}`}
          {user?.assigned_subject && ` · ${user.assigned_subject}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Siswa"
          value={metrics.student_count ?? 0}
        />
        <StatCard
          icon={<FileText className="w-4 h-4" />}
          label="Materi"
          value={metrics.materials_count ?? 0}
        />
        <StatCard
          icon={<BookOpen className="w-4 h-4" />}
          label="Kuis"
          value={metrics.quizzes_count ?? 0}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4" />}
          label="Skor Rata-rata"
          value={`${metrics.average_score ?? 0}%`}
          accent
        />
      </div>

      {materials.length > 0 && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl text-[#1A1B26]">Materi Terbaru</h2>
            <button onClick={() => navigate("/dokumen")} className="text-xs text-[#1D2D50] hover:text-[#B83A4B] transition-colors flex items-center gap-1">
              Lihat semua <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {materials.slice(0, 5).map((m, i) => (
              <div
                key={m.document_id || i}
                onClick={() => navigate(`/dokumen/${m.document_id}`)}
                className="flex items-center justify-between py-2 border-b border-[#E2E0D8]/50 last:border-0 cursor-pointer group/item"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8] grid place-items-center group-hover/item:border-[#B83A4B]/50 transition-colors">
                    <FileText className="w-4 h-4 text-[#1D2D50]" />
                  </div>
                  <div>
                    <div className="text-sm text-[#1A1B26] font-medium group-hover/item:text-[#B83A4B] transition-colors">{m.title || m.filename}</div>
                    <div className="text-xs text-[#646675]">{m.subject_name}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  m.status === "published" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : "bg-[#E5A93C]/10 text-[#E5A93C]"
                }`}>
                  {m.status === "published" ? "Terbit" : "Draf"}
                </span>
              </div>
            ))}
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
                <div className="text-xs text-[#2D6A4F] font-medium">{q.total_submissions} pengumpulan</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && materials.length === 0 && recentQuizzes.length === 0 && (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          Dashboard akan terisi setelah Anda membuat materi dan kuis.
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className={`card-lift rounded-xl p-5 border ${accent ? "bg-[#1D2D50] border-[#1D2D50] text-white" : "bg-white border-[#E2E0D8]"}`}>
      <div className={`inline-flex w-8 h-8 rounded-md ${accent ? "bg-white/10" : "bg-[#F8F6F0] border border-[#E2E0D8]"} items-center justify-center`}>
        <span className={accent ? "text-[#E5A93C]" : "text-[#1D2D50]"}>{icon}</span>
      </div>
      <div className={`mt-4 text-xs uppercase tracking-[0.2em] ${accent ? "text-white/60" : "text-[#A0A2B1]"}`}>{label}</div>
      <div className={`font-heading text-3xl mt-1 ${accent ? "text-white" : "text-[#1A1B26]"}`}>{value}</div>
    </div>
  );
}
