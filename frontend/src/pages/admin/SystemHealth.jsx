import { useState, useEffect } from "react";
import { Activity, Cpu, HardDrive, Wifi } from "lucide-react";

function SparkBar({ data, color }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-14 w-full">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t-sm ${color}`}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

export default function SystemHealth() {
  const [trafficHistory, setTrafficHistory] = useState(() =>
    Array.from({ length: 40 }, () => Math.floor(Math.random() * 80 + 20))
  );

  useEffect(() => {
    const t = setInterval(() => {
      setTrafficHistory((prev) => [...prev.slice(1), Math.floor(Math.random() * 80 + 20)]);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const services = [
    { title: "API Backend", status: "Healthy", latency: "45ms", icon: Activity },
    { title: "Database MongoDB", status: "Healthy", latency: "12ms", icon: HardDrive },
    { title: "Kafka Broker", status: "Healthy", latency: "8ms", icon: Wifi },
    { title: "RVC AI Worker", status: "Healthy", latency: "120ms", icon: Cpu },
  ];

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">System Operations</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Server Health</h1>
        <p className="text-sm text-[#646675] mt-1.5">Status infrastruktur Schooly AI secara real-time</p>
      </div>

      {/* Traffic Monitoring Section */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6 hover:border-[#1D2D50]/20 transition-colors">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-medium text-[#1A1B26]">API Request Volume</h3>
            <p className="text-xs text-[#646675] mt-0.5">Real-time API requests per 2 seconds</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-[#1A1B26]">{trafficHistory[trafficHistory.length - 1]}</span>
            <span className="text-xs text-[#646675] ml-1">req/mnt</span>
          </div>
        </div>
        <SparkBar data={trafficHistory} color="bg-[#1D2D50]" />
      </div>

      {/* Infrastructure Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {services.map((s) => (
          <div key={s.title} className="bg-white border border-[#E2E0D8] rounded-xl p-5 flex items-center gap-4 hover:border-[#1D2D50]/20 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-[#2D6A4F]/10 grid place-items-center shrink-0">
              <s.icon className="w-5 h-5 text-[#2D6A4F]" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[#1A1B26]">{s.title}</div>
              <div className="text-xs text-[#646675] mt-0.5">Latency: {s.latency}</div>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F] font-bold uppercase tracking-wider">
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
