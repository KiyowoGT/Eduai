import { useState } from "react";
import { MessageSquareText } from "lucide-react";
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
      }, 500);
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
        className={`fixed bottom-24 md:bottom-20 right-6 z-[9999] bg-[#B83A4B] text-white p-3.5 rounded-full shadow-lg transition-all duration-300 ${
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-0 opacity-0 translate-y-10"
        }`}
        title="Lapor Bug / Masalah"
      >
        <MessageSquareText className="w-6 h-6" />
      </button>
      <BugReportModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
