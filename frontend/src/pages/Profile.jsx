import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfile, updateFriendCode } from "@/lib/api";
import { EDUCATION_LEVELS, MAJORS, hasMajor, gradeOptions, institutionLabel, institutionPlaceholder } from "@/lib/education";
import { toast } from "sonner";
import { Copy, Check, Hash, FolderOpen, BrainCircuit, ScrollText, LogOut, BookOpen, CalendarDays } from "lucide-react";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [level, setLevel] = useState(user?.education_level || "");
  const [major, setMajor] = useState(user?.major || "");
  const [institution, setInstitution] = useState(user?.institution || "");
  const [grade, setGrade] = useState(user?.current_semester ? String(user.current_semester) : "");
  const [saving, setSaving] = useState(false);
  const [friendCode, setFriendCode] = useState(user?.friend_code || "");
  const [editingCode, setEditingCode] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const [cloneVoiceEnabled, setCloneVoiceEnabled] = useState(user?.clone_voice_enabled || false);
  const [cloneVoiceUrl, setCloneVoiceUrl] = useState(user?.clone_voice_url || "");

  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  useEffect(() => {
    if (user) {
      setLevel(user.education_level || "");
      setMajor(user.major || "");
      setInstitution(user.institution || "");
      setGrade(user.current_semester ? String(user.current_semester) : "");
      setFriendCode(user.friend_code || "");
      setCloneVoiceEnabled(user.clone_voice_enabled || false);
      setCloneVoiceUrl(user.clone_voice_url || "");
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

  const showMajor = useMemo(() => hasMajor(level), [level]);
  const majors = MAJORS[level] || [];
  const grades = gradeOptions(level);

  const save = async () => {
    if (!level || !institution.trim() || !grade) { toast.error("Lengkapi semua field"); return; }
    if (showMajor && !major) { toast.error("Pilih jurusan"); return; }
    setSaving(true);
    try {
      const updated = await updateProfile({
        education_level: level,
        major: showMajor ? major : null,
        institution: institution.trim(),
        current_semester: parseInt(grade),
        clone_voice_enabled: cloneVoiceEnabled,
        clone_voice_url: cloneVoiceUrl.trim(),
      });
      setUser(updated);
      toast.success("Profil diperbarui");
    } catch { toast.error("Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user?.friend_code || friendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveFriendCode = async () => {
    if (!friendCode.trim()) { toast.error("Friend code tidak boleh kosong"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(friendCode.trim())) { toast.error("3-20 karakter, hanya huruf/angka/underscore"); return; }
    setSavingCode(true);
    try {
      const res = await updateFriendCode(friendCode.trim());
      setUser({ ...user, friend_code: res.friend_code });
      setEditingCode(false);
      toast.success("Friend code diperbarui");
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal menyimpan"); }
    finally { setSavingCode(false); }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="w-full" data-testid="profile-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Akun</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Profil Akademik</h1>
      </div>

      <div className="bg-white border border-[#E2E0D8] rounded-xl p-7 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-[#E2E0D8]">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#1D2D50] text-[#E5A93C] grid place-items-center font-heading text-xl">{user?.name?.[0]?.toUpperCase()}</div>
          )}
          <div className="flex-1">
            <div className="font-heading text-lg text-[#1A1B26]">{user?.name}</div>
            <div className="text-sm text-[#646675]">{user?.email}</div>
          </div>
        </div>

        {/* Friend Code */}
        <div className="bg-[#F8F6F0] rounded-xl p-4 border border-[#E2E0D8]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-[#A0A2B1] flex items-center gap-1.5 mb-1">
                <Hash className="w-3 h-3" /> Friend Code
              </div>
              {editingCode ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={friendCode}
                    onChange={(e) => setFriendCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="bg-white border-[#E2E0D8] h-9 text-sm font-mono w-48"
                    maxLength={20}
                    placeholder="contoh: syahid4821"
                    autoFocus
                  />
                  <Button size="sm" onClick={saveFriendCode} disabled={savingCode} className="bg-[#1D2D50] text-white h-9 px-3 text-xs">
                    {savingCode ? "..." : "Simpan"}
                  </Button>
                  <Button size="sm" onClick={() => { setEditingCode(false); setFriendCode(user?.friend_code || ""); }} variant="outline" className="h-9 px-3 text-xs">
                    Batal
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-[#1D2D50]">{user?.friend_code || friendCode || "-"}</span>
                  <button onClick={copyCode} className="text-[#A0A2B1] hover:text-[#1D2D50]" title="Salin">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditingCode(true); setFriendCode(user?.friend_code || ""); }} className="text-[10px] text-[#1D2D50] hover:underline ml-1">
                    Ubah
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-[#A0A2B1] mt-1">Bagikan kode ini ke teman agar bisa menemukanmu</div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Jenjang Pendidikan</Label>
          <Select value={level} onValueChange={(v) => { setLevel(v); if (!MAJORS[v]?.includes(major)) setMajor(""); setGrade(""); }}>
            <SelectTrigger data-testid="profile-level" className="mt-1.5 bg-white border-[#E2E0D8] h-11"><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
            <SelectContent>{EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {showMajor && (
          <div>
            <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Jurusan</Label>
            <Select value={major} onValueChange={setMajor}>
              <SelectTrigger data-testid="profile-major" className="mt-1.5 bg-white border-[#E2E0D8] h-11"><SelectValue placeholder="Pilih jurusan" /></SelectTrigger>
              <SelectContent className="max-h-72">{majors.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">{institutionLabel(level || "SMA")}</Label>
          <Input data-testid="profile-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder={institutionPlaceholder(level || "SMA")} className="mt-1.5 bg-white border-[#E2E0D8] h-11" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">{level === "Universitas" ? "Semester" : "Kelas"}</Label>
          <Select value={grade} onValueChange={setGrade} disabled={!level}>
            <SelectTrigger data-testid="profile-grade" className="mt-1.5 bg-white border-[#E2E0D8] h-11"><SelectValue placeholder={level ? (level === "Universitas" ? "Pilih semester" : "Pilih kelas") : "Pilih jenjang dulu"} /></SelectTrigger>
            <SelectContent className="max-h-72">{grades.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Button data-testid="profile-save" onClick={save} disabled={saving} className="bg-[#1D2D50] hover:bg-[#15223E] text-white h-11 px-6">
          {saving ? "Menyimpan…" : "Simpan Perubahan"}
        </Button>

        {/* Voice Cloning Settings */}
        <div className="py-5 border-t border-[#E2E0D8] mt-4 space-y-4">
          <div>
            <div className="text-sm font-bold text-[#1A1B26]">Voice Cloning (Chatterbox AI)</div>
            <div className="text-xs text-[#646675] mt-0.5">Kloning suara Anda sendiri untuk membacakan seluruh rangkuman dan dokumen audio.</div>
          </div>
          
          <div className="space-y-3 bg-[#F8F6F0] rounded-xl p-4 border border-[#E2E0D8]">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#1D2D50]">Aktifkan Kloning Suara</span>
                <span className="text-[10px] text-[#A0A2B1]">Gunakan Chatterbox AI sebagai pengganti suara default</span>
              </div>
              <input
                type="checkbox"
                checked={cloneVoiceEnabled}
                onChange={(e) => setCloneVoiceEnabled(e.target.checked)}
                className="w-4 h-4 text-[#1D2D50] border-[#E2E0D8] rounded focus:ring-[#1D2D50]"
              />
            </div>
            
            {cloneVoiceEnabled && (
              <div className="space-y-1.5 pt-2 border-t border-[#E2E0D8]/60 fade-up">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-[#646675]">URL Sampel Suara (.wav)</Label>
                <Input
                  value={cloneVoiceUrl}
                  onChange={(e) => setCloneVoiceUrl(e.target.value)}
                  placeholder="https://example.com/suara-saya.wav"
                  className="bg-white border-[#E2E0D8] h-9 text-xs"
                />
                <div className="text-[9px] text-[#A0A2B1]">
                  Masukkan link URL publik file rekaman suara WAV Anda (durasi disarankan 5-15 detik).
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Learning Settings Summary */}
        <div className="py-5 border-t border-[#E2E0D8] mt-4 space-y-4">
          <div>
            <div className="text-sm font-bold text-[#1A1B26]">Data Pembelajaran</div>
            <div className="text-xs text-[#646675] mt-0.5">Ringkasan mata pelajaran, jadwal, dan preferensi AI dari database lama Anda.</div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8F6F0] rounded-xl p-4 border border-[#E2E0D8]">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A0A2B1] mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Mata Pelajaran
              </div>
              <div className="text-xl font-heading text-[#1D2D50]">{user?.subjects?.length || 0} Mapel</div>
            </div>
            <div className="bg-[#F8F6F0] rounded-xl p-4 border border-[#E2E0D8]">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A0A2B1] mb-1.5 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Jadwal Belajar
              </div>
              <div className="text-xl font-heading text-[#1D2D50]">{user?.schedule?.length || 0} Sesi</div>
            </div>
            <div className="col-span-2 bg-[#F8F6F0] rounded-xl p-4 border border-[#E2E0D8]">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A0A2B1] mb-1.5 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" /> Metode Mengajar AI
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {user?.teaching_methods?.length ? user.teaching_methods.map(m => (
                  <span key={m} className="px-2 py-1 bg-white border border-[#E2E0D8] text-[#1D2D50] text-xs rounded-md shadow-sm capitalize">
                    {m.replace('_', ' ')}
                  </span>
                )) : <span className="text-sm text-[#A0A2B1] italic">Belum diatur</span>}
              </div>
            </div>
          </div>
          <Button variant="outline" className="w-full h-11 border-[#E2E0D8] text-[#1D2D50] font-medium" onClick={() => navigate('/pengaturan-belajar')}>
            Kelola Pengaturan Belajar
          </Button>
        </div>

        {/* Theme Toggle */}
        <div className="py-4 border-t border-[#E2E0D8] mt-4">
          <div className="text-sm font-medium mb-1">Tampilan</div>
          <div className="text-xs text-[#646675] mb-3">Ikuti pengaturan sistem atau pilih manual</div>
          <div className="flex gap-1.5 bg-[#F8F6F0] rounded-lg p-1">
            {[
              { value: 'system', label: 'System', icon: 'Monitor' },
              { value: 'light', label: 'Terang', icon: 'Sun' },
              { value: 'dark', label: 'Gelap', icon: 'Moon' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThemeMode(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-all ${
                  themeMode === opt.value
                    ? 'bg-white text-[#1D2D50] shadow-sm'
                    : 'text-[#646675] hover:text-[#1A1B26]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Additional pages for mobile quick access */}
        <div className="mt-8 pt-6 border-t border-[#E2E0D8] md:hidden">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-3">Lainnya</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start" onClick={() => navigate('/folder')}>
              <FolderOpen className="w-4 h-4 mr-2" /> Folder
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/riwayat-kuis')}>
              <BrainCircuit className="w-4 h-4 mr-2" /> Riwayat Kuis
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/audit-log')}>
              <ScrollText className="w-4 h-4 mr-2" /> Audit Log
            </Button>
            <Button variant="outline" className="justify-start text-[#B83A4B] hover:bg-[#B83A4B]/5" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Keluar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
