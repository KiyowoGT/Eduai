import { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle, Plus, RefreshCw } from "lucide-react";
import { http } from "@/lib/api";

const SEV_OPTIONS = ["High", "Medium", "Low"];
const STATUS_OPTIONS = ["Open", "In Progress", "Fixed"];

const sevColor = (s) =>
  s === "High"
    ? "bg-[#B83A4B]/10 text-[#B83A4B]"
    : s === "Medium"
    ? "bg-[#E5A93C]/10 text-[#E5A93C]"
    : "bg-[#2D6A4F]/10 text-[#2D6A4F]";

const statusColor = (s) =>
  s === "Fixed"
    ? "text-[#2D6A4F]"
    : s === "In Progress"
    ? "text-[#E5A93C]"
    : "text-[#646675]";

export default function BugTracker() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", severity: "Medium", status: "Open" });
  const [saving, setSaving] = useState(false);

  const fetchBugs = async () => {
    try {
      setLoading(true);
      const { data } = await http.get("/admin/bugs");
      setBugs(data);
    } catch (e) {
      console.error("Gagal fetch bugs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const handleUpdateStatus = async (bugId, newStatus) => {
    try {
      await http.patch(`/admin/bugs/${bugId}`, { status: newStatus });
      setBugs(prev =>
        prev.map(b => b.id === bugId ? { ...b, status: newStatus } : b)
      );
    } catch (e) {
      console.error("Gagal update status:", e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const { data } = await http.post("/admin/bugs", form);
      setBugs(prev => [data, ...prev]);
      setForm({ title: "", severity: "Medium", status: "Open" });
      setShowForm(false);
    } catch (e) {
      console.error("Gagal buat bug:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 fade-up flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">System Operations</div>
          <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Bug Tracker</h1>
          <p className="text-sm text-[#646675] mt-1.5">Pantau masalah & feedback user aplikasi</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={fetchBugs}
            className="p-2 rounded-lg border border-[#E2E0D8] hover:bg-[#F8F6F0] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-[#646675]" />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Laporkan Bug
          </button>
        </div>
      </div>

      {/* Form Tambah Bug */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-5 fade-up space-y-3">
          <div className="text-sm font-medium text-[#1A1B26]">Bug Baru</div>
          <input
            className="w-full border border-[#E2E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D50]"
            placeholder="Deskripsi bug..."
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <div className="flex gap-3">
            <select
              className="border border-[#E2E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D50]"
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
            >
              {SEV_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select
              className="border border-[#E2E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D50]"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto px-4 py-2 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

      {/* List Bugs */}
      {loading ? (
        <div className="text-sm text-[#A0A2B1] text-center py-12">Memuat data...</div>
      ) : bugs.length === 0 ? (
        <div className="text-sm text-[#A0A2B1] text-center py-12 bg-white border border-dashed border-[#E2E0D8] rounded-xl">
          Tidak ada bug yang dilaporkan.
        </div>
      ) : (
        <div className="space-y-3">
          {bugs.map((b) => (
            <div
              key={b.id}
              className="bg-white border border-[#E2E0D8] rounded-xl p-4 flex items-center justify-between hover:border-[#1D2D50]/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#B83A4B]/10 grid place-items-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-[#B83A4B]" />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-[#A0A2B1] uppercase tracking-wider">{b.id}</div>
                  <div className="font-medium text-[#1A1B26] mt-[2px]">{b.title}</div>
                  {b.created_by && (
                    <div className="text-[10px] text-[#A0A2B1] mt-0.5">Dilaporkan: {b.created_by}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${sevColor(b.severity)}`}>
                  {b.severity}
                </span>
                {/* Dropdown update status langsung */}
                <select
                  value={b.status}
                  onChange={e => handleUpdateStatus(b.id, e.target.value)}
                  className={`text-xs font-medium border border-[#E2E0D8] rounded-lg px-2 py-1 focus:outline-none focus:border-[#1D2D50] ${statusColor(b.status)}`}
                >
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
