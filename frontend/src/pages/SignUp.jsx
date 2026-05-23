import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, Loader2, GraduationCap, Quote, AtSign, Eye, EyeOff, ArrowLeft, Sparkles, CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const SIGNUP_IMG = "https://plain-apac-prod-public.komododecks.com/202605/23/GWGJZJaq4vuc6faCrFLh/image.png";

export default function SignUp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      toast.error(e?.message || "Gagal daftar Google");
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!name || !username || !email || !password || !confirmPassword) {
      toast.error("Semua field wajib diisi");
      return;
    }
    if (password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Password dan verifikasi password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, username, display_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      toast.success("Akun berhasil dibuat! Silakan cek email untuk verifikasi.");
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error(e?.message || "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-10 pl-11 pr-4 rounded-xl border border-[#E2E0D8] bg-white text-sm transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-[#1D2D50]/5 focus:border-[#1D2D50] placeholder:text-[#D1D1D1] shadow-sm";
  const labelClass = "text-[9px] font-bold uppercase tracking-[0.3em] text-[#1A1B26]/60 ml-1 block mb-1";

  return (
    <div className="h-screen w-full bg-[#F8F6F0] flex selection:bg-[#E5A93C] selection:text-[#1A1B26] overflow-hidden relative font-body">
      {/* Luxurious Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] paper-grain z-0" />

      {/* Main Content Container */}
      <div className="flex w-full h-full relative z-10">
        
        {/* Left Section — Majestic Atmospheric Sidebar */}
        <div className="hidden lg:flex flex-1 relative bg-[#1D2D50] overflow-hidden h-full">
          {/* Background Image: High-End Cinematic */}
          <div className="absolute inset-0 z-0 scale-105 transition-transform duration-[20s] ease-out">
            <img 
              src={SIGNUP_IMG} 
              alt="Knowledge and Light"
              className="w-full h-full object-cover opacity-60 contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1D2D50] via-[#1D2D50]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#1D2D50]/20 to-transparent" />
          </div>

          {/* Luxury Accents */}
          <div className="absolute top-12 left-12 z-10">
            <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 text-[9px] font-extrabold uppercase tracking-[0.3em] text-[#E5A93C] shadow-2xl">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E5A93C] animate-pulse shadow-[0_0_8px_#E5A93C]" />
              <span>Pilihan Kurator Akademik</span>
            </div>
          </div>

          <div className="relative z-10 w-full flex flex-col justify-center px-24">
            <div className="max-w-md">
              <Quote className="w-16 h-16 text-[#E5A93C] opacity-20 mb-10 -ml-2" />
              <blockquote className="font-heading text-5xl xl:text-6xl leading-[1.05] text-white tracking-tight italic mb-12">
                "Ilmu pengetahuan <span className="text-[#E5A93C] not-italic font-bold">merevolusi</span> eksistensi manusia."
              </blockquote>
              
              <div className="flex items-center gap-6 mb-12">
                <div className="relative">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-[#E5A93C] flex items-center justify-center text-[#1D2D50] text-2xl font-bold shadow-[0_20px_40px_-10px_rgba(229,169,60,0.5)] border-2 border-[#1D2D50]">
                    AS
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#B83A4B] border-2 border-[#1D2D50] flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="text-white font-heading text-2xl leading-none">Imam Syafi'i</div>
                  <div className="text-[#E5A93C] text-[10px] uppercase tracking-[0.4em] font-black mt-2 opacity-80">Cendekiawan & Ahli Fikih</div>
                </div>
              </div>

              {/* Feature Tags: Luxury Style */}
              <div className="grid grid-cols-2 gap-3 mt-16 border-t border-white/10 pt-10">
                {[
                  "Analisis HOTS",
                  "Peta Konsep",
                  "Feedback IEEE",
                  "Akses Global"
                ].map((text, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-white/60 text-[10px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
                    <div className="w-1 h-1 rounded-full bg-[#E5A93C]" />
                    {text}
                  </div>
                ))}
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
                <span className="text-white/30 text-[8px] uppercase tracking-widest font-black mt-0.5">Scholars Joined</span>
              </div>
            </div>
            <div className="h-[1px] w-24 bg-gradient-to-l from-white/20 to-transparent" />
          </div>
        </div>

        {/* Right Section — Luxurious Form Area */}
        <div className="w-full lg:w-[640px] h-full flex flex-col justify-center p-8 lg:px-16 xl:px-20 bg-[#F8F6F0] border-l border-[#E5A93C]/10 shadow-2xl relative overflow-y-auto">
          
          {/* Top Navigation Spacer (since link was removed) */}
          <div className="mb-auto h-8 lg:h-0" />

          {/* Form Content */}
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-10 text-center lg:text-left">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D2D50] to-[#15223E] shadow-2xl flex items-center justify-center border border-white/10">
                  <GraduationCap className="w-8 h-8 text-[#E5A93C]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-heading text-2xl font-bold tracking-tighter text-[#1A1B26]">EduScanner <span className="text-[#B83A4B]">AI</span></span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-[1px] w-3 bg-[#E5A93C]/50" />
                    <span className="text-[9px] uppercase tracking-[0.4em] text-[#E5A93C] font-black">Registration Portal</span>
                  </div>
                </div>
              </div>
              <h1 className="font-heading text-4xl text-[#1A1B26] tracking-tight leading-none mb-3 italic">Mulai <span className="not-italic font-bold">Keanggotaan.</span></h1>
              <p className="text-[#646675] text-sm font-medium leading-relaxed max-w-[280px]">
                Bergabunglah dengan ekosistem riset cerdas kami sekarang.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Nama Lengkap</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D1D1D1] group-focus-within:text-[#1D2D50] transition-colors" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Username</label>
                  <div className="relative group">
                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D1D1D1] group-focus-within:text-[#1D2D50] transition-colors" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Alamat Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D1D1D1] group-focus-within:text-[#1D2D50] transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="anda@institusi.ac.id"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Kunci Sandi</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D1D1D1] group-focus-within:text-[#1D2D50] transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 karakter"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D1D1D1] hover:text-[#1D2D50] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Verifikasi Sandi</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D1D1D1] group-focus-within:text-[#1D2D50] transition-colors" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi sandi"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D1D1D1] hover:text-[#1D2D50] transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#1D2D50] hover:bg-[#15223E] text-white rounded-xl font-bold uppercase tracking-[0.3em] text-[10px] shadow-[0_20px_40px_-10px_rgba(29,45,80,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-4 border border-white/5"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Inisialisasi Keanggotaan <ChevronRight className="w-4 h-4 text-[#E5A93C]" /></>}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[#E2E0D8] to-transparent"></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase tracking-[0.25em] font-extrabold">
                <span className="bg-[#F8F6F0] px-4 text-[#A0A2B1]">Identitas Cloud</span>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 rounded-xl border border-[#E2E0D8] bg-white text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1B26] hover:bg-white hover:border-[#1D2D50] hover:shadow-md transition-all duration-500 flex items-center justify-center gap-4 active:scale-[0.98] group"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all opacity-70 group-hover:opacity-100" alt="Google" />
              Daftar dengan Google
            </button>
          </div>

          {/* Bottom Link */}
          <div className="pt-10 pb-4 text-center">
            <p className="text-[11px] font-medium text-[#646675]">
              Sudah memiliki akses?{" "}
              <Link to="/login" className="font-bold text-[#1D2D50] hover:text-[#B83A4B] border-b border-[#1D2D50]/20 hover:border-[#B83A4B] transition-all uppercase tracking-widest text-[9px] ml-1">
                Masuk
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
