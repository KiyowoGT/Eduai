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
      className="fixed bottom-[140px] md:bottom-[120px] right-4 md:right-6 z-[10000] w-[calc(100%-32px)] md:w-[400px] animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 ease-out"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Pake class bg-[#F8F6F0] dan text-[#1A1B26] yang di-override dark: untuk memaksa warnanya tetep light theme */}
      <div className="bg-[#F8F6F0] dark:bg-[#F8F6F0] rounded-[24px] shadow-[0_20px_50px_rgba(26,27,38,0.25)] border border-[#E2E0D8] dark:border-[#E2E0D8] overflow-hidden text-[#1A1B26] dark:text-[#1A1B26]">
        
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-[#F8F6F0] to-[#EFEBE0] dark:from-[#F8F6F0] dark:to-[#EFEBE0] border-b border-[#E2E0D8] dark:border-[#E2E0D8]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1D2D50] dark:bg-[#1D2D50] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#E5A93C] dark:text-[#E5A93C]" />
              </div>
              <h2 className="font-heading text-xl font-bold text-[#1A1B26] dark:text-[#1A1B26] tracking-tight">EduAI Help Center</h2>
            </div>
          </div>
          <p className="text-sm text-[#646675] dark:text-[#646675] leading-relaxed">
            Need help? Contact our team or ask EduAI Assistant.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-2 bg-[#EFEBE0]/60 dark:bg-[#EFEBE0]/60 border-b border-[#E2E0D8] dark:border-[#E2E0D8]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#F8F6F0] dark:bg-[#F8F6F0] text-[#1D2D50] dark:text-[#1D2D50] shadow-sm ring-1 ring-[#E2E0D8] dark:ring-[#E2E0D8]"
                    : "text-[#646675] dark:text-[#646675] hover:text-[#1A1B26] dark:hover:text-[#1A1B26] hover:bg-[#F8F6F0]/50 dark:hover:bg-[#F8F6F0]/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#1D2D50] dark:text-[#1D2D50]" : "text-[#A0A2B1] dark:text-[#A0A2B1]"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-5 max-h-[400px] overflow-y-auto custom-scrollbar bg-[#F8F6F0] dark:bg-[#F8F6F0]">
          {/* Support & Channels Content */}
          {(activeTab === "support" || activeTab === "channels") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#A0A2B1] dark:text-[#A0A2B1]">Contact Options</h3>
              </div>

              <a href="https://t.me/adminschoolyai" target="_blank" className="group flex items-center gap-4 p-4 rounded-2xl border border-[#E2E0D8] dark:border-[#E2E0D8] bg-[#F8F6F0] dark:bg-[#F8F6F0] hover:border-[#1D2D50]/30 dark:hover:border-[#1D2D50]/30 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#0088CC] flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[15px] font-bold text-[#1A1B26] dark:text-[#1A1B26]">Telegram Support</div>
                  <div className="text-xs text-[#646675] dark:text-[#646675] text-left">Quick response from support</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A0A2B1] dark:text-[#A0A2B1] group-hover:text-[#1D2D50] dark:group-hover:text-[#1D2D50]" />
              </a>

              <a href="mailto:admin@eduai.id" className="group flex items-center gap-4 p-4 rounded-2xl border border-[#E2E0D8] dark:border-[#E2E0D8] bg-[#F8F6F0] dark:bg-[#F8F6F0] hover:border-[#1D2D50]/30 dark:hover:border-[#1D2D50]/30 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#1D2D50] dark:bg-[#1D2D50] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[15px] font-bold text-[#1A1B26] dark:text-[#1A1B26]">Email Support</div>
                  <div className="text-xs text-[#646675] dark:text-[#646675] text-left">admin@eduai.id</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A0A2B1] dark:text-[#A0A2B1] group-hover:text-[#1D2D50] dark:group-hover:text-[#1D2D50]" />
              </a>
            </div>
          )}

          {/* AI Assistant Content */}
          {activeTab === "ai" && (
            <div className="animate-in zoom-in-95 duration-300">
              <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1D2D50] to-[#4F46E5] text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-full bg-[#E5A93C]/20 backdrop-blur-md flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6 text-[#E5A93C]" />
                  </div>
                  <h3 className="text-xl font-bold mb-1 text-white">Ask EduAI Assistant</h3>
                  <p className="text-blue-100 text-sm mb-5">Get instant help with your learning.</p>
                  <a href="/chat" className="flex items-center justify-center gap-2 w-full bg-[#E5A93C] text-[#1A1B26] py-3 rounded-xl font-bold text-sm hover:bg-[#D49A2E] transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Start AI Conversation
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 bg-[#F8F6F0] dark:bg-[#F8F6F0]">
          <div className="flex items-center gap-4 py-3 px-4 rounded-2xl bg-[#EFEBE0]/60 dark:bg-[#EFEBE0]/60 border border-[#E2E0D8] dark:border-[#E2E0D8]">
            <Clock className="w-4 h-4 text-[#1D2D50] dark:text-[#1D2D50]" />
            <div className="text-[11px] font-semibold text-[#1A1B26] dark:text-[#1A1B26]">
              09:00 – 21:00 WIB <span className="text-[#A0A2B1] dark:text-[#A0A2B1] font-normal">(except Thu & Fri)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
