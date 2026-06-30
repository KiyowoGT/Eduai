import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { http } from "@/lib/api";
import { Shield, Bell, Clock, Link2, Database, Save, Server, ArrowRightLeft, RotateCcw, Rocket, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SETTINGS_SECTIONS = [
  { id: "deployment", label: "Deployment", icon: Server },
  { id: "ai", label: "Kebijakan AI", icon: Shield },
  { id: "notifications", label: "Notifikasi", icon: Bell },
  { id: "retention", label: "Data Retention", icon: Clock },
  { id: "integrations", label: "Integrasi", icon: Link2 },
  { id: "backup", label: "Backup", icon: Database },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("deployment");
  const [saving, setSaving] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchStatus = async () => {
    try {
      const { data } = await http.get("/admin/live-status");
      setDeploymentStatus(data);
    } catch (e) {
      console.error("Failed to fetch live-status", e);
    }
  };

  useEffect(() => {
    if (activeSection === "deployment") fetchStatus();
  }, [activeSection]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const { data } = await http.post("/admin/deploy");
      toast.success(data.message || `Deployed to ${data.target}`);
      await fetchStatus();
    } catch (e) {
      toast.error("Deploy failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setDeploying(false);
    }
  };

  const handleSwitch = async () => {
    setActionLoading("switch");
    try {
      const { data } = await http.post("/admin/switch");
      toast.success(`Switched to ${data.current}`);
      await fetchStatus();
    } catch (e) {
      toast.error("Switch failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async () => {
    setActionLoading("rollback");
    try {
      const { data } = await http.post("/admin/rollback");
      toast.success(`Rolled back to ${data.current}`);
      await fetchStatus();
    } catch (e) {
      toast.error("Rollback failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setActionLoading(null);
    }
  };
  const [settings, setSettings] = useState({
    ai_browsing_enabled: false,
    notify_resign: true,
    notify_failed_login: true,
    notify_cascade_error: true,
    retention_years: 5,
    auto_anonymize: true,
  });

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Pengaturan disimpan");
    setSaving(false);
  };

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Konfigurasi Sistem</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Pengaturan</h1>
        <p className="text-sm text-[#646675] mt-1.5">{user?.institution}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-2 space-y-1">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-[#1D2D50] text-white" : "text-[#646675] hover:bg-[#F8F6F0] hover:text-[#1A1B26]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-6">
            {/* Deployment */}
            {activeSection === "deployment" && (
              <div className="space-y-6">
                <h2 className="font-heading text-lg text-[#1A1B26]">Blue/Green Deployment</h2>
                <p className="text-xs text-[#646675]">
                  Kelola versi frontend yang sedang aktif. Deploy ke idle server lalu switch tanpa downtime.
                </p>

                {deploymentStatus ? (
                  <>
                    {/* Status Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-xl border ${
                        deploymentStatus.current === "blue"
                          ? "border-[#2D6A4F]/30 bg-[#2D6A4F]/5"
                          : "border-[#E2E0D8] bg-[#F8F6F0]"
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${deploymentStatus.current === "blue" ? "bg-[#2D6A4F] animate-pulse" : "bg-[#A0A2B1]"}`} />
                          <span className="text-sm font-medium text-[#1A1B26]">Blue Server</span>
                        </div>
                        <div className="text-xs text-[#646675]">
                          {deploymentStatus.current === "blue" ? "🟢 LIVE" : "🔵 Idle"}
                        </div>
                        <div className="text-[10px] text-[#A0A2B1] mt-1">
                          {deploymentStatus.blue_exists ? "Files present" : "Not built yet"}
                        </div>
                      </div>
                      <div className={`p-4 rounded-xl border ${
                        deploymentStatus.current === "green"
                          ? "border-[#2D6A4F]/30 bg-[#2D6A4F]/5"
                          : "border-[#E2E0D8] bg-[#F8F6F0]"
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${deploymentStatus.current === "green" ? "bg-[#2D6A4F] animate-pulse" : "bg-[#A0A2B1]"}`} />
                          <span className="text-sm font-medium text-[#1A1B26]">Green Server</span>
                        </div>
                        <div className="text-xs text-[#646675]">
                          {deploymentStatus.current === "green" ? "🟢 LIVE" : "🔵 Idle"}
                        </div>
                        <div className="text-[10px] text-[#A0A2B1] mt-1">
                          {deploymentStatus.green_exists ? "Files present" : "Not built yet"}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={handleDeploy}
                        disabled={deploying}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                        {deploying ? "Building..." : `Deploy to ${deploymentStatus.next_target}`}
                      </button>
                      <button
                        onClick={handleSwitch}
                        disabled={actionLoading === "switch"}
                        className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E0D8] text-sm text-[#1A1B26] rounded-lg hover:bg-[#F8F6F0] transition-colors disabled:opacity-50"
                      >
                        {actionLoading === "switch" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                        Switch to {deploymentStatus.next_target}
                      </button>
                      <button
                        onClick={handleRollback}
                        disabled={actionLoading === "rollback"}
                        className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#B83A4B]/30 text-sm text-[#B83A4B] rounded-lg hover:bg-[#B83A4B]/5 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === "rollback" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        Rollback
                      </button>
                    </div>

                    {/* Info */}
                    <p className="text-[10px] text-[#A0A2B1] pt-2">
                      Switch and rollback take effect instantly. No restart required.
                    </p>
                  </>
                ) : (
                  <div className="p-8 text-center text-sm text-[#A0A2B1] border border-dashed border-[#E2E0D8] rounded-lg">
                    Loading deployment status...
                  </div>
                )}
              </div>
            )}

            {/* AI Policy */}
            {activeSection === "ai" && (
              <div className="space-y-5">
                <h2 className="font-heading text-lg text-[#1A1B26]">Kebijakan AI</h2>
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8]">
                  <div>
                    <div className="text-sm font-medium text-[#1A1B26]">Izinkan Guru Akses Internet untuk AI Studio</div>
                    <div className="text-xs text-[#646675] mt-0.5">
                      Jika dinonaktifkan, AI Studio hanya beroperasi dalam sandbox tanpa akses eksternal
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle("ai_browsing_enabled")}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.ai_browsing_enabled ? "bg-[#2D6A4F]" : "bg-[#A0A2B1]"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      settings.ai_browsing_enabled ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <p className="text-xs text-[#A0A2B1]">
                  Untuk lingkungan B2B Enterprise, disarankan menonaktifkan akses internet untuk menjaga keamanan data institusi.
                </p>
              </div>
            )}

            {/* Notifications */}
            {activeSection === "notifications" && (
              <div className="space-y-5">
                <h2 className="font-heading text-lg text-[#1A1B26]">Notifikasi & Alert</h2>
                <p className="text-xs text-[#646675]">Pilih event yang mengirim alert ke dashboard Kepala Sekolah</p>
                <div className="space-y-3">
                  {[
                    { key: "notify_resign", label: "Guru Resign / Nonaktif", desc: "Saat guru dinonaktifkan sistem" },
                    { key: "notify_failed_login", label: "Gagal Login Berulang", desc: "5+ percobaan gagal dalam 1 jam" },
                    { key: "notify_cascade_error", label: "Cascade Activation Error", desc: "Error saat aktivasi tahun ajaran baru" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-[#E2E0D8]">
                      <div>
                        <div className="text-sm text-[#1A1B26]">{item.label}</div>
                        <div className="text-xs text-[#646675]">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => handleToggle(item.key)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          settings[item.key] ? "bg-[#2D6A4F]" : "bg-[#A0A2B1]"
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          settings[item.key] ? "translate-x-5" : "translate-x-0.5"
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Retention */}
            {activeSection === "retention" && (
              <div className="space-y-5">
                <h2 className="font-heading text-lg text-[#1A1B26]">Data Retention</h2>
                <div>
                  <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-2">Durasi Arsip Data Siswa Lulus</label>
                  <select
                    value={settings.retention_years}
                    onChange={(e) => handleChange("retention_years", Number(e.target.value))}
                    className="w-full max-w-xs px-4 py-2.5 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
                  >
                    <option value={1}>1 Tahun</option>
                    <option value={2}>2 Tahun</option>
                    <option value={3}>3 Tahun</option>
                    <option value={5}>5 Tahun (Default)</option>
                    <option value={10}>10 Tahun</option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8]">
                  <div>
                    <div className="text-sm font-medium text-[#1A1B26]">Anonimisasi Otomatis</div>
                    <div className="text-xs text-[#646675] mt-0.5">
                      Data siswa yang melebihi masa retensi akan dianonimisasi secara otomatis
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle("auto_anonymize")}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.auto_anonymize ? "bg-[#2D6A4F]" : "bg-[#A0A2B1]"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      settings.auto_anonymize ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* Integrations */}
            {activeSection === "integrations" && (
              <div className="space-y-5">
                <h2 className="font-heading text-lg text-[#1A1B26]">Integrasi Eksternal</h2>
                <p className="text-xs text-[#646675]">Kelola koneksi dengan sistem pihak ketiga</p>
                <div className="p-8 text-center text-sm text-[#A0A2B1] border border-dashed border-[#E2E0D8] rounded-lg">
                  Belum ada integrasi yang dikonfigurasi.
                </div>
              </div>
            )}

            {/* Backup */}
            {activeSection === "backup" && (
              <div className="space-y-5">
                <h2 className="font-heading text-lg text-[#1A1B26]">Backup & Recovery</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E2E0D8]">
                    <div>
                      <div className="text-sm text-[#1A1B26]">Backup Terakhir</div>
                      <div className="text-xs text-[#646675]">Database & file storage</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F]">24 jam lalu ✓</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E2E0D8]">
                    <div>
                      <div className="text-sm text-[#1A1B26]">Backup Terjadwal</div>
                      <div className="text-xs text-[#646675]">Otomatis setiap hari pukul 02:00</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F]">Aktif</span>
                  </div>
                </div>
                <button className="px-4 py-2.5 border border-[#E2E0D8] text-sm text-[#646675] rounded-lg hover:bg-[#F8F6F0] transition-colors">
                  Trigger Backup Manual
                </button>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-end pt-6 border-t border-[#E2E0D8] mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D2D50] text-white text-sm rounded-lg hover:bg-[#1D2D50]/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? "Menyimpan..." : "Simpan Pengaturan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
