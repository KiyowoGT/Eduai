import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e?.message || "Gagal login Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#E2E0D8] rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1D2D50] grid place-items-center mb-4">
            <GraduationCap className="w-6 h-6 text-[#E5A93C]" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-[#1A1B26]">Log in to EduAI</h1>
          <p className="text-[#646675] mt-2">Selamat datang! Silakan masuk menggunakan akun Google Anda.</p>
        </div>

        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[#1D2D50] hover:bg-[#15223E] text-white h-12 rounded-lg font-medium flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white p-0.5 rounded-full" alt="Google" />
          Masuk dengan Google
        </Button>

        <p className="text-center mt-8 text-xs text-[#A0A2B1]">
          Dengan masuk, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami.
        </p>
      </div>
    </div>
  );
}
