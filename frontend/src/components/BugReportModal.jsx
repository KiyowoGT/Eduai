import { useState } from "react";
import { Headphones, Users, Bot, X, Send, Phone, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/api";

const TABS = [
  { id: "support", label: "Support", icon: Headphones },
  { id: "channel", label: "Channel", icon: Users },
  { id: "chatbot", label: "Chatbot", icon: Bot },
];

export default function BugReportModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("support");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleReport = async () => {
    if (!title.trim()) {
      toast.error("Tulis dulu laporannya.");
      return;
    }
    setLoading(true);
    try {
      await http.post("/report-bug", { title: title.trim(), severity: "Medium" });
      toast.success("Laporan terkirim! Tim CS akan segera merespons.");
      setTitle("");
      onClose();
    } catch {
      toast.error("Gagal mengirim laporan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading text-lg font-bold text-[#1A1B26]">Contact Support</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-[#646675]" />
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
                    ? "bg-[#1D2D50]/10 text-[#1D2D50] ring-1 ring-[#1D2D50]/20"
                    : "bg-[#F8F6F0] text-[#646675] hover:bg-[#E2E0D8]"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-[#1D2D50]" : "text-[#A0A2B1]"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="px-5 pb-5">
          {activeTab === "support" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#1A1B26]">Contact Options</h3>

              {/* Telegram */}
              <a
                href="https://t.me/adminschoolyai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E0D8] hover:bg-[#F8F6F0] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0088CC] grid place-items-center shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1A1B26]">Telegram</div>
                  <div className="text-xs text-[#646675]">Quick chat support</div>
                </div>
              </a>

              {/* WhatsApp */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E0D8] bg-[#F8F6F0] opacity-60">
                <div className="w-10 h-10 rounded-lg bg-[#25D366] grid place-items-center shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1A1B26]">WhatsApp</div>
                  <div className="text-xs text-[#646675]">Now inactive (suspend)</div>
                </div>
              </div>

              {/* Email */}
              <a
                href="mailto:admin@cindigital.id"
                className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E0D8] hover:bg-[#F8F6F0] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#B83A4B] grid place-items-center shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1A1B26]">Email</div>
                  <div className="text-xs text-[#646675]">admin@cindigital.id</div>
                </div>
              </a>

              {/* Footer */}
              <div className="flex items-center gap-2 pt-2 text-xs text-[#A0A2B1]">
                <Clock className="w-3.5 h-3.5" />
                Aktif: 09:00 - 21:00 ( kecuali kamis/jumat )
              </div>
            </div>
          )}

          {activeTab === "channel" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#1A1B26]">Community Channel</h3>
              <a
                href="https://t.me/schoolyai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E0D8] hover:bg-[#F8F6F0] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0088CC] grid place-items-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1A1B26]">Telegram Group</div>
                  <div className="text-xs text-[#646675]">Gabung komunitas Schooly AI</div>
                </div>
              </a>
              <div className="flex items-center gap-2 pt-2 text-xs text-[#A0A2B1]">
                <Clock className="w-3.5 h-3.5" />
                Diskusi bebas, sharing materi, dan update terbaru
              </div>
            </div>
          )}

          {activeTab === "chatbot" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#1A1B26]">AI Chatbot</h3>
              <div className="p-4 rounded-xl border border-[#E2E0D8] bg-[#F8F6F0] text-center">
                <Bot className="w-10 h-10 text-[#1D2D50] mx-auto mb-3" />
                <div className="text-sm font-bold text-[#1A1B26] mb-1">Virtual Tutor AI</div>
                <div className="text-xs text-[#646675] mb-3">Tanya jawab materi pelajaran langsung dengan AI tutor</div>
                <a
                  href="/chat"
                  className="inline-flex items-center gap-2 bg-[#1D2D50] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#15223E] transition-colors"
                >
                  <Bot className="w-4 h-4" />
                  Mulai Chat
                </a>
              </div>
            </div>
          )}

          {/* Laporan Bug (di semua tab) */}
          {activeTab === "support" && (
            <div className="mt-4 pt-4 border-t border-[#E2E0D8] space-y-3">
              <h3 className="text-sm font-bold text-[#1A1B26]">Lapor Masalah / Bug</h3>
              <textarea
                className="w-full border border-[#E2E0D8] p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 resize-none"
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
