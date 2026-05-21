import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { fetchMe } from "@/lib/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      try {
        let session = null;
        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (data?.session) {
            session = data.session;
            break;
          }
          await new Promise(r => setTimeout(r, 500));
        }

        if (!session) {
          throw new Error("Sesi Supabase tidak ditemukan.");
        }

        // Enrich user in backend, then navigate
        const user = await Promise.race([
          fetchMe(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Backend timeout")), 10000)),
        ]);

        const dest = user?.onboarded ? "/dashboard" : "/onboarding";
        navigate(dest, { replace: true });
      } catch (e) {
        setErr(`Gagal: ${e.message || "Unknown error"}`);
        // Fallback: let AuthContext handle it, navigate to onboarding
        setTimeout(() => navigate("/onboarding", { replace: true }), 3000);
      }
    })();
  }, [navigate]);

  return (
    <div data-testid="auth-callback" className="min-h-screen grid place-items-center bg-[#F8F6F0]">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#1D2D50] border-t-transparent animate-spin mx-auto" />
        <p className="font-heading text-lg mt-4 text-[#1A1B26]">Mengamankan sesi…</p>
        {err && <p className="text-sm text-[#B83A4B] mt-2">{err}</p>}
      </div>
    </div>
  );
}
