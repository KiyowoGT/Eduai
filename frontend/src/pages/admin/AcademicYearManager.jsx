import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAdminAcademicYears, http } from "@/lib/api";
import { Calendar, Plus, CheckCircle, Archive, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import DualLoader from "@/components/DualLoader";

export default function AcademicYearManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newYear, setNewYear] = useState({ name: "", start_date: "", end_date: "" });
  const [creating, setCreating] = useState(false);

  const loadYears = async () => {
    try {
      const data = await getAdminAcademicYears();
      setYears(data || []);
    } catch {
      setYears([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYears();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newYear.name || !newYear.start_date || !newYear.end_date) {
      toast.error("Semua field wajib diisi");
      return;
    }
    setCreating(true);
    try {
      await http.post("/admin/academic-years", newYear);
      toast.success(`Tahun ajaran ${newYear.name} dibuat`);
      setShowCreate(false);
      setNewYear({ name: "", start_date: "", end_date: "" });
      loadYears();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal membuat tahun ajaran");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (yearId, name) => {
    setActivating(yearId);
    try {
      await http.post(`/admin/academic-years/${yearId}/activate`);
      toast.success(`Tahun ajaran ${name} diaktifkan — cascade berjalan`);
      loadYears();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengaktifkan");
    } finally {
      setActivating(null);
    }
  };

  const statusBadge = (year) => {
    if (year.is_active) return { label: "Aktif", class: "bg-[#2D6A4F]/10 text-[#2D6A4F]" };
    if (year.is_archived) return { label: "Diarsipkan", class: "bg-[#A0A2B1]/10 text-[#646675]" };
    return { label: "Draft", class: "bg-[#E5A93C]/10 text-[#E5A93C]" };
  };

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Siklus Akademik</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Tahun Ajaran</h1>
        <p className="text-sm text-[#646675] mt-1.5">{user?.institution}</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-[#646675]">{years.length} tahun ajaran</div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Buat Tahun Ajaran
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-6 space-y-4 fade-up">
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Nama Tahun Ajaran</label>
            <input
              type="text"
              value={newYear.name}
              onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
              placeholder="2025/2026"
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Tanggal Mulai</label>
              <input
                type="date"
                value={newYear.start_date}
                onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Tanggal Akhir</label>
              <input
                type="date"
                value={newYear.end_date}
                onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm text-[#646675] hover:text-[#1A1B26] transition-colors">
              Batal
            </button>
            <button type="submit" disabled={creating} className="px-5 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors disabled:opacity-50">
              {creating ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

      {/* Year List */}
      {loading ? (
        <DualLoader type="default" text="Memuat daftar tahun ajaran..." />
      ) : years.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          Belum ada tahun ajaran. Buat tahun ajaran baru untuk memulai.
        </div>
      ) : (
        <div className="space-y-4">
          {years.map((year) => {
            const badge = statusBadge(year);
            return (
              <div key={year.academic_year_id || year._id} className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${
                    year.is_active ? "bg-[#2D6A4F]/10" : year.is_archived ? "bg-[#A0A2B1]/10" : "bg-[#E5A93C]/10"
                  } grid place-items-center`}>
                    <Calendar className={`w-5 h-5 ${
                      year.is_active ? "text-[#2D6A4F]" : year.is_archived ? "text-[#646675]" : "text-[#E5A93C]"
                    }`} />
                  </div>
                  <div>
                    <div className="font-heading text-lg text-[#1A1B26]">{year.name}</div>
                    <div className="text-xs text-[#646675] mt-0.5">
                      {year.start_date && new Date(year.start_date).toLocaleDateString("id-ID")}
                      {year.start_date && year.end_date && " — "}
                      {year.end_date && new Date(year.end_date).toLocaleDateString("id-ID")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.class}`}>{badge.label}</span>
                  {!year.is_active && !year.is_archived && (
                    <button
                      onClick={() => handleActivate(year.academic_year_id || year._id, year.name)}
                      disabled={activating === (year.academic_year_id || year._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2D6A4F] text-white text-xs rounded-lg hover:bg-[#2D6A4F]/90 transition-colors disabled:opacity-50"
                    >
                      {activating === (year.academic_year_id || year._id) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Aktifkan
                    </button>
                  )}
                  {year.is_active && (
                    <button
                      onClick={() => navigate(`/admin/academic-years/${year.academic_year_id || year._id}/promotions`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#1D2D50] border border-[#1D2D50]/20 rounded-lg hover:bg-[#F8F6F0] transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      Override Promosi
                    </button>
                  )}
                  {year.is_archived && (
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#646675] border border-[#E2E0D8] rounded-lg cursor-default">
                      <Archive className="w-3 h-3" />
                      Arsip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
