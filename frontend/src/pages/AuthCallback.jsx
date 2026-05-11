import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { processSession } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate("/", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const data = await processSession(session_id);
        setUser(data.user);
        window.history.replaceState(null, "", "/dashboard");
        const dest = data.user.onboarded ? "/dashboard" : "/onboarding";
        navigate(dest, { replace: true, state: { user: data.user } });
      } catch (e) {
        setErr("Gagal memproses sesi. Coba lagi.");
        setTimeout(() => navigate("/", { replace: true }), 2000);
      }
    })();
  }, [navigate, setUser]);

  return (
    <div data-testid="auth-callback" className="min-h-screen grid place-items-center bg-[#F8F6F0] paper-grain">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#1D2D50] border-t-transparent animate-spin mx-auto" />
        <p className="font-heading text-lg mt-4 text-[#1A1B26]">Mengamankan sesi…</p>
        {err && <p className="text-sm text-[#B83A4B] mt-2">{err}</p>}
      </div>
    </div>
  );
}
