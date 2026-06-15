import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Bot, Cpu, Users, Bug, ArrowUpRight } from "lucide-react";
import { http } from "@/lib/api";

function SparkBar({ data, color }) {
  const max = Math.max(...data, 100);
  return (
    <div className="flex items-end gap-[2px] h-10">
      {data.slice(-20).map((v, i) => (
        <div
          key={i}
          className={`w-2 rounded-t-sm ${color}`}
          style={{ height: `${Math.min((v / max) * 100, 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ cpu: 0, ram_used_gb: 0, ram_total_gb: 0, disk_free_gb: 0, req_24h: 0 });
  const [userCount, setUserCount] = useState(0);
  const [bugCount, setBugCount] = useState(0);
  const [traffic, setTraffic] = useState(Array(20).fill(0));
  const [aiUsage, setAiUsage] = useState(Array(20).fill(0));

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // System stats (CPU, RAM, disk, requests)
        const { data: s } = await http.get("/admin/system-stats");
        setStats(s);
        setTraffic(prev => [...prev.slice(1), s.cpu]);

        // Users count from system stats
        try {
          const { data: s } = await http.get("/admin/system-stats");
          setUserCount(s.user_count || 0);
        } catch { /* admin only */ }

        // Bugs count
        try {
          const { data: bugs } = await http.get("/admin/bugs");
          setBugCount(Array.isArray(bugs) ? bugs.filter(b => b.status !== "Fixed").length : 0);
        } catch { /* admin only */ }

        // AI health check (as proxy for activity)
        const { data: ai } = await http.get("/diag/kafka");
        setAiUsage(prev => [...prev.slice(1), ai.ok ? 50 : 0]);
      } catch (e) { console.error("Dashboard fetch error:", e); }
    };
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">System Operations</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Admin Dashboard</h1>
        <p className="text-sm text-[#646675] mt-1.5">Monitoring server & AI usage real-time</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: "Total Users", value: userCount, icon: Users, color: "bg-[#1D2D50] text-white" },
          { label: "CPU Usage", value: `${stats.cpu}%`, icon: Activity, color: "bg-[#2D6A4F] text-white" },
          { label: "Active Bugs", value: bugCount, icon: Bug, color: "bg-[#B83A4B] text-white" },
          { label: "RAM Used", value: `${stats.ram_used_gb} GB`, icon: Cpu, color: "bg-[#E5A93C] text-[#1A1B26]" },
        ].map((s) => (
          <div key={s.label} className="card-lift bg-white border border-[#E2E0D8] rounded-xl p-5 hover:border-[#1D2D50]/20 transition-colors">
            <div className={`w-8 h-8 rounded-lg grid place-items-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-xs text-[#646675] font-medium uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-bold text-[#1A1B26] mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sparklines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* CPU Traffic */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 hover:border-[#1D2D50]/20 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#1D2D50]" />
              <h3 className="font-medium text-[#1A1B26]">CPU Load Realtime</h3>
            </div>
            <button onClick={() => navigate("/admin/system-health")} className="text-xs text-[#1D2D50] flex items-center gap-1 hover:underline">
              Detail <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-[#1A1B26]">{stats.cpu}%</span>
            <span className="text-xs text-[#646675]">saat ini</span>
          </div>
          <SparkBar data={traffic} color="bg-[#1D2D50]" />
        </div>

        {/* AI Usage */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 hover:border-[#1D2D50]/20 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#2D6A4F]" />
              <h3 className="font-medium text-[#1A1B26]">AI Service Health</h3>
            </div>
            <span className="text-xs text-[#646675]">real-time</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-[#1A1B26]">{aiUsage[aiUsage.length - 1] > 0 ? "Online" : "Offline"}</span>
            <span className="text-xs text-[#646675]">Kafka / Gemini</span>
          </div>
          <SparkBar data={aiUsage} color="bg-[#2D6A4F]" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[
          { label: "System Health", desc: "Monitor Kafka, MongoDB, AI endpoints", path: "/admin/system-health", icon: Activity },
          { label: "Bug Tracker", desc: `Ada ${bugCount} bug aktif`, path: "/admin/bug-tracker", icon: Bug },
          { label: "User Management", desc: `Total ${userCount} user terdaftar`, path: "/admin/user-management", icon: Users },
        ].map((a) => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="bg-white border border-[#E2E0D8] rounded-xl p-5 text-left hover:border-[#1D2D50]/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <a.icon className="w-4 h-4 text-[#1D2D50] group-hover:text-[#E5A93C] transition-colors" />
              <div className="font-medium text-[#1A1B26]">{a.label}</div>
            </div>
            <p className="text-xs text-[#646675]">{a.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
