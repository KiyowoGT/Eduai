import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfile } from "@/lib/api";
import { EDUCATION_LEVELS, MAJORS, hasMajor, gradeOptions, institutionLabel, institutionPlaceholder } from "@/lib/education";
import { toast } from "sonner";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [level, setLevel] = useState(user?.education_level || "");
  const [major, setMajor] = useState(user?.major || "");
  const [institution, setInstitution] = useState(user?.institution || "");
  const [grade, setGrade] = useState(user?.current_semester ? String(user.current_semester) : "");
  const [saving, setSaving] = useState(false);

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
      });
      setUser(updated);
      toast.success("Profil diperbarui");
    } catch { toast.error("Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl" data-testid="profile-page">
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
          <div>
            <div className="font-heading text-lg text-[#1A1B26]">{user?.name}</div>
            <div className="text-sm text-[#646675]">{user?.email}</div>
          </div>
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
      </div>
    </div>
  );
}
