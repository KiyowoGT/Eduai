import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#12131A] text-white p-6 text-center relative overflow-hidden">
      {/* Cyberpunk Background 404 */}
      <div className="absolute text-[8rem] md:text-[14rem] font-black select-none pointer-events-none top-[37%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-1 md:gap-3 opacity-20">
        <span className="inline-block animate-[neon-flicker_3s_infinite_alternate]">4</span>
        <span className="inline-block animate-[neon-flicker_4s_infinite_alternate_reverse]">0</span>
        <span className="inline-block animate-[neon-flicker_2s_infinite_alternate_1s]">4</span>
      </div>

      <img
        src="/img/mascot-404.png"
        alt="Maskot Schooly AI 404"
        className="w-[500px] h-[500px] mb-8 object-contain relative z-10"
      />
      <h1 className="text-4xl font-bold mb-4 relative z-10">Halaman Tidak Ditemukan</h1>
      <p className="text-[#A9B1D6] mb-8 max-w-md relative z-10">
        Sepertinya kamu tersesat di ruang angkasa digital. Halaman yang kamu cari tidak ada atau akses ditolak.
      </p>
      <Button
        onClick={() => navigate('/')}
        className="bg-[#2563EB] hover:bg-[#1D2D50] text-white px-8 py-3 rounded-xl transition-all relative z-10"
      >
        Kembali ke Beranda
      </Button>

      {/* Neon Flicker Animation Styles */}
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
      `}</style>
    </div>
  );
};

export default NotFoundPage;