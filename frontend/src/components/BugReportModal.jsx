import { useState, useRef, useEffect } from "react";
import { 
  Headset, Users, Sparkles, X, Send, Phone, Mail, Clock, 
  GraduationCap, ChevronRight, MessageSquare, Bot, User 
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

  // Chat AI State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Halo! Saya Virtual Tutor AI. Ada yang bisa saya bantu hari ini?" }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, aiLoading]);

  if (!isOpen) return null;

  const handleReport = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await http.post("/system/report-bug", { title: title.trim(), severity: "Medium" });
      toast.success("Laporan terkirim! Tim CS akan merespons.");
      setTitle("");
      onClose();
    } catch {
      toast.error("Gagal mengirim laporan.");
    } finally {
      setLoading(false);
    }
  };

  const handleAiChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || aiLoading) return;

    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatInput("");
    setAiLoading(true);

    try {
      const res = await http.post("/system/ai-help", { message: userMsg });
      setMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      toast.error("AI sedang sibuk, coba lagi nanti.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div 
      className="fixed bottom-[130px] md:bottom-[110px] right-4 md:right-6 z-[10000] w-[calc(100%-32px)] md:w-[400px] animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 ease-out"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#1A1B26] rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#24283B] overflow-hidden flex flex-col max-h-[550px]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading text-lg font-bold text-white">Contact Support</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#24283B] transition-colors">
            <X className="w-5 h-5 text-[#A0A2B1]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 mb-4">
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

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
          {activeTab === "support" && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <h3 className="text-sm font-bold text-white">Contact Options</h3>
              <a href="https://t.me/adminschoolyai" target="_blank" className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] hover:border-[#363B54] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#0088CC] grid place-items-center shrink-0"><Send className="w-5 h-5 text-white" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Telegram</div>
                  <div className="text-xs text-[#646675]">Quick chat support</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#363B54] group-hover:text-[#A9B1D6]" />
              </a>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] opacity-60">
                <div className="w-10 h-10 rounded-lg bg-[#25D366] grid place-items-center shrink-0"><Phone className="w-5 h-5 text-white" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">WhatsApp</div>
                  <div className="text-xs text-[#646675]">Now inactive (suspend)</div>
                </div>
              </div>
              <a href="mailto:admin@cindigital.id" className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] hover:border-[#363B54] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#E54D52] grid place-items-center shrink-0"><Mail className="w-5 h-5 text-white" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Email</div>
                  <div className="text-xs text-[#646675]">admin@cindigital.id</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#363B54] group-hover:text-[#A9B1D6]" />
              </a>
              <div className="flex items-center gap-2 pt-1 text-xs text-[#646675]"><Clock className="w-3.5 h-3.5" />Aktif: 09:00 - 21:00 ( kecuali kamis/jumat )</div>
              
              <div className="mt-4 pt-3 border-t border-[#24283B] space-y-3">
                <h3 className="text-sm font-bold text-white">Lapor Masalah / Bug</h3>
                <textarea className="w-full bg-[#1F2133] border border-[#24283B] p-3 rounded-xl text-sm text-white placeholder:text-[#646675] focus:outline-none focus:ring-2 focus:ring-[#363B54] resize-none" placeholder="Ceritakan masalah kamu..." value={title} onChange={(e) => setTitle(e.target.value)} rows={3} />
                <button onClick={handleReport} disabled={loading || !title.trim()} className="w-full bg-[#1D2D50] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#15223E] transition-colors disabled:opacity-50">{loading ? "Mengirim..." : "Kirim Laporan"}</button>
              </div>
            </div>
          )}

          {activeTab === "channel" && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <h3 className="text-sm font-bold text-white">Community Channel</h3>
              <a href="https://t.me/schoolyai" target="_blank" className="flex items-center gap-3 p-3 rounded-xl bg-[#1F2133] border border-[#24283B] hover:border-[#363B54] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#0088CC] grid place-items-center shrink-0"><Users className="w-5 h-5 text-white" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Telegram Group</div>
                  <div className="text-xs text-[#646675]">Gabung komunitas Schooly AI</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#363B54] group-hover:text-[#A9B1D6]" />
              </a>
            </div>
          )}

          {activeTab === "chatbot" && (
            <div className="flex flex-col h-[350px] animate-in zoom-in-95 duration-300">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.role === "user" 
                        ? "bg-[#1D2D50] text-white rounded-br-none" 
                        : "bg-[#1F2133] text-[#A9B1D6] border border-[#24283B] rounded-bl-none"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#1F2133] border border-[#24283B] p-3 rounded-2xl rounded-bl-none">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[#A0A2B1] rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-[#A0A2B1] rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-[#A0A2B1] rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleAiChat} className="mt-3 flex gap-2">
                <input 
                  className="flex-1 bg-[#1F2133] border border-[#24283B] p-3 rounded-xl text-sm text-white placeholder:text-[#646675] focus:outline-none focus:ring-1 focus:ring-[#1D2D50]" 
                  placeholder="Tanya AI Tutor..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" disabled={aiLoading || !chatInput.trim()} className="w-11 h-11 bg-[#1D2D50] text-white rounded-xl flex items-center justify-center hover:bg-[#15223E] disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
