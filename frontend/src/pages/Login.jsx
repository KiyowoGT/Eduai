import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Loader2, GraduationCap, Quote, ArrowLeft, Sparkles, ChevronRight, ShieldCheck, User, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveIdentifier } from "@/lib/api";

const LOGIN_IMG = "https://plain-apac-prod-public.komododecks.com/202605/23/CsKoA3Pkqy1TTAAofG8Y/image.png";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e?.message || "Gagal login Google");
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Email/Username dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      let email = identifier;
      try {
        const resolved = await resolveIdentifier(identifier);
        email = resolved.email;
      } catch (err) {}

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/auth/callback", { replace: true });
    } catch (e) {
      toast.error("Email atau password salah");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-10 pl-11 pr-4 rounded-xl border border-[#E2E0D8] dark:border-white/10 bg-white dark:bg-white/5 text-sm dark:text-white transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-[#1D2D50]/5 dark:focus:ring-[#E5A93C]/5 focus:border-[#1D2D50] dark:focus:border-[#E5A93C] placeholder:text-[#D1D1D1] shadow-sm";
  const labelClass = "text-[9px] font-bold uppercase tracking-[0.3em] text-[#1A1B26]/60 dark:text-white/60 ml-1 block mb-1";

  return (
    <div className="h-screen w-full bg-[#F8F6F0] dark:bg-[#12131A] flex selection:bg-[#E5A93C] selection:text-[#1A1B26] overflow-hidden relative font-body transition-colors duration-500">
      {/* Luxurious Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] paper-grain z-0" />

      {/* Main Content Container */}
      <div className="flex w-full h-full relative z-10">
        
        {/* Left Section — Luxurious Form Area */}
        <div className="w-full lg:w-[640px] h-full flex flex-col justify-center p-8 lg:px-16 xl:px-20 bg-[#F8F6F0] dark:bg-[#12131A] border-r border-[#E5A93C]/10 shadow-2xl relative overflow-y-auto order-2 lg:order-1 transition-colors duration-500">
          
          {/* Form Content */}
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-10 text-center lg:text-left">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D2D50] to-[#15223E] shadow-2xl flex items-center justify-center border border-white/10">
                  <GraduationCap className="w-8 h-8 text-[#E5A93C]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-heading text-2xl font-bold tracking-tighter text-[#1A1B26] dark:text-white">Schooly <span className="text-[#B83A4B]">AI</span></span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-[1px] w-3 bg-[#E5A93C]/50" />
                    <span className="text-[9px] uppercase tracking-[0.4em] text-[#E5A93C] font-black">Excellence Tier</span>
                  </div>
                </div>
              </div>
              <h1 className="font-heading text-4xl text-[#1A1B26] dark:text-white tracking-tight leading-none mb-3 italic">Selamat <span className="not-italic font-bold">Datang Kembali.</span></h1>
              <p className="text-[#646675] dark:text-white/60 text-sm font-medium leading-relaxed max-w-[280px]">
                Silakan verifikasi identitas Anda untuk mengakses repositori riset eksklusif.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div className="space-y-1">
                <label className={labelClass}>Email atau Username</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D1D1D1] group-focus-within:text-[#E5A93C] transition-colors duration-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="anda@institusi.ac.id atau username"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className={labelClass}>Kata Sandi</label>
                  <Link to="/forgot-password" size="sm" className="text-[9px] font-bold uppercase tracking-widest text-[#E5A93C] hover:text-[#1D2D50] transition-colors">
                    Lupa Password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D1D1D1] group-focus-within:text-[#E5A93C] transition-colors duration-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`${inputClass} pr-12`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D1D1D1] hover:text-[#E5A93C] transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#1D2D50] dark:bg-[#E5A93C] hover:bg-[#15223E] dark:hover:bg-[#D4AF37] text-white dark:text-[#1D2D50] rounded-xl font-bold uppercase tracking-[0.3em] text-[10px] shadow-[0_20px_40px_-10px_rgba(29,45,80,0.3)] dark:shadow-[0_20px_40px_-10px_rgba(229,169,60,0.2)] transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-4 border border-white/5"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Inisialisasi Sesi <ChevronRight className="w-4 h-4 text-[#E5A93C] dark:text-[#1D2D50]" /></>}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[#E2E0D8] dark:via-white/10 to-transparent"></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase tracking-[0.25em] font-extrabold">
                <span className="bg-[#F8F6F0] dark:bg-[#12131A] px-4 text-[#A0A2B1] dark:text-white/40 transition-colors">Identitas Cloud</span>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 rounded-xl border border-[#E2E0D8] dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1B26] dark:text-white hover:bg-white dark:hover:bg-white/10 hover:border-[#1D2D50] dark:hover:border-[#E5A93C] hover:shadow-md transition-all duration-500 flex items-center justify-center gap-4 active:scale-[0.98] group"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all opacity-70 group-hover:opacity-100" alt="Google" />
              Masuk dengan Google
            </button>
          </div>

          {/* Bottom Link */}
          <div className="pt-10 pb-4 text-center">
            <p className="text-[11px] font-medium text-[#646675] dark:text-white/40 transition-colors">
              Belum memiliki akun?{" "}
              <Link to="/signup" className="font-bold text-[#1D2D50] dark:text-[#E5A93C] hover:text-[#B83A4B] border-b border-[#1D2D50]/20 dark:border-[#E5A93C]/20 hover:border-[#B83A4B] transition-all uppercase tracking-widest text-[9px] ml-1">
                Registrasi
              </Link>
            </p>
          </div>
        </div>

        {/* Right Section — Majestic Atmospheric Sidebar */}
        <div className="hidden lg:flex flex-1 relative bg-[#1D2D50] overflow-hidden h-full order-1 lg:order-2">
          {/* Background Image: High-End Cinematic */}
          <div className="absolute inset-0 z-0 scale-105 transition-transform duration-[20s] ease-out">
            <img 
              src={LOGIN_IMG} 
              alt="Knowledge and Perspective"
              className="w-full h-full object-cover opacity-60 contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1D2D50] via-[#1D2D50]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1D2D50]/20 to-transparent" />
          </div>

          {/* Luxury Accents */}
          <div className="absolute top-12 left-12 z-10">
            <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 text-[9px] font-extrabold uppercase tracking-[0.3em] text-[#E5A93C] shadow-2xl">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E5A93C] animate-pulse shadow-[0_0_8px_#E5A93C]" />
              <span>Pilihan Kurator Akademik</span>
            </div>
          </div>

          <div className="relative z-10 w-full flex flex-col justify-center px-24 xl:px-32">
            <div className="max-w-md">
              <Quote className="w-16 h-16 text-[#E5A93C] opacity-20 mb-10 -ml-2" />
              <blockquote className="font-heading text-5xl xl:text-6xl leading-[1.05] text-white tracking-tight italic mb-12">
                "Pendidikan adalah <span className="text-[#E5A93C] not-italic font-bold">instrumen</span> merevolusi dunia."
              </blockquote>
              
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-[#E5A93C] flex items-center justify-center text-[#1D2D50] text-3xl font-bold shadow-[0_20px_40px_-10px_rgba(229,169,60,0.5)] border-2 border-[#1D2D50]">
                    NM
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#B83A4B] border-2 border-[#1D2D50] flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="text-white font-heading text-2xl leading-none">Nelson Mandela</div>
                  <div className="text-[#E5A93C] text-[10px] uppercase tracking-[0.4em] font-black mt-2 opacity-80">Visionary Leadership</div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Footer */}
          <div className="absolute bottom-12 left-24 right-24 flex items-center justify-between z-10">
            <div className="flex items-center gap-5">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-xl border-2 border-[#1D2D50] bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md shadow-xl" />
                ))}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-tighter">12.4K+</span>
                <span className="text-white/30 text-[8px] uppercase tracking-widest font-black mt-0.5">Active Scholars</span>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-30">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-white">Secure Access</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
