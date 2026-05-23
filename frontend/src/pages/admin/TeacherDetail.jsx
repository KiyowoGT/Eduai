import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { http } from "@/lib/api";
import { ArrowLeft, Mail, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const titleLabels = {
  kepala_sekolah: "Kepala Sekolah",
  kurikulum: "Kurikulum",
  guru_kelas: "Guru Kelas",
  guru_pengajar: "Guru Pengajar",
};

export default function TeacherDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resigning, setResigning] = useState(false);
  const [showResign, setShowResign] = useState(false);

  useEffect(() => {
    http.get(`/admin/users/teachers/${id}`)
      .then((r) => setTeacher(r.data))
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleResign = async () => {
    setResigning(true);
    try {
      await http.post(`/admin/users/${id}/resign`);
      toast.success("Akun guru dinonaktifkan");
      navigate("/admin/users");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menonaktifkan");
    } finally {
      setResigning(false);
      setShowResign(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[#646675]">Memuat...</div>;
  }

  if (!teacher) {
    return (
      <div className="text-sm text-[#B83A4B] bg-white border border-[#E2E0D8] rounded-xl p-8 text-center">
        Guru tidak ditemukan
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      <button
        onClick={() => navigate("/admin/users")}
        className="flex items-center gap-1.5 text-sm text-[#646675] hover:text-[#1D2D50] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      <div className="mb-8 fade-up">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1D2D50] grid place-items-center text-xl font-bold text-[#E5A93C]">
              {teacher.name?.charAt(0) || "?"}
            </div>
            <div>
              <h1 className="font-heading text-3xl text-[#1A1B26]">{teacher.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#1D2D50]/10 text-[#1D2D50]">
                  {titleLabels[teacher.title] || teacher.title || "Guru"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  teacher.status === "active" || !teacher.status
                    ? "bg-[#2D6A4F]/10 text-[#2D6A4F]"
                    : "bg-[#A0A2B1]/10 text-[#646675]"
                }`}>
                  {teacher.status === "active" || !teacher.status ? "Aktif" : teacher.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Informasi Dasar</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#A0A2B1]" />
              <span className="text-sm text-[#646675]">{teacher.email || "-"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#A0A2B1]" />
              <span className="text-sm text-[#646675]">NIP: {teacher.nip || "-"}</span>
            </div>
            {teacher.assigned_class && (
              <div className="text-sm text-[#646675]">Kelas: {teacher.assigned_class}</div>
            )}
            {teacher.assigned_subject && (
              <div className="text-sm text-[#646675]">Mapel: {teacher.assigned_subject}</div>
            )}
          </div>
        </div>

        {teacher.institution && (
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
            <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Institusi</h2>
            <div className="text-sm text-[#646675]">{teacher.institution}</div>
          </div>
        )}
      </div>

      {/* Resign Action */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] mb-4 text-[#B83A4B] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Zone Berbahaya
        </h2>
        <p className="text-sm text-[#646675] mb-4">
          Menonaktifkan akun guru akan mengarsipkan data historis dan membebaskan email institusi untuk digunakan guru baru.
        </p>
        {!showResign ? (
          <button
            onClick={() => setShowResign(true)}
            className="px-4 py-2.5 bg-[#B83A4B] text-white text-sm rounded-lg hover:bg-[#B83A4B]/90 transition-colors"
          >
            Nonaktifkan Akun
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[#B83A4B]/5 border border-[#B83A4B]/20">
              <p className="text-sm text-[#B83A4B]">
                Yakin ingin menonaktifkan <strong>{teacher.name}</strong>?
              </p>
              <p className="text-xs text-[#646675] mt-1">
                Email {teacher.email} akan diarsipkan dan data historis tetap tersimpan sebagai read-only.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowResign(false)}
                className="px-4 py-2.5 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleResign}
                disabled={resigning}
                className="px-4 py-2.5 bg-[#B83A4B] text-white text-sm rounded-lg hover:bg-[#B83A4B]/90 transition-colors disabled:opacity-50"
              >
                {resigning ? "Memproses..." : "Konfirmasi Nonaktifkan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
