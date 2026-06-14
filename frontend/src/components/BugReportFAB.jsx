import { useState, useEffect } from "react";
import { Bug } from "lucide-react";
import BugReportModal from "./BugReportModal";

export default function BugReportFAB() {
  const [showModal, setShowModal] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timeout;
    const handleScroll = () => {
      setVisible(false); // Sembunyi pas scroll jalan
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setVisible(true); // Muncul pas berhenti
      }, 500); // Tunggu 500ms setelah berhenti
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className={`fixed bottom-40 md:bottom-12 right-6 z-[9999] bg-[#B83A4B] text-white p-3.5 rounded-full shadow-lg transition-all duration-300 ${
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-0 opacity-0 translate-y-10"
        }`}
        title="Lapor Bug / Masalah"
      >
        <Bug className="w-6 h-6" />
      </button>
      <BugReportModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
