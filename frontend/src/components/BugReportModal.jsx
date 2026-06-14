import { useState } from "react";
import { 
  Headset, Users, Sparkles, X, Send, Phone, Mail, Clock, 
  GraduationCap, BookOpen, ChevronRight, MessageSquare 
} from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/api";

const TABS = [
  { id: "support", label: "Support", icon: Headset },
  { id: "channels", label: "Channels", icon: Users },
  { id: "ai", label: "AI Assistant", icon: Sparkles },
];

export default function BugReportModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("support");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={onClose}>
      <div
        className="bg-white rounded-t-[24px] md:rounded-[24px] w-full max-w-[400px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden animate-in slide-in-from-bottom-6 duration-500 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#2563EB]" />
              </div>
              <h2 className="font-heading text-xl font-bold text-slate-900 tracking-tight">EduAI Help Center</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-all">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Need help? Contact our team or ask EduAI Assistant.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-2 bg-slate-50/50 border-b border-slate-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-[#2563EB] shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#2563EB]" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Support & Channels Content */}
          {(activeTab === "support" || activeTab === "channels") && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400">Contact Options</h3>
              </div>

              {/* Telegram Card */}
              <a href="https://t.me/adminschoolyai" target="_blank" className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#2563EB]/30 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#0088CC] flex items-center justify-center shrink-0 shadow-lg shadow-[#0088CC]/20 group-hover:scale-105 transition-transform">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-slate-900">Telegram Support</div>
                  <div className="text-xs text-slate-500">Quick response from our support team</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" />
              </a>

              {/* WhatsApp Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 bg-slate-50/50 opacity-60">
                <div className="w-11 h-11 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0 grayscale">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-slate-900">WhatsApp Support</div>
                  <div className="text-xs text-slate-500">Direct customer assistance</div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Inactive</span>
              </div>

              {/* Email Card */}
              <a href="mailto:admin@eduai.id" className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#2563EB]/30 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#2563EB] flex items-center justify-center shrink-0 shadow-lg shadow-[#2563EB]/20 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-slate-900">Email Support</div>
                  <div className="text-xs text-slate-500">admin@eduai.id</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" />
              </a>
            </div>
          )}

          {/* AI Assistant Content */}
          {activeTab === "ai" && (
            <div className="space-y-4 animate-in zoom-in-95 duration-300">
              <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                <Sparkles className="absolute -top-2 -right-2 w-24 h-24 text-white/10 rotate-12" />
                
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Ask EduAI Assistant</h3>
                  <p className="text-blue-100 text-sm mb-5">Get instant help with your learning journey.</p>
                  
                  <div className="space-y-2 mb-6">
                    {['Account issues', 'Learning features', 'Quiz Lab', 'Redeem Codes'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs font-medium bg-white/10 py-1.5 px-3 rounded-full w-fit">
                        <BookOpen className="w-3 h-3" />
                        {item}
                      </div>
                    ))}
                  </div>

                  <a href="/chat" className="flex items-center justify-center gap-2 w-full bg-white text-[#2563EB] py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-50 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Start AI Conversation
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0">
          <div className="flex items-center justify-center gap-4 py-3 px-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Support Hours</div>
              <div className="text-xs font-semibold text-slate-700">09:00 – 21:00 WIB <span className="text-slate-400 font-normal">(except Thu & Fri)</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
