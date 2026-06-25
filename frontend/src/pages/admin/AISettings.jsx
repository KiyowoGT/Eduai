import { useState, useEffect } from "react";
import { http } from "@/lib/api";
import { Brain, Key, Globe, Save, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { RefreshCw } from "lucide-react";
import DualLoader from "@/components/DualLoader";
import { toast } from "sonner";

export default function AISettings() {
  const [config, setConfig] = useState({ base_url: "", api_key: "", gemini_model: "", groq_model: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    http.get("/admin/ai-config")
      .then((r) => setConfig(r.data))
      .catch(() => toast.error("Gagal memuat konfigurasi AI"))
      .finally(() => setLoading(false));
  }, []);

  const update = (field, val) => setConfig((prev) => ({ ...prev, [field]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await http.post("/admin/ai-config", config);
      toast.success("Konfigurasi AI tersimpan!");
      setTestResult(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const restartBackend = async () => {
    try {
      await http.post("/admin/restart");
      toast.success("Backend di-restart...");
    } catch {
      toast.error("Restart gagal, lakukan manual: systemctl --user restart eduai-backend.service");
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await http.post("/admin/ai-config/test", {
        base_url: config.base_url,
        api_key: config.api_key,
        model: config.gemini_model,
      });
      setTestResult(r.data.ok ? "success" : "failed");
      toast[r.data.ok ? "success" : "error"](r.data.ok ? "Koneksi berhasil! 🚀" : "Koneksi gagal: " + (r.data.error || "unknown"));
    } catch (e) {
      setTestResult("failed");
      toast.error("Gagal connect: " + (e?.response?.data?.detail || e.message));
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <DualLoader type="system" text="Memuat konfigurasi AI..." />;

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">System Operations</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Pengaturan AI</h1>
        <p className="text-sm text-[#646675] mt-1.5">Konfigurasi endpoint dan API key untuk layanan AI Schooly</p>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Base URL */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-[#1D2D50]" />
            <label className="text-sm font-medium text-[#1A1B26]">Base URL</label>
          </div>
          <p className="text-[10px] text-[#A0A2B1] mb-3">Endpoint backend AI gateway</p>
          <input
            value={config.base_url}
            onChange={(e) => update("base_url", e.target.value)}
            placeholder="https://cachyos-x8664-1.tail30e3e2.ts.net/v1"
            className="w-full px-4 py-2.5 border border-[#E2E0D8] rounded-md text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 focus:border-[#1D2D50] bg-white font-mono text-xs"
          />
        </div>

        {/* API Key */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[#E5A93C]" />
            <label className="text-sm font-medium text-[#1A1B26]">API Key</label>
          </div>
          <p className="text-[10px] text-[#A0A2B1] mb-3">API key untuk akses ke gateway AI</p>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={config.api_key}
              onChange={(e) => update("api_key", e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 border border-[#E2E0D8] rounded-md text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 focus:border-[#1D2D50] bg-white font-mono text-xs pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A2B1] hover:text-[#1A1B26]"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Models */}
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-[#2D6A4F]" />
            <label className="text-sm font-medium text-[#1A1B26]">Model AI</label>
          </div>
          <p className="text-[10px] text-[#A0A2B1] mb-3">Nama model untuk chat dan analisis</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#A0A2B1] block mb-1">Chat model</label>
              <input
                value={config.gemini_model}
                onChange={(e) => update("gemini_model", e.target.value)}
                placeholder="ag/gemini-3-flash"
                className="w-full px-4 py-2.5 border border-[#E2E0D8] rounded-md text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#A0A2B1] block mb-1">Backup model (Groq)</label>
              <input
                value={config.groq_model}
                onChange={(e) => update("groq_model", e.target.value)}
                placeholder="ag/gemini-3-flash"
                className="w-full px-4 py-2.5 border border-[#E2E0D8] rounded-md text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 bg-white font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 items-center pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1D2D50] text-white text-sm font-medium rounded-lg hover:bg-[#15223E] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>

          <button
            onClick={testConnection}
            disabled={testing}
            className="flex items-center gap-2 px-6 py-2.5 border border-[#1D2D50] text-[#1D2D50] text-sm font-medium rounded-lg hover:bg-[#1D2D50]/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Menguji..." : "Uji Koneksi"}
          </button>

          <button
            onClick={restartBackend}
            className="flex items-center gap-2 px-6 py-2.5 border border-[#B83A4B] text-[#B83A4B] text-sm font-medium rounded-lg hover:bg-[#B83A4B]/5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Restart Backend
          </button>
        </div>

        {/* Status indicator */}
        {testResult && (
          <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${testResult === "success" ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : "bg-[#B83A4B]/10 text-[#B83A4B]"}`}>
            {testResult === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {testResult === "success" ? "Koneksi ke gateway AI berhasil!" : "Koneksi gagal — periksa URL atau API key"}
          </div>
        )}
      </div>
    </div>
  );
}
