import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BookOpen, BrainCircuit, FileSearch, GraduationCap, Sparkles, ChevronRight, ShieldCheck, CheckCircle2, Globe, Star, Zap, Menu, X } from "lucide-react";
import DualLoader from "@/components/DualLoader";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/3d3d8cf4-e7fe-469a-b338-aababe70dd7b/images/7b6b9737e6374591d9a3b25695ec71d7ac4f0b4c6b036c3a181f991d2e976936.png";
const PREMIER_IMG = "https://plain-apac-prod-public.komododecks.com/202605/23/CsKoA3Pkqy1TTAAofG8Y/image.png";

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return <DualLoader variant="full" type="landing" text="Mempersiapkan portal akademik..." />;
  }
  
  if (user) {
    const isOnboarded = user.onboarded || user.institution_code || user.enrolled_class || user.education_level || user.role === "pengajar";
    return <Navigate to={isOnboarded ? "/dashboard" : "/onboarding"} replace />;
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0] dark:bg-[#12131A] selection:bg-[#E5A93C] selection:text-[#1A1B26] overflow-x-hidden font-body relative transition-colors duration-500">
      {/* Background Subtle Grain */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] paper-grain z-0" />

      {/* Navigation - Adaptive Theme */}
      <nav className="fixed top-0 inset-x-0 z-[60] backdrop-blur-2xl bg-[#F8F6F0]/90 dark:bg-[#12131A]/90 border-b border-[#1D2D50]/10 dark:border-white/10 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#1D2D50] shadow-xl flex items-center justify-center border border-white/10 group cursor-pointer overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#E5A93C]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <GraduationCap className="w-5 h-5 text-[#E5A93C] relative z-10" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-heading text-lg sm:text-xl font-bold tracking-tighter text-[#1D2D50] dark:text-white">EduScanner <span className="text-[#B83A4B]">AI</span></span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-[1px] w-3 bg-[#E5A93C]" />
                <span className="text-[8px] uppercase tracking-[0.4em] text-[#1D2D50] dark:text-[#E5A93C] font-black leading-none">Premier Tier</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-10">
            {["Fitur", "Keunggulan", "Harga"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D2D50] dark:text-white/80 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors border-b border-transparent hover:border-[#B83A4B] dark:hover:border-[#E5A93C] pb-1">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D2D50] dark:text-white/90 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors hidden md:block">
              Akses Portal
            </Link>
            <Button
              onClick={() => navigate("/signup")}
              className="bg-[#1D2D50] dark:bg-[#E5A93C] hover:bg-[#15223E] dark:hover:bg-[#D4AF37] text-white dark:text-[#12131A] rounded-xl px-4 sm:px-6 h-11 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#1D2D50]/20 transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/10 hidden sm:inline-flex"
            >
              Mulai Eksplorasi
            </Button>
            
            {/* Hamburger Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#1D2D50] dark:text-white hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors md:hidden focus:outline-none"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-x-0 top-20 z-50 md:hidden backdrop-blur-2xl bg-[#F8F6F0]/95 dark:bg-[#12131A]/95 border-b border-[#1D2D50]/10 dark:border-white/10 py-6 px-6 flex flex-col gap-6 animate-in slide-in-from-top duration-300">
            <div className="flex flex-col gap-4 text-left">
              {["Fitur", "Keunggulan", "Harga"].map((item) => (
                <a 
                  key={item} 
                  href={`#${item.toLowerCase()}`} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xs font-black uppercase tracking-[0.2em] text-[#1D2D50] dark:text-white/80 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors py-2 border-b border-[#1D2D50]/5 dark:border-white/5"
                >
                  {item}
                </a>
              ))}
              <Link 
                to="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-black uppercase tracking-[0.2em] text-[#1D2D50] dark:text-white/90 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors py-2 border-b border-[#1D2D50]/5 dark:border-white/5"
              >
                Akses Portal
              </Link>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/signup");
                }}
                className="bg-[#1D2D50] dark:bg-[#E5A93C] text-white dark:text-[#12131A] rounded-xl py-3 text-[10px] font-black uppercase tracking-[0.2em] text-center mt-2 border border-white/10 w-full"
              >
                Mulai Eksplorasi
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Majestic Adaptive Balance */}
      <section className="relative pt-32 md:pt-44 pb-20 md:pb-32 px-6 lg:px-12 overflow-hidden">
        {/* Atmospheric Gradients */}
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(229,169,60,0.08)_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,rgba(29,45,80,0.05)_0%,transparent_50%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 fade-up relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-white/5 border-2 border-[#E5A93C]/20 dark:border-[#E5A93C]/10 shadow-sm mb-8">
              <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#1D2D50] dark:text-white/80">Inovasi Akademik Terkurasi</span>
            </div>
            
            <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl xl:text-8xl text-[#1D2D50] dark:text-white tracking-tighter leading-[0.95] mb-8">
              Riset Akademik, <br />
              <span className="italic text-[#E5A93C] italic-scholarly">Eksklusif.</span>
            </h1>
            
            <p className="text-[#1D2D50] dark:text-white/70 text-base sm:text-lg md:text-xl leading-relaxed max-w-xl font-bold mb-12">
              Transformasikan dokumen teknis menjadi peta konsep interaktif dan evaluasi cerdas melalui arsitektur intelegensi buatan tingkat lanjut.
            </p>

            <div className="flex flex-wrap items-center gap-6">
              <Button
                onClick={() => navigate("/signup")}
                className="bg-[#1D2D50] dark:bg-[#E5A93C] hover:bg-[#15223E] dark:hover:bg-[#D4AF37] text-white dark:text-[#12131A] h-14 px-6 sm:px-10 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-2xl shadow-[#1D2D50]/30 transition-all hover:scale-[1.05] border border-white/5 whitespace-normal sm:whitespace-nowrap text-center"
              >
                Inisialisasi Akses
                <ChevronRight className="w-4 h-4 ml-2 text-[#E5A93C] dark:text-[#12131A]" />
              </Button>
              <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate("/signup")}>
                <div className="w-12 h-12 rounded-full border-2 border-[#1D2D50]/10 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center shadow-sm group-hover:border-[#1D2D50] dark:group-hover:border-[#E5A93C] transition-all duration-500">
                  <BookOpen className="w-4 h-4 text-[#1D2D50] dark:text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D2D50] dark:text-white/80">Metodologi Riset</span>
              </div>
            </div>

            <div className="mt-16 flex items-center gap-10">
              <div className="flex flex-col text-left">
                <span className="text-3xl font-black text-[#1D2D50] dark:text-white tracking-tighter">12.4K</span>
                <span className="text-[9px] uppercase tracking-[0.4em] font-black text-[#E5A93C]">Cendekiawan</span>
              </div>
              <div className="h-10 w-[2px] bg-[#E5A93C]/20" />
              <div className="flex flex-col text-left">
                <span className="text-3xl font-black text-[#1D2D50] dark:text-white tracking-tighter">98.2%</span>
                <span className="text-[9px] uppercase tracking-[0.4em] font-black text-[#E5A93C]">Presisi AI</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative fade-up" style={{ animationDelay: "200ms" }}>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-tr from-[#E5A93C]/20 via-transparent to-[#1D2D50]/10 rounded-[3rem] blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative rounded-[2.5rem] overflow-hidden border-8 border-white dark:border-[#1C1D26] shadow-2xl transition-transform duration-700 hover:scale-[1.02]">
                <img src={PREMIER_IMG} alt="Interface" className="w-full h-auto" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1D2D50]/30 to-transparent" />
              </div>

              {/* Floating Prestigious Badge */}
              <div className="absolute -bottom-6 right-2 sm:-bottom-8 sm:-right-8 bg-[#1D2D50] dark:bg-[#E5A93C] border-4 border-white dark:border-[#12131A] rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl transform hover:-translate-y-2 transition-transform duration-500 z-20">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#E5A93C] dark:bg-[#12131A] flex items-center justify-center text-[#1D2D50] dark:text-[#E5A93C] text-lg sm:text-xl font-black shadow-[0_0_20px_rgba(229,169,60,0.4)]">
                    A+
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] uppercase tracking-[0.3em] font-black text-white/50 dark:text-[#12131A]/60">Verified tier</span>
                    <span className="text-xs sm:text-sm font-heading font-bold text-white dark:text-[#12131A]">Akurasi Riset</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted Institutions - Adaptive */}
      <section className="py-12 sm:py-20 border-y border-[#1D2D50]/10 dark:border-white/10 bg-[#1D2D50]/5 dark:bg-white/5 backdrop-blur-sm transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#1D2D50]/40 dark:text-white/40 mb-8 sm:mb-12 text-center">Kredibilitas Global Melalui Kolaborasi</span>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-12 md:gap-24 grayscale hover:grayscale-0 transition-all duration-1000 text-[#1D2D50] dark:text-white/50">
              {["UNIVERSITY", "RESEARCH", "SCHOLAR", "INSTITUTE", "ACADEMY"].map((name) => (
                <span key={name} className="text-lg sm:text-2xl md:text-3xl font-heading font-black tracking-tighter cursor-default opacity-80 hover:opacity-100">{name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid - Adaptive Luxurious Balance */}
      <section id="fitur" className="py-16 md:py-32 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-16 md:mb-24 max-w-2xl mx-auto fade-up">
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#E5A93C] to-transparent mx-auto mb-8" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#B83A4B] dark:text-[#E5A93C] mb-4 block">Fungsionalitas Premium</span>
          <h2 className="font-heading text-3xl sm:text-5xl md:text-6xl text-[#1D2D50] dark:text-white tracking-tighter leading-none mb-6 italic italic-scholarly text-glow-gold">Inovasi <span className="not-italic font-black">Cerdas.</span></h2>
          <p className="text-[#1D2D50] dark:text-white/70 text-sm sm:text-base font-bold leading-relaxed">
            Arsitektur yang dirancang khusus untuk memahami terminologi teknis dan struktur metodologi penelitian global.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          <FeatureCard 
            icon={Globe}
            title="Akses Global"
            desc="Sinergi data riset Anda dalam ekosistem aman dengan standar enkripsi militer."
          />
          <FeatureCard 
            icon={Zap}
            title="Analisis Kilat"
            desc="Pemrosesan ribuan data akademik dalam hitungan detik tanpa reduksi konteks."
          />
          <FeatureCard 
            icon={ShieldCheck}
            title="Integritas Total"
            desc="Keamanan tingkat institusi yang menjamin kerahasiaan kekayaan intelektual Anda."
          />
        </div>
      </section>

      {/* SaaS Pricing - Strictly Themed */}
      <section id="harga" className="py-16 md:py-32 bg-[#1D2D50] dark:bg-[#0D1527] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(58,82,133,0.3)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(229,169,60,0.1)_0%,transparent_30%)]" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10 text-center">
          <div className="mb-16 md:mb-24">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#E5A93C] mb-4 block text-glow-gold">Pilihan Keanggotaan</span>
            <h2 className="font-heading text-3xl sm:text-5xl md:text-7xl text-white tracking-tighter italic italic-scholarly leading-none mb-6">Investasi <span className="not-italic font-black text-[#E5A93C]">Akademik.</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            <PricingCard 
              title="Basic"
              price="IDR 0"
              desc="Eksplorasi awal asisten AI."
              features={["5 Dokumen / Bulan", "Analisis PDF Dasar", "Kuis Standar"]}
            />
            <PricingCard 
              premium
              title="Elite Scholar"
              price="IDR 49k"
              period="/bln"
              desc="Standar tertinggi riset akademik."
              features={["Unlimited Dokumen", "Peta Konsep Advanced", "Feedback IEEE/ACM", "Prioritas Server"]}
            />
            <PricingCard 
              title="Institution"
              price="Custom"
              desc="Lembaga riset & universitas."
              features={["Admin Dashboard", "Audit Log Analytics", "SLA Guarantee", "Custom API"]}
            />
          </div>
        </div>
      </section>

      {/* Final CTA - Adaptive */}
      <section className="py-16 md:py-32 px-6 lg:px-12 max-w-5xl mx-auto text-center relative transition-colors duration-500">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient from-[#E5A93C]/10 to-transparent blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-[2rem] bg-[#1D2D50] shadow-2xl flex items-center justify-center mx-auto mb-10 border-4 border-white dark:border-white/10">
            <GraduationCap className="w-10 h-10 text-[#E5A93C]" />
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl md:text-7xl text-[#1D2D50] dark:text-white tracking-tighter leading-none mb-8 italic">Mulai Revolusi <br /> <span className="not-italic font-bold">Akademik Anda.</span></h2>
          <Button
            onClick={() => navigate("/signup")}
            className="bg-[#1D2D50] dark:bg-[#E5A93C] hover:bg-[#15223E] dark:hover:bg-[#D4AF37] text-white dark:text-[#12131A] h-14 md:h-16 px-6 md:px-12 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] shadow-2xl shadow-[#1D2D50]/40 dark:shadow-[#E5A93C]/20 transition-all hover:scale-[1.05] whitespace-normal sm:whitespace-nowrap text-center"
          >
            Daftar Sekarang Secara Gratis
          </Button>
        </div>
      </section>

      {/* Footer - Adaptive Theme */}
      <footer className="py-16 md:py-24 bg-white dark:bg-[#12131A] border-t-4 border-[#E5A93C]/20 relative overflow-hidden transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid md:grid-cols-4 gap-16 mb-20 text-left">
            <div className="md:col-span-2 text-left">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#1D2D50] flex items-center justify-center shadow-2xl border border-[#E5A93C]/30">
                  <GraduationCap className="w-7 h-7 text-[#E5A93C]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-heading text-3xl font-black tracking-tighter text-[#1D2D50] dark:text-white leading-none">EduScanner AI</span>
                  <span className="text-[9px] uppercase tracking-[0.4em] text-[#B83A4B] dark:text-[#E5A93C] font-black mt-1">Superior Framework</span>
                </div>
              </div>
              <p className="text-[#1D2D50] dark:text-white/80 text-sm leading-relaxed max-w-sm font-bold opacity-80 mb-10">
                Pionir intelegensi akademik digital yang mengutamakan akurasi, etika, dan pemberdayaan cendekiawan di seluruh Indonesia.
              </p>
              <div className="flex items-center gap-8 text-[#1D2D50]/60 dark:text-white/40">
                <Globe className="w-5 h-5 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors cursor-pointer" />
                <Star className="w-5 h-5 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors cursor-pointer" />
                <ShieldCheck className="w-5 h-5 hover:text-[#B83A4B] dark:hover:text-[#E5A93C] transition-colors cursor-pointer" />
              </div>
            </div>

            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1D2D50] dark:text-white mb-8 block">Navigasi</span>
              <ul className="space-y-4 text-[11px] font-black text-[#1D2D50]/70 dark:text-white/60 uppercase tracking-widest">
                <li className="hover:text-[#E5A93C] cursor-pointer transition-colors">Arsitektur</li>
                <li className="hover:text-[#E5A93C] cursor-pointer transition-colors">Paket Elite</li>
                <li className="hover:text-[#E5A93C] cursor-pointer transition-colors">Log Perubahan</li>
              </ul>
            </div>

            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1D2D50] dark:text-white mb-8 block">Korporasi</span>
              <ul className="space-y-4 text-[11px] font-black text-[#1D2D50]/70 dark:text-white/60 uppercase tracking-widest">
                <li className="hover:text-[#E5A93C] cursor-pointer transition-colors">Privasi Data</li>
                <li className="hover:text-[#E5A93C] cursor-pointer transition-colors">Kepatuhan Hukum</li>
                <li className="hover:text-[#E5A93C] cursor-pointer transition-colors">Kontak Portal</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-[#1D2D50]/10 dark:border-white/10 opacity-70">
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#1D2D50] dark:text-white/50">© 2026 EduScanner AI Framework • Premier Edition</p>
            <div className="flex items-center gap-4 bg-[#1D2D50]/5 dark:bg-white/5 px-4 py-2 rounded-full border border-[#1D2D50]/10 dark:border-white/10 shadow-sm">
               <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
               <span className="text-[9px] uppercase tracking-widest font-black text-[#1D2D50] dark:text-white/80">Quantum Nodes Online</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] bg-white dark:bg-white/5 border-2 border-[#1D2D50]/5 dark:border-white/5 shadow-xl transition-all duration-700 hover:scale-[1.05] hover:shadow-[0_40px_80px_-20px_rgba(29,45,80,0.15)] hover:border-[#E5A93C]/40 dark:hover:border-[#E5A93C]/60 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#E5A93C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="w-16 h-16 rounded-2xl bg-[#1D2D50] dark:bg-[#E5A93C] flex items-center justify-center mb-8 shadow-2xl border border-white/10 group-hover:rotate-6 transition-transform duration-500">
        <Icon className="w-6 h-6 text-[#E5A93C] dark:text-[#12131A]" />
      </div>
      <h3 className="font-heading text-2xl sm:text-3xl text-[#1D2D50] dark:text-white mb-5 font-black tracking-tighter italic leading-none text-left">{title}</h3>
      <p className="text-sm text-[#1D2D50] dark:text-white/70 leading-relaxed font-bold opacity-80 group-hover:opacity-100 transition-opacity text-left">{desc}</p>
    </div>
  );
}

function PricingCard({ title, price, period = "", desc, features, premium = false }) {
  return (
    <div className={`relative p-6 sm:p-10 md:p-12 rounded-[2rem] sm:rounded-[3rem] md:rounded-[3.5rem] transition-all duration-1000 md:hover:scale-[1.03] flex flex-col overflow-hidden ${premium ? 'bg-[#1D2D50] dark:bg-[#121E36] text-white shadow-[0_50px_100px_-20px_rgba(29,45,80,0.4)] md:scale-105 border-4 border-[#E5A93C] z-10' : 'bg-white dark:bg-white/5 text-[#1D2D50] dark:text-white border-2 border-[#1D2D50]/10 dark:border-white/10 shadow-xl'}`}>
      {premium && (
        <div className="absolute top-0 right-0 px-8 py-3 bg-[#E5A93C] text-[#1D2D50] dark:text-[#12131A] text-[10px] font-black uppercase tracking-[0.4em] rounded-bl-3xl shadow-2xl z-20">
          Premier tier
        </div>
      )}
      
      <div className="mb-8 md:mb-12 text-left">
        <span className={`text-[10px] font-black uppercase tracking-[0.5em] mb-4 block ${premium ? 'text-[#E5A93C]' : 'text-[#B83A4B] dark:text-[#E5A93C]'}`}>{title}</span>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-4xl sm:text-5xl md:text-6xl font-heading font-black tracking-tighter italic italic-scholarly">{price}</span>
          <span className={`text-sm font-bold uppercase tracking-widest ${premium ? 'text-white/40' : 'text-[#1D2D50]/30 dark:text-white/30'}`}>{period}</span>
        </div>
        <p className={`text-xs font-bold mt-6 leading-relaxed ${premium ? 'text-white/70' : 'text-[#1D2D50]/80 dark:text-white/60'}`}>{desc}</p>
      </div>

      <div className="space-y-5 mb-10 md:mb-14 flex-1">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-center gap-4">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${premium ? 'border-[#E5A93C]/40 bg-[#E5A93C]/10' : 'border-[#1D2D50]/20 bg-[#1D2D50]/5 dark:border-white/20 dark:bg-white/5'}`}>
               <CheckCircle2 className={`w-3 h-3 ${premium ? 'text-[#E5A93C]' : 'text-[#1D2D50] dark:text-[#E5A93C]'}`} />
            </div>
            <span className={`text-[12px] font-black uppercase tracking-widest ${premium ? 'text-white/90' : 'text-[#1D2D50] dark:text-white/80'}`}>{feature}</span>
          </div>
        ))}
      </div>

      <Button
        className={`w-full h-14 md:h-16 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] transition-all duration-500 ${premium ? 'bg-[#E5A93C] hover:bg-[#D4AF37] text-[#1D2D50] dark:text-[#12131A] shadow-[0_20px_50px_rgba(229,169,60,0.3)]' : 'bg-[#1D2D50] dark:bg-[#E5A93C] hover:bg-[#15223E] dark:hover:bg-[#D4AF37] text-white dark:text-[#12131A] shadow-xl hover:shadow-2xl'}`}
      >
        Aktivasi {title}
      </Button>
    </div>
  );
}
