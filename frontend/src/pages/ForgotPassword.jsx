import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Masukkan email Anda");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Link reset password telah dikirim ke email Anda");
    } catch (e) {
      toast.error(e?.message || "Gagal mengirim email reset");
    } finally {
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
          <h1 className="font-heading text-2xl font-bold text-[#1A1B26]">Reset Password</h1>
          <p className="text-[#646675] mt-2">
            {sent
              ? "Cek email Anda untuk link reset password."
              : "Masukkan email terdaftar, kami akan kirim link reset."}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1D2D50] hover:bg-[#15223E] text-white h-12 rounded-lg font-medium text-sm shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Kirim Link Reset
            </Button>
          </form>
        ) : (
          <div className="p-4 rounded-lg bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 text-sm text-[#2D6A4F] text-center">
            Link reset telah dikirim ke <strong>{email}</strong>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-1 text-xs text-[#1D2D50] hover:text-[#B83A4B] transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}
