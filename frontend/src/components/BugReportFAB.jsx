import { useState, useEffect } from "react";
import { Headset } from "lucide-react";
import BugReportModal from "./BugReportModal";

export default function BugReportFAB() {
  const [showModal, setShowModal] = useState(false);
  const [visible, setVisible] = useState(true);

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

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`fixed bottom-24 md:bottom-10 right-6 z-[9999] group flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:shadow-[0_12px_40px_rgb(37,99,235,0.6)] hover:-translate-y-1 transition-all duration-500 ${
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-0 opacity-0 translate-y-10"
        }`}
        title="EduAI Help Center"
      >
        <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <Headset className="w-6 h-6 relative z-10 animate-in zoom-in duration-500" />
      </button>
      <BugReportModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
