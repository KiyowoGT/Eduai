import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchRoles, switchRole } from "@/lib/api";
import { ChevronDown, RefreshCw } from "lucide-react";

const labelMap = {
  kepala_sekolah: "Kepala Sekolah",
  kurikulum: "Kurikulum",
  guru_kelas: "Guru Kelas",
  guru_pengajar: "Guru Pengajar",
};

export default function ContextSwitcher({ collapsed }) {
  const { user, refresh } = useAuth();
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      const data = await fetchRoles();
      const list = data?.roles || [];
      setRoles(list);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  if (!user || user.role !== "pengajar") return null;

  const currentTitle = user.title;
  const availableRoles = roles.filter((r) => r.role_type !== currentTitle);
  if (availableRoles.length === 0) return null;

  const handleSwitch = async (title) => {
    setSwitching(true);
    try {
      await switchRole(title);
      await refresh();
      setOpen(false);
    } catch {
      // silent
    } finally {
      setSwitching(false);
    }
  };

  if (collapsed) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-center p-2 rounded-md text-[#646675] hover:bg-[#F8F6F0] hover:text-[#1A1B26] transition-colors"
          title="Ganti peran"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-14 bottom-0 bg-white border border-[#E2E0D8] rounded-lg shadow-lg p-1 z-50 min-w-[160px]">
              {availableRoles.map((r) => (
                <button
                  key={r.role_type}
                  onClick={() => handleSwitch(r.role_type)}
                  disabled={switching}
                  className="w-full text-left px-3 py-2 text-sm text-[#1A1B26] hover:bg-[#F8F6F0] rounded-md disabled:opacity-50"
                >
                  {switching ? "..." : labelMap[r.role_type] || r.role_type}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative px-3 py-2 border-t border-[#E2E0D8]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A2B1] mb-1">Akses sebagai</div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-[#1A1B26] hover:bg-[#F8F6F0] transition-colors"
      >
        <span className="font-medium">{labelMap[currentTitle] || currentTitle}</span>
        {switching ? (
          <RefreshCw className="w-3 h-3 animate-spin text-[#646675]" />
        ) : (
          <ChevronDown className="w-3 h-3 text-[#646675]" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 bottom-full mb-1 bg-white border border-[#E2E0D8] rounded-lg shadow-lg p-1 z-50">
            {availableRoles.map((r) => (
              <button
                key={r.role_type}
                onClick={() => handleSwitch(r.role_type)}
                disabled={switching}
                className="w-full text-left px-3 py-2 text-sm text-[#1A1B26] hover:bg-[#F8F6F0] rounded-md disabled:opacity-50"
              >
                {labelMap[r.role_type] || r.role_type}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
