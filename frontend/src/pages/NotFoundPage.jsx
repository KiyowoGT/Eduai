import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import mascotImg from "@/assets/404-mascot.jpg";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#12131A] text-white p-6 text-center">
      <img 
        src={mascotImg}
        alt="Maskot Schooly AI 404" 
        className="w-[300px] h-[300px] mb-8 object-contain"
      />
      <h1 className="text-4xl font-bold mb-4">Halaman Tidak Ditemukan</h1>
      <p className="text-[#A9B1D6] mb-8 max-w-md">
        Sepertinya kamu tersesat di ruang angkasa digital. Halaman yang kamu cari tidak ada atau akses ditolak.
      </p>
      <Button 
        onClick={() => navigate('/')}
        className="bg-[#2563EB] hover:bg-[#1D2D50] text-white px-8 py-3 rounded-xl transition-all"
      >
        Kembali ke Beranda
      </Button>
    </div>
  );
};

export default NotFoundPage;
