import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#12131A] text-white p-6 text-center relative overflow-hidden">
      {/* Cyberpunk Neon Flicker & Hanging Letter Style */}
      <style>{`
        @keyframes neon-flicker {
          0%, 18%, 22%, 25%, 53%, 57%, 100% {
            text-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4);
            opacity: 1;
            -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.25);
          }
          19%, 21%, 23%, 54%, 56% {
            text-shadow: none;
            opacity: 0.3;
            -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.08);
          }
          20%, 24%, 55% {
            text-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
            opacity: 0.6;
            -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.15);
          }
        }
        
        @keyframes hang-loose {
          0%, 100% {
            transform: rotate(14deg) translateY(0.05em) translateX(0.25em);
          }
          50% {
            transform: rotate(20deg) translateY(0.08em) translateX(0.35em);
          }
        }

        .animate-neon-flicker-1 {
          animation: neon-flicker 3.5s linear infinite;
        }
        .animate-neon-flicker-2 {
          animation: neon-flicker 3.8s linear infinite 0.3s;
        }
        .animate-neon-flicker-3 {
          animation: neon-flicker 3.2s linear infinite 0.1s;
        }

        .animate-hang-loose {
          animation: hang-loose 4s ease-in-out infinite;
          transform-origin: 10% 0%;
        }
      `}</style>

      {/* Background 404 with Outline & Flicker (Each digit split for independent animations) */}
      <div
        className="absolute text-[8rem] md:text-[14rem] font-black select-none pointer-events-none top-[37%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-1 md:gap-3"
      >
        <span
          className="inline-block animate-neon-flicker-1"
          style={{
            WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.25)",
            color: "transparent",
            textShadow: "0 0 20px rgba(59, 130, 246, 0.6)"
          }}
        >
          4
        </span>
        <span
          className="inline-block animate-neon-flicker-2"
          style={{
            WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.25)",
            color: "transparent",
            textShadow: "0 0 20px rgba(59, 130, 246, 0.6)"
          }}
        >
          0
        </span>
        <span
          className="inline-block animate-neon-flicker-3 animate-hang-loose"
          style={{
            WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.25)",
            color: "transparent",
            textShadow: "0 0 20px rgba(59, 130, 246, 0.6)"
          }}
        >
          4
        </span>
      </div>

      {/* Center Content Wrapper */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 my-auto">
        {/* Mascot Image with glow background */}
        <div className="relative w-full max-w-[600px] mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.2)_0%,transparent_60%)] blur-xl" />
          <img
            src="/img/mascot-404.png"
            alt="Maskot Schooly AI 404"
            className="w-full h-[240px] md:h-[300px] object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(37,99,235,0.3)]"
          />
        </div>

        {/* Text and Action */}
        <div className="flex flex-col items-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">Oops, halaman tidak ada</h1>
          <p className="text-[#A9B1D6] mb-8 max-w-md text-sm md:text-base leading-relaxed">
            Halaman yang Anda cari tidak ditemukan, pastikan url yang Anda kunjungi benar atau kembali ke beranda!
          </p>
          <Button
            onClick={() => navigate('/')}
            className="bg-[#2563EB] hover:bg-[#1D2D50] text-white px-8 py-3 rounded-xl transition-all"
          >
            Kembali ke Beranda
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full relative z-10 flex flex-col items-center justify-center gap-1.5 pt-6 pb-2 mt-auto border-t border-white/10 opacity-70 text-center">
        <p className="text-[8px] uppercase tracking-[0.3em] font-black text-white/50">© 2026 Schooly AI - Part of CMC Group.</p>
        <p className="text-[8px] uppercase tracking-[0.3em] font-black text-white/50">All rights reserved.</p>
      </div>
    </div>
  );
};

export default NotFoundPage;