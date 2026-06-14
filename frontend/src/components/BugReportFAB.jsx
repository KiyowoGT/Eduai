import { useState, useEffect } from "react";
import { Headset, Plus } from "lucide-react";
import { useLocation } from "react-router-dom"; // Import useLocation
import useMediaQuery from "@/hooks/useMediaQuery";
import BugReportModal from "./BugReportModal";

export default function BugReportFAB() {
  const [showModal, setShowModal] = useState(false);
  const [visible, setVisible] = useState(true);
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Deteksi halaman dokumen manapun
  const isDocumentPage = location.pathname.startsWith('/dokumen/');

  useEffect(() => {
    let timeout;
    const handleScroll = () => {
      setVisible(false);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setVisible(true);
      }, 700);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  // JANGAN RENDER WIDGET jika di mobile DAN di halaman dokumen
  if (isMobile && isDocumentPage) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(!showModal)}
        className={`fixed bottom-24 md:bottom-10 right-6 z-[9999] group flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:shadow-[0_12px_40px_rgb(37,99,235,0.6)] hover:-translate-y-1 transition-all duration-500 ${
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-0 opacity-0 translate-y-10"
        } ${showModal ? "rotate-45" : "rotate-0"}`}
      >
        {showModal ? (
          <Plus className="w-7 h-7" />
        ) : (
          <Headset className="w-7 h-7" />
        )}
      </button>

      {showModal && <BugReportModal isOpen={showModal} onClose={() => setShowModal(false)} />}
    </>
  );
}