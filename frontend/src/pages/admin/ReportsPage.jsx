import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileSpreadsheet, FileText, Download, Mail, BarChart3, Users, Shield } from "lucide-react";
import { toast } from "sonner";

const REPORT_TYPES = [
  {
    id: "teacher_performance",
    label: "Performa Guru",
    desc: "Rata-rata nilai kuis per guru, jumlah kuis dipublish, engagement siswa",
    icon: Users,
    color: "text-[#1D2D50]",
    bg: "bg-[#1D2D50]/10",
  },
  {
    id: "student_competency",
    label: "Kompetensi Siswa",
    desc: "Distribusi nilai per mata pelajaran, topik lemah secara agregat",
    icon: BarChart3,
    color: "text-[#2D6A4F]",
    bg: "bg-[#2D6A4F]/10",
  },
  {
    id: "security_audit",
    label: "Audit Keamanan",
    desc: "Ringkasan aktivitas login, violation attempts, dan sandbox blocks",
    icon: Shield,
    color: "text-[#B83A4B]",
    bg: "bg-[#B83A4B]/10",
  },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    if (!selectedReport) {
      toast.error("Pilih jenis laporan terlebih dahulu");
      return;
    }
    setExporting(true);
    toast.success(`Mengexport ${selectedReport.label} sebagai ${format.toUpperCase()}...`);
    setTimeout(() => {
      setExporting(false);
      toast.success(`Laporan ${selectedReport.label} siap diunduh`);
    }, 2000);
  };

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Pelaporan & Analitik</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Laporan Institusi</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · Export data untuk rapat, akreditasi, atau evaluasi
        </p>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedReport?.id === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedReport(type)}
              className={`text-left p-5 rounded-xl border transition-all ${
                isSelected
                  ? "border-[#1D2D50] bg-white ring-2 ring-[#1D2D50]/10"
                  : "border-[#E2E0D8] bg-white hover:border-[#1D2D50]/30"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${type.bg} grid place-items-center`}>
                <Icon className={`w-5 h-5 ${type.color}`} />
              </div>
              <div className="font-heading text-lg text-[#1A1B26] mt-3">{type.label}</div>
              <div className="text-xs text-[#646675] mt-1">{type.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Export Actions */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6">
        <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Export Laporan</h2>
        {!selectedReport ? (
          <div className="text-sm text-[#A0A2B1] py-4 text-center">
            Pilih jenis laporan di atas untuk memulai export
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8] mb-5">
              <div className={`w-8 h-8 rounded-lg ${selectedReport.bg} grid place-items-center`}>
                <selectedReport.icon className={`w-4 h-4 ${selectedReport.color}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-[#1A1B26]">{selectedReport.label}</div>
                <div className="text-xs text-[#646675]">{selectedReport.desc}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={() => handleExport("excel")}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2D6A4F] text-white text-sm rounded-lg hover:bg-[#2D6A4F]/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
              <button
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E0D8] text-[#646675] text-sm rounded-lg hover:bg-[#F8F6F0] transition-colors disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                Jadwalkan Email
              </button>
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 rounded-xl bg-[#1D2D50]/5 border border-[#1D2D50]/10 text-xs text-[#646675]">
        <strong className="text-[#1A1B26]">Catatan:</strong> Export maksimal 90 hari data untuk performa. Laporan PDF untuk rapat dewan guru dan akreditasi. Laporan Excel untuk analisis lanjutan.
      </div>
    </div>
  );
}
