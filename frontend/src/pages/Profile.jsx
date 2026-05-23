import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile, updateFriendCode, http } from "@/lib/api";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Copy, Check, Hash, LogOut, User, Mail, School, AtSign, Key, Shield, Building2, Eye, EyeOff
} from "lucide-react";

export default function Profile() {
  const { user, setUser, refresh, logout } = useAuth();
  const navigate = useNavigate();

  const isTeacher = user?.role === "pengajar";
  const isAdmin = isTeacher && user?.title === "kepala_sekolah";
  const isOwner = user?.institution_owner;

  // Personal info
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [saving, setSaving] = useState(false);

  // Friend code (student only)
  const [friendCode, setFriendCode] = useState(user?.friend_code || "");
  const [savingCode, setSavingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Theme
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('theme') || 'system');

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  // Institution (admin)
  const [institutionName, setInstitutionName] = useState(user?.institution || "");
  const [savingInstitution, setSavingInstitution] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setUsername(user.username || "");
      setFriendCode(user.friend_code || "");
      setInstitutionName(user.institution || "");
    }
  }, [user]);

  useEffect(() => {
    const apply = (mode) => {
      if (mode === 'system') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        document.documentElement.classList.toggle('dark', mq.matches);
      } else {
        document.documentElement.classList.toggle('dark', mode === 'dark');
      }
    };
    apply(themeMode);
    localStorage.setItem('theme', themeMode);
  }, [themeMode]);

  // —— Save Profile ——
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ name, username });
      if (updated) setUser((prev) => ({ ...prev, ...updated }));
      toast.success("Profil diperbarui");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memperbarui profil");
    } finally {
      setSaving(false);
    }
  };

  // —— Change Password ——
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Isi password baru dan verifikasi");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Password tidak cocok");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password berhasil diubah");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    } catch (e) {
      toast.error(e?.message || "Gagal mengubah password");
    } finally {
      setSavingPassword(false);
    }
  };

  // —— Toggle 2FA ——
  const handleToggle2FA = async () => {
    setToggling2FA(true);
    try {
      if (!twoFactorEnabled) {
        const { error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        setTwoFactorEnabled(true);
        toast.success("Verifikasi dua langkah diaktifkan");
      } else {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.all?.find((f) => f.factor_type === 'totp');
        if (totp) {
          const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
          if (error) throw error;
        }
        setTwoFactorEnabled(false);
        toast.success("Verifikasi dua langkah dinonaktifkan");
      }
    } catch (e) {
      toast.error(e?.message || "Gagal mengubah pengaturan 2FA");
    } finally {
      setToggling2FA(false);
    }
  };

  // —— Save Institution ——
  const handleSaveInstitution = async () => {
    if (!institutionName.trim()) {
      toast.error("Nama institusi tidak boleh kosong");
      return;
    }
    setSavingInstitution(true);
    try {
      await http.put("/admin/institution", { name: institutionName.trim() });
      setUser((prev) => ({ ...prev, institution: institutionName.trim() }));
      toast.success("Nama institusi diperbarui");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memperbarui institusi");
    } finally {
      setSavingInstitution(false);
    }
  };

  // —— Copy Friend Code ——
  const handleCopyCode = () => {
    navigator.clipboard.writeText(`eduai://friend/${friendCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCode = async () => {
    setSavingCode(true);
    try {
      await updateFriendCode(friendCode);
      toast.success("Kode teman diperbarui");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memperbarui kode teman");
    } finally {
      setSavingCode(false);
    }
  };

  const inputClass = "w-full pl-11 pr-4 py-2.5 rounded-xl border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 transition-all";

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">
          {isAdmin ? "Super Admin" : isTeacher ? "Portal Guru" : "Akun"}
        </div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Profil & Pengaturan</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-[#1D2D50] grid place-items-center text-xl font-bold text-[#E5A93C] shrink-0">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div>
            <div className="font-heading text-xl text-[#1A1B26]">{user?.name}</div>
            <div className="text-sm text-[#646675] flex items-center gap-2 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {user?.email}
            </div>
            {isTeacher && (
              <div className="text-xs text-[#A0A2B1] mt-1">
                {user?.institution && `${user.institution} · `}
                {isAdmin ? "Kepala Sekolah" : user?.title}
                {user?.assigned_class && ` · ${user.assigned_class}`}
                {user?.assigned_subject && ` · ${user.assigned_subject}`}
              </div>
            )}
            {!isTeacher && (
              <div className="text-xs text-[#A0A2B1] mt-1">
                {user?.education_level}{user?.major ? ` · ${user.major}` : ""}
                {user?.institution ? ` · ${user.institution}` : ""}
                {user?.current_semester ? ` · ${user.education_level === "Universitas" ? `Sem ${user.current_semester}` : `Kls ${user.current_semester}`}` : ""}
              </div>
            )}
          </div>
        </div>

        {/* Nama & Username */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-10 px-6 rounded-xl text-sm">
            {saving ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        </div>
      </div>

      {/* Institution Settings — Admin only */}
      {isAdmin && isOwner && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
          <h2 className="font-heading text-lg text-[#1A1B26] mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1D2D50]" />
            Data Institusi
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] font-medium mb-1">Nama Sekolah</label>
              <div className="relative">
                <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <Button
              onClick={handleSaveInstitution}
              disabled={savingInstitution}
              className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-10 px-6 rounded-xl text-sm"
            >
              {savingInstitution ? "Menyimpan..." : "Simpan Nama Institusi"}
            </Button>
          </div>
        </div>
      )}

      {/* Change Password — Teacher & Admin */}
      {isTeacher && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
          <h2 className="font-heading text-lg text-[#1A1B26] mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-[#1D2D50]" />
            Ubah Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
              <input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password baru"
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Verifikasi password baru"
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-1.5 text-xs text-[#A0A2B1] hover:text-[#646675] transition-colors"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPasswords ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
            <Button
              type="submit"
              disabled={savingPassword}
              className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-10 px-6 rounded-xl text-sm"
            >
              {savingPassword ? "Menyimpan..." : "Ubah Password"}
            </Button>
          </form>
        </div>
      )}

      {/* 2FA — Admin only */}
      {isAdmin && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
          <h2 className="font-heading text-lg text-[#1A1B26] mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1D2D50]" />
            Keamanan Akun
          </h2>
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8F6F0] border border-[#E2E0D8]">
            <div>
              <div className="text-sm font-medium text-[#1A1B26]">Verifikasi Dua Langkah (2FA)</div>
              <div className="text-xs text-[#646675] mt-0.5">
                Lapisan keamanan tambahan menggunakan kode dari aplikasi authenticator
              </div>
            </div>
            <button
              onClick={handleToggle2FA}
              disabled={toggling2FA}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                twoFactorEnabled ? "bg-[#2D6A4F]" : "bg-[#A0A2B1]"
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                twoFactorEnabled ? "translate-x-6" : "translate-x-0.5"
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Friend Code — Student only */}
      {!isTeacher && (
        <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
          <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Kode Teman</h2>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
              <Input value={friendCode} onChange={(e) => setFriendCode(e.target.value)} placeholder="Kode teman kamu" className="pl-11" />
            </div>
            <Button variant="outline" size="icon" onClick={handleCopyCode} className="shrink-0 border-[#E2E0D8]">
              {copied ? <Check className="w-4 h-4 text-[#2D6A4F]" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button onClick={handleSaveCode} disabled={savingCode} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-10 px-4 rounded-xl text-sm shrink-0">
              {savingCode ? "..." : "Simpan"}
            </Button>
          </div>
        </div>
      )}

      {/* Theme */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6">
        <h2 className="font-heading text-lg text-[#1A1B26] mb-4">Tampilan</h2>
        <div className="flex gap-2">
          {[
            { value: "system", label: "Sistem" },
            { value: "light", label: "Terang" },
            { value: "dark", label: "Gelap" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setThemeMode(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                themeMode === opt.value ? "bg-[#1D2D50] text-white" : "bg-[#F8F6F0] text-[#646675] hover:bg-[#E2E0D8]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6">
        <h2 className="font-heading text-lg text-[#1A1B26] mb-2">Keluar</h2>
        <p className="text-sm text-[#646675] mb-4">Keluar dari sesi aktif Anda di perangkat ini.</p>
        <Button
          onClick={async () => { await logout(); navigate("/", { replace: true }); }}
          variant="outline"
          className="text-[#B83A4B] border-[#B83A4B]/30 hover:bg-[#B83A4B]/5 hover:text-[#B83A4B] h-10 px-6 rounded-xl"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Keluar
        </Button>
      </div>
    </div>
  );
}


