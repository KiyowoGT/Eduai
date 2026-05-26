import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getTeacherQuizResults } from "@/lib/api";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TeacherQuizResults() {
  const { quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    setError("");
    getTeacherQuizResults(quizId)
      .then((res) => setData(res))
      .catch((err) => setError(err.response?.data?.detail || "Gagal memuat data nilai kuis"))
      .finally(() => setLoading(false));
  }, [quizId]);

  const statusIcon = (status) => {
    if (status === "ready") return <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F]" />;
    if (status === "missed") return <XCircle className="w-3.5 h-3.5 text-[#B83A4B]" />;
    return <AlertCircle className="w-3.5 h-3.5 text-[#E5A93C]" />;
  };

  const statusLabel = (status) => {
    if (status === "ready") return "Dikerjakan";
    if (status === "missed") return "Tidak Mengerjakan";
    return "Belum Dikerjakan";
  };

  if (!user || user.role !== "pengajar") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[#646675]">Akses terbatas untuk pengajar.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 fade-up">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-[#646675] hover:text-[#1A1B26] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </button>
        <h1 className="font-heading text-2xl lg:text-3xl text-[#1A1B26]">
          Hasil Kuis
        </h1>
        {data && (
          <p className="text-sm text-[#646675] mt-1">
            {data.title} — {data.subject_name}
            {data.target_classes?.length > 0 && ` — ${data.target_classes.join(", ")}`}
          </p>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#1D2D50]" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-[#A0A2B1]">Total Siswa</div>
              <div className="font-heading text-2xl text-[#1A1B26] mt-1">{data.total_students}</div>
            </div>
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-[#A0A2B1]">Mengerjakan</div>
              <div className="font-heading text-2xl text-[#2D6A4F] mt-1">{data.submitted_count}</div>
            </div>
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-[#A0A2B1]">Tidak Mengerjakan</div>
              <div className="font-heading text-2xl text-[#B83A4B] mt-1">{data.missed_count}</div>
            </div>
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-[#A0A2B1]">Rata-rata</div>
              <div className="font-heading text-2xl text-[#1D2D50] mt-1">{data.average_score}</div>
            </div>
          </div>

          {/* Deadline Info */}
          {data.deadline && (
            <div className="bg-[#FFF8E7] border border-[#E5A93C]/30 text-[#1A1B26] text-xs p-3 rounded-xl mb-6 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#E5A93C]" />
              Batas waktu pengerjaan: {new Date(data.deadline).toLocaleString("id-ID")}
            </div>
          )}

          {/* Student Results Table */}
          <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8F6F0] text-[10px] uppercase tracking-wider text-[#646675]">
                    <th className="text-left px-4 py-3 font-medium">Nama</th>
                    <th className="text-left px-4 py-3 font-medium">Kelas</th>
                    <th className="text-center px-4 py-3 font-medium">Nilai</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Waktu</th>
                    <th className="text-center px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E0D8]/60">
                  {data.students.map((s) => (
                    <tr key={s.user_id} className="hover:bg-[#F8F6F0]/40 transition-colors">
                      <td className="px-4 py-3 text-[#1A1B26] font-medium text-xs">{s.name}</td>
                      <td className="px-4 py-3 text-[10px] text-[#646675]">{s.class || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold ${s.score >= 70 ? "text-[#2D6A4F]" : s.score > 0 ? "text-[#E5A93C]" : "text-[#B83A4B]"}`}>
                          {s.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-[10px]">
                          {statusIcon(s.status)}
                          <span className={
                            s.status === "ready" ? "text-[#2D6A4F]" :
                            s.status === "missed" ? "text-[#B83A4B]" : "text-[#E5A93C]"
                          }>{statusLabel(s.status)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-[#646675]">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.result_id ? (
                          <Button
                            onClick={() => navigate(`/hasil/${s.result_id}`)}
                            size="xs"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-[#1D2D50]/20 text-[#1D2D50]"
                          >
                            Detail
                          </Button>
                        ) : (
                          <span className="text-[10px] text-[#A0A2B1]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.students.length === 0 && (
              <div className="text-center py-12 text-sm text-[#646675]">
                Belum ada data nilai untuk kuis ini.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}