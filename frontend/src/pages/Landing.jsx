import { Button } from "@/components/ui/button";
import { ArrowUpRight, BookOpen, BrainCircuit, FileSearch, GraduationCap, Sparkles } from "lucide-react";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/3d3d8cf4-e7fe-469a-b338-aababe70dd7b/images/7b6b9737e6374591d9a3b25695ec71d7ac4f0b4c6b036c3a181f991d2e976936.png";

const handleGoogleLogin = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain" data-testid="landing-page">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl bg-[#F8F6F0]/85 border-b border-[#E2E0D8]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#1D2D50] grid place-items-center">
              <GraduationCap className="w-4 h-4 text-[#E5A93C]" />
            </div>
            <span className="font-heading text-xl font-semibold tracking-tight">EduScanner <span className="text-[#B83A4B]">AI</span></span>
            <span className="ml-3 text-[10px] uppercase tracking-[0.25em] text-[#646675] hidden sm:inline">Edisi Pelajar & Mahasiswa</span>
          </div>
          <Button
            data-testid="google-login-button"
            onClick={handleGoogleLogin}
            className="bg-[#1D2D50] hover:bg-[#15223E] text-white rounded-full px-5 h-9"
          >
            Masuk dengan Google
            <ArrowUpRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E2E0D8] text-xs font-medium text-[#646675]">
              <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>Didukung Gemini 3 Pro · Untuk Pelajar & Mahasiswa Indonesia</span>
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] mt-6 text-[#1A1B26]">
              Pahami jurnal & modul kuliah,
              <span className="italic text-[#B83A4B]"> lebih dalam.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-[#646675] leading-relaxed max-w-xl">
              Asisten akademik AI yang membaca PDF teknis, menjelaskan diagram, membangun peta konsep, lalu menguji pemahaman lu lewat kuis HOTS dengan feedback berbasis referensi akademik. Dari SD sampai bangku kuliah.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                data-testid="hero-cta-button"
                onClick={handleGoogleLogin}
                className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-12 px-7 rounded-full text-sm font-medium"
              >
                Mulai Belajar Gratis
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Button>
              <a href="#fitur" className="text-sm font-medium text-[#1D2D50] hover:text-[#B83A4B] transition-colors">
                Lihat cara kerja →
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">
              <span>SD</span><span>·</span><span>SMP</span><span>·</span><span>SMA</span><span>·</span><span>SMK</span><span>·</span><span>MA</span><span>·</span><span>Universitas</span>
            </div>
          </div>
          <div className="md:col-span-5 relative fade-up" style={{ animationDelay: "120ms" }}>
            <div className="relative rounded-2xl overflow-hidden border border-[#E2E0D8] bg-white">
              <img src={HERO_IMG} alt="EduScanner AI" className="w-full h-auto" />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-white border border-[#E2E0D8] rounded-xl px-4 py-3 shadow-sm hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1]">Audit Log</div>
              <div className="font-mono text-sm text-[#1D2D50]">AUD-20260214-0042</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="px-6 lg:px-12 max-w-7xl mx-auto pb-24">
        <div className="grid md:grid-cols-12 gap-6">
          <Feature
            num="01"
            icon={<FileSearch className="w-5 h-5" />}
            title="Analisis Dokumen Akademik"
            desc="Upload PDF jurnal atau modul. AI ekstrak abstraksi, metodologi, hasil, dan menjelaskan Sequence/Class Diagram dengan kontekstual."
            className="md:col-span-7"
          />
          <Feature
            num="02"
            icon={<BookOpen className="w-5 h-5" />}
            title="Mode Belajar Dulu"
            desc="Peta konsep, poin kritis, dan contoh kode (Java/Python) untuk hubungkan teori ke praktik."
            className="md:col-span-5"
          />
          <Feature
            num="03"
            icon={<BrainCircuit className="w-5 h-5" />}
            title="Kuis HOTS Interaktif"
            desc="Soal analisis kode, troubleshooting, dan perancangan database — bukan hafalan."
            className="md:col-span-5"
          />
          <Feature
            num="04"
            icon={<Sparkles className="w-5 h-5" />}
            title="Deep Feedback + Referensi"
            desc="Tiap jawaban diberi penjelasan dengan rujukan akademik (Pressman, Sommerville, IEEE, dll)."
            className="md:col-span-7"
          />
        </div>
      </section>

      <footer className="border-t border-[#E2E0D8] px-6 lg:px-12 py-8 text-xs text-[#646675]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 EduScanner AI — University Edition</span>
          <span className="font-mono text-[#A0A2B1]">v3.0</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ num, icon, title, desc, className = "" }) {
  return (
    <div data-testid={`feature-${num}`} className={`card-lift bg-white border border-[#E2E0D8] rounded-xl p-7 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="font-mono text-xs text-[#A0A2B1] mt-1">{num}</div>
        <div className="flex-1">
          <div className="inline-flex w-9 h-9 rounded-md bg-[#F8F6F0] border border-[#E2E0D8] items-center justify-center text-[#1D2D50] mb-4">
            {icon}
          </div>
          <h3 className="font-heading text-xl text-[#1A1B26] mb-2">{title}</h3>
          <p className="text-sm text-[#646675] leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}
