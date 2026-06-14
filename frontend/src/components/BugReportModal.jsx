import { useState } from "react";
import { 
  Headset, Users, Sparkles, X, Send, Phone, Mail, Clock, 
  GraduationCap, BookOpen, ChevronRight, MessageSquare, Bot 
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed bottom-[110px] md:bottom-[90px] right-4 md:right-6 z-[10000] w-[calc(100%-32px)] md:w-[400px] animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 ease-out"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#2563EB]" />
              </div>
              <h2 className="font-heading text-xl font-bold text-slate-900 tracking-tight">EduAI Help Center</h2>
            </div>
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
        <div className="p-5 max-h-[400px] overflow-y-auto custom-scrollbar">
          {/* Support & Channels Content */}
          {(activeTab === "support" || activeTab === "channels") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400">Contact Options</h3>
              </div>

              <a href="https://t.me/adminschoolyai" target="_blank" className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#2563EB]/30 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#0088CC] flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[15px] font-bold text-slate-900">Telegram Support</div>
                  <div className="text-xs text-slate-500 text-left">Quick response from support</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB]" />
              </a>

              <a href="mailto:admin@eduai.id" className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#2563EB]/30 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#2563EB] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[15px] font-bold text-slate-900">Email Support</div>
                  <div className="text-xs text-slate-500 text-left">admin@eduai.id</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB]" />
              </a>
            </div>
          )}

          {/* AI Assistant Content */}
          {activeTab === "ai" && (
            <div className="animate-in zoom-in-95 duration-300">
              <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Ask EduAI Assistant</h3>
                  <p className="text-blue-100 text-sm mb-5">Get instant help with your learning.</p>
                  <a href="/chat" className="flex items-center justify-center gap-2 w-full bg-white text-[#2563EB] py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
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
          <div className="flex items-center gap-4 py-3 px-4 rounded-2xl bg-slate-50 border border-slate-100">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <div className="text-[11px] font-semibold text-slate-700">
              09:00 – 21:00 WIB <span className="text-slate-400">(except Thu & Fri)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
