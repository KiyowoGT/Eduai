import { useEffect, useState } from "react";
import { listAuditLogs } from "@/lib/api";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setLogs((await listAuditLogs()) ?? []); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="w-full" data-testid="audit-log-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Riwayat Aktivitas</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Audit Log</h1>
        <p className="text-sm text-[#646675] mt-2">Setiap sesi belajar dan aksi dicatat dengan ID format <span className="font-mono text-[#1D2D50]">AUD-YYYYMMDD-NNNN</span>.</p>
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat…</div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center text-sm text-[#646675]">Belum ada aktivitas tercatat.</div>
      ) : (
        <div className="bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F6F0] border-b border-[#E2E0D8]">
              <tr className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1]">
                <th className="text-left px-5 py-3 font-medium">Log ID</th>
                <th className="text-left px-5 py-3 font-medium">Aksi</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Detail</th>
                <th className="text-left px-5 py-3 font-medium">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.log_id} data-testid="audit-log-row" className="border-b border-[#E2E0D8] last:border-b-0 hover:bg-[#F8F6F0]/50">
                  <td className="px-5 py-3 font-mono text-xs text-[#1D2D50]">{log.log_id}</td>
                  <td className="px-5 py-3 text-[#1A1B26]">{log.action}</td>
                  <td className="px-5 py-3 text-xs text-[#646675] hidden md:table-cell font-mono truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#646675] font-mono">
                    {new Date(log.timestamp).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
