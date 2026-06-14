import { useState } from "react";
import { Wrench, ShieldAlert, Cpu } from "lucide-react";

export default function MaintenanceMode() {
  const [activeServer, setActiveServer] = useState("Blue (Production)");
  const [loading, setLoading] = useState(false);

  const switchServer = () => {
    setLoading(true);
    setTimeout(() => {
      setActiveServer(activeServer === "Blue (Production)" ? "Green (Staging/Update)" : "Blue (Production)");
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">System Operations</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Maintenance & Deployment</h1>
        <p className="text-sm text-[#646675] mt-1.5">Kontrol status server dan simulasi Blue-Green Deployment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 hover:border-[#1D2D50]/20 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#1D2D50]/10 grid place-items-center">
              <Cpu className="w-4 h-4 text-[#1D2D50]" />
            </div>
            <h3 className="font-heading font-bold text-[#1A1B26] text-lg">Blue-Green Routing</h3>
          </div>
          <div className="mb-4">
            <span className="text-xs text-[#646675]">Server Aktif Saat Ini</span>
            <div className="text-xl font-bold text-[#1D2D50] mt-1 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${activeServer.startsWith("Blue") ? "bg-blue-500" : "bg-green-500"}`} />
              {activeServer}
            </div>
          </div>
          <button
            onClick={switchServer}
            disabled={loading}
            className="w-full py-2.5 bg-[#1D2D50] text-white text-sm font-medium rounded-lg hover:bg-[#1D2D50]/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Mengalihkan Lalu Lintas..." : "Switch Traffic (Simulate Failover)"}
          </button>
        </div>

        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 hover:border-[#1D2D50]/20 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#B83A4B]/10 grid place-items-center">
              <ShieldAlert className="w-4 h-4 text-[#B83A4B]" />
            </div>
            <h3 className="font-heading font-bold text-[#1A1B26] text-lg">System Maintenance Lock</h3>
          </div>
          <p className="text-sm text-[#646675] mb-4">Kunci aplikasi untuk semua pengguna non-admin (menampilkan halaman maintenance).</p>
          <button className="w-full py-2.5 border border-[#B83A4B] text-[#B83A4B] text-sm font-medium rounded-lg hover:bg-[#B83A4B]/5 transition-colors">
            Aktifkan Maintenance Mode (Lock App)
          </button>
        </div>
      </div>
    </div>
  );
}
