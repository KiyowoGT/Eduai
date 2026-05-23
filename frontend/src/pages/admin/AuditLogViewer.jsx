import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { listAuditLogs } from "@/lib/api";
import { Search, Download, Shield } from "lucide-react";

export default function AuditLogViewer() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAuditLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const actions = [...new Set(logs.map((l) => l.action).filter(Boolean))];

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    if (q && !JSON.stringify(l).toLowerCase().includes(q)) return false;
    if (actionFilter && l.action !== actionFilter) return false;
    return true;
  });

  const actionColor = (action) => {
    if (!action) return "bg-[#A0A2B1]/10 text-[#646675]";
    if (action.includes("failed") || action.includes("error") || action.includes("violation")) return "bg-[#B83A4B]/10 text-[#B83A4B]";
    if (action.includes("created") || action.includes("published") || action.includes("activated")) return "bg-[#2D6A4F]/10 text-[#2D6A4F]";
    if (action.includes("login") || action.includes("logout")) return "bg-[#1D2D50]/10 text-[#1D2D50]";
    return "bg-[#E5A93C]/10 text-[#E5A93C]";
  };

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Kepatuhan & Keamanan</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Audit Log</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · Log immutable — tidak dapat diedit atau dihapus
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
          <input
            type="text"
            placeholder="Cari target_id, metadata, atau actor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
        >
          <option value="">Semua Aksi</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E0D8] text-sm text-[#646675] rounded-lg hover:bg-[#F8F6F0] transition-colors">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-[#646675]">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          {search || actionFilter ? "Tidak ada log yang cocok dengan filter." : "Belum ada audit log."}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E0D8] bg-[#F8F6F0]">
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Waktu</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Aktor</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Aksi</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">Target</th>
                <th className="text-left py-3 px-4 text-[#A0A2B1] text-xs uppercase tracking-[0.15em] font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={log._id || i} className="border-b border-[#E2E0D8]/50 last:border-0 hover:bg-[#F8F6F0]/50 transition-colors">
                  <td className="py-3 px-4 text-[#646675] text-xs font-mono whitespace-nowrap">
                    {new Date(log.timestamp || log.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-[#1A1B26]">{log.actor?.name || log.actor || "-"}</div>
                    {log.actor?.role && <div className="text-xs text-[#646675]">{log.actor.role}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${actionColor(log.action)}`}>
                      {log.action || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#646675] text-xs">
                    {log.target ? `${log.target.type || "?"}: ${log.target.id || "?"}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-[#646675] text-xs font-mono">{log.ip_address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Immutability Notice */}
      <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-[#B83A4B]/5 border border-[#B83A4B]/10">
        <Shield className="w-5 h-5 text-[#B83A4B] shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-[#B83A4B]">Log Audit Bersifat Immutable</div>
          <div className="text-xs text-[#646675] mt-0.5">
            Semua log audit dicatat secara permanen dan tidak dapat diedit atau dihapus oleh siapapun, termasuk Kepala Sekolah. Setiap perubahan di sistem selalu meninggalkan jejak digital yang tidak bisa diubah.
          </div>
        </div>
      </div>
    </div>
  );
}
