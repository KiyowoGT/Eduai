import { useState } from "react";
import { 
  Headset, Users, Sparkles, X, Send, Phone, Mail, Clock, 
  GraduationCap, ChevronRight, MessageSquare, Bot 
} from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/api";

const TABS = [
  { id: "support", label: "Support", icon: Headset },
  { id: "channel", label: "Channel", icon: Users },
  { id: "chatbot", label: "Chatbot", icon: Sparkles },
];

export default function BugReportModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("support");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleReport = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await http.post("/report-bug", { title: title.trim(), severity: "Medium" });
      toast.success("Laporan terkirim! Tim CS akan merespons.");
      setTitle("");
      onClose();
    } catch {
      toast.error("Gagal mengirim laporan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed bottom-[130px] md:bottom-[110px] right-4 md:right-6 z-[10000] w-[calc(100%-32px)] md:w-[400px] animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 ease-out"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#1A1B26] rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#24283B] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading text-lg font-bold text-white">Contact Support</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#24283B] transition-colors">
            <X className="w-5 h-5 text-[#A0A2B1]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 mb-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 flex-1 py-3 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#24283B] text-white ring-1 ring-[#363B54]"
                    : "bg-transparent text-[#646675] hover:text-[#A9B1D6]"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#646675]"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="px-5 pb-5">
          {activeTab === "support" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">Contact Options</h3>

              {/* Telegram */}
              <a href="https://t.me/adminschoolyai" target="_blank" className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] hover:border-[#363B54] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#0088CC] grid place-items-center shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Telegram</div>
                  <div className="text-xs text-[#646675]">Quick chat support</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#363B54] group-hover:text-[#A9B1D6]" />
              </a>

              {/* WhatsApp */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] opacity-60">
                <div className="w-10 h-10 rounded-lg bg-[#25D366] grid place-items-center shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">WhatsApp</div>
                  <div className="text-xs text-[#646675]">Now inactive (suspend)</div>
                </div>
              </div>

              {/* Email */}
              <a href="mailto:admin@cindigital.id" className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] hover:border-[#363B54] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#E54D52] grid place-items-center shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Email</div>
                  <div className="text-xs text-[#646675]">admin@cindigital.id</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#363B54] group-hover:text-[#A9B1D6]" />
              </a>

              {/* Hours */}
              <div className="flex items-center gap-2 pt-1 text-xs text-[#646675]">
                <Clock className="w-3.5 h-3.5" />
                Aktif: 09:00 - 21:00 ( kecuali kamis/jumat )
              </div>
            </div>
          )}

          {activeTab === "channel" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">Community Channel</h3>
              <a href="https://t.me/schoolyai" target="_blank" className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] hover:border-[#363B54] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#0088CC] grid place-items-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Telegram Group</div>
                  <div className="text-xs text-[#646675]">Gabung komunitas Schooly AI</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#363B54] group-hover:text-[#A9B1D6]" />
              </a>
              <div className="text-xs text-[#646675] pt-1">
                Diskusi bebas, sharing materi, dan update terbaru
              </div>
            </div>
          )}

          {activeTab === "chatbot" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">AI Chatbot</h3>
              <div className="p-4 rounded-xl bg-[#1F2133] border border-[#24283B] text-center">
                <Bot className="w-10 h-10 text-[#1D2D50] mx-auto mb-3" />
                <div className="text-sm font-bold text-white mb-1">Virtual Tutor AI</div>
                <div className="text-xs text-[#646675] mb-3">Tanya jawab materi pelajaran langsung dengan AI tutor</div>
                <a href="/chat" className="inline-flex items-center gap-2 bg-[#1D2D50] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#15223E] transition-colors">
                  <Bot className="w-4 h-4" />
                  Mulai Chat
                </a>
              </div>
            </div>
          )}

          {/* Bug Report */}
          {activeTab === "support" && (
            <div className="mt-4 pt-3 border-t border-[#24283B] space-y-3">
              <h3 className="text-sm font-bold text-white">Lapor Masalah / Bug</h3>
              <textarea
                className="w-full bg-[#1F2133] border border-[#24283B] p-3 rounded-xl text-sm text-white placeholder:text-[#646675] focus:outline-none focus:ring-2 focus:ring-[#363B54] resize-none"
                placeholder="Ceritakan masalah atau kendala kamu..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={3}
              />
              <button
                onClick={handleReport}
                disabled={loading || !title.trim()}
                className="w-full bg-[#1D2D50] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#15223E] transition-colors disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
