import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { fetchMe } from "@/lib/api";
import { GraduationCap, Sparkles, AlertTriangle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("Menghubungkan ke sistem...");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      try {
        setStatusText("Memverifikasi kredensial...");
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

        setStatusText("Mengunduh data akademis...");
        // Enrich user in backend, then navigate
        const user = await Promise.race([
          fetchMe(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Backend timeout")), 10000)),
        ]);

        setStatusText("Mempersiapkan dashboard...");
        await new Promise(r => setTimeout(r, 800)); // smooth transition feel

        const isOnboarded = user?.onboarded || user?.institution_code || user?.enrolled_class || user?.education_level || user?.role === "pengajar";
        const dest = isOnboarded ? "/dashboard" : "/onboarding";
        navigate(dest, { replace: true });
      } catch (e) {
        setErr(`Gagal: ${e.message || "Unknown error"}`);
        // Fallback: let AuthContext handle it, navigate to onboarding
        setTimeout(() => navigate("/onboarding", { replace: true }), 3500);
      }
    })();
  }, [navigate]);

  return (
    <div data-testid="auth-callback" className="min-h-screen bg-[#F8F6F0] dark:bg-[#12131A] selection:bg-[#E5A93C] selection:text-[#1A1B26] overflow-x-hidden font-body relative transition-colors duration-500 flex items-center justify-center">
      {/* Background Subtle Grain */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] paper-grain z-0" />
      
      {/* Ambient gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#E5A93C]/5 dark:bg-[#E5A93C]/3 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 p-10 rounded-[2.5rem] bg-white/80 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-2xl backdrop-blur-xl max-w-sm w-full text-center transition-all duration-500">
        {!err ? (
          <div className="fade-up">
            <div className="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center">
              {/* Outer rotating dotted ring */}
              <div className="absolute inset-0 rounded-[2rem] border-2 border-dashed border-[#E5A93C]/40 dark:border-[#E5A93C]/30 animate-[spin_15s_linear_infinite]" />
              
              {/* Middle spinning gradient border */}
              <div className="absolute inset-2 rounded-full border-2 border-t-[#E5A93C] border-r-[#1D2D50] border-b-[#B83A4B] border-l-transparent dark:border-r-white/40 animate-[spin_1.5s_linear_infinite]" />
              
              {/* Inner core */}
              <div className="absolute inset-4 rounded-2xl bg-[#1D2D50] dark:bg-[#E5A93C] flex items-center justify-center shadow-lg border border-white/10 overflow-hidden">
                <img src="/img/logo-schooly-owl.png" alt="Schooly AI" className="w-12 h-12 object-contain animate-pulse" />
              </div>
              
              {/* Orbiting badge */}
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E5A93C] dark:bg-[#1D2D50] border-2 border-white dark:border-[#12131A] flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="w-2.5 h-2.5 text-[#1D2D50] dark:text-[#E5A93C]" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-heading text-2xl text-[#1A1B26] dark:text-white tracking-tight">Schooly AI</p>
              <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-[#646675] dark:text-[#A0A2B1] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E5A93C] animate-ping" />
                <span>{statusText}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="fade-up space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[#B83A4B]/10 border border-[#B83A4B]/20 flex items-center justify-center mx-auto shadow-md">
              <AlertTriangle className="w-6 h-6 text-[#B83A4B]" />
            </div>
            <div className="space-y-2">
              <p className="font-heading text-xl text-[#1A1B26] dark:text-white">Otentikasi Gagal</p>
              <p className="text-xs text-[#B83A4B] font-bold bg-[#B83A4B]/5 rounded-lg py-2 px-3">{err}</p>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-[#646675] dark:text-[#A0A2B1] font-black">Mengalihkan secara otomatis...</p>
          </div>
        )}
      </div>
    </div>
  );
}
