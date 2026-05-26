import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfile } from "@/lib/api";
import { EDUCATION_LEVELS, MAJORS, hasMajor, gradeOptions, institutionLabel, institutionPlaceholder } from "@/lib/education";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

const ONBOARD_IMG = "https://static.prod-images.emergentagent.com/jobs/3d3d8cf4-e7fe-469a-b338-aababe70dd7b/images/4954b4f392af5f1525c918313b63b33770f6cf778e0fc74ab109a6ef1ccf10db.png";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user?.onboarded || user?.institution_code || user?.enrolled_class || user?.education_level) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const [level, setLevel] = useState("");
  const [major, setMajor] = useState("");
  const [institution, setInstitution] = useState("");
  const [grade, setGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.education_level) setLevel(user.education_level);
      if (user.major) setMajor(user.major);
      if (user.institution) setInstitution(user.institution);
      if (user.current_semester) setGrade(String(user.current_semester));
    }
  }, [user]);

  const showMajor = useMemo(() => hasMajor(level), [level]);
  const majors = MAJORS[level] || [];
  const grades = gradeOptions(level);

  const submit = async (e) => {
    e.preventDefault();
    if (!level || !institution.trim() || !grade) {
      toast.error("Lengkapi semua field"); return;
    }
    if (showMajor && !major) {
      toast.error("Pilih jurusan"); return;
    }
    setSubmitting(true);
    try {
      const updated = await updateProfile({
        education_level: level,
        major: showMajor ? major : null,
        institution: institution.trim(),
        current_semester: parseInt(grade),
      });
      setUser((prev) => ({
        ...prev,
        id: prev?.id || prev?.user_id,
        ...updated,
        onboarded: true,
      }));
      toast.success("Profil berhasil disimpan");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error("Gagal menyimpan profil");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain grid md:grid-cols-2" data-testid="onboarding-page">
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#1D2D50] text-white relative overflow-hidden">
        <div className="flex items-center gap-2.5 relative z-10">
          <GraduationCap className="w-5 h-5 text-[#E5A93C]" />
          <span className="font-heading text-xl">EduScanner AI</span>
        </div>
        <div className="relative z-10">
          <h2 className="font-heading text-3xl lg:text-4xl leading-tight">Atur profil akademik lu.</h2>
          <p className="mt-4 text-sm text-white/70 max-w-sm leading-relaxed">
            Asisten AI akan menyesuaikan tingkat kesulitan, gaya bahasa, dan referensi sesuai jenjang & jurusan lu.
          </p>
        </div>
        <img src={ONBOARD_IMG} alt="" className="absolute right-0 bottom-0 w-2/3 opacity-90 mix-blend-screen" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="onboarding-form">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-3">Langkah 1 dari 1</div>
          <h1 className="font-heading text-3xl text-[#1A1B26]">Halo, mari mulai.</h1>
          <p className="text-sm text-[#646675] mt-2">Bantu kami mengenal latar belakang akademik lu.</p>

          <div className="mt-8 space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Jenjang Pendidikan</Label>
              <Select value={level} onValueChange={(v) => { setLevel(v); setMajor(""); setGrade(""); }}>
                <SelectTrigger data-testid="select-level" className="mt-1.5 bg-white border-[#E2E0D8] h-11">
                  <SelectValue placeholder="Pilih jenjang" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {showMajor && (
              <div className="fade-up">
                <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Jurusan</Label>
                <Select value={major} onValueChange={setMajor}>
                  <SelectTrigger data-testid="select-major" className="mt-1.5 bg-white border-[#E2E0D8] h-11">
                    <SelectValue placeholder="Pilih jurusan" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {majors.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">{institutionLabel(level || "SMA")}</Label>
              <Input
                data-testid="input-institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={institutionPlaceholder(level || "SMA")}
                className="mt-1.5 bg-white border-[#E2E0D8] h-11"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">
                {level === "Universitas" ? "Semester" : "Kelas"}
              </Label>
              <Select value={grade} onValueChange={setGrade} disabled={!level}>
                <SelectTrigger data-testid="select-grade" className="mt-1.5 bg-white border-[#E2E0D8] h-11">
                  <SelectValue placeholder={level ? (level === "Universitas" ? "Pilih semester" : "Pilih kelas") : "Pilih jenjang dulu"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {grades.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            data-testid="onboarding-submit"
            type="submit"
            disabled={submitting}
            className="mt-8 w-full h-12 bg-[#1D2D50] hover:bg-[#15223E] text-white rounded-md"
          >
            {submitting ? "Menyimpan…" : "Lanjut ke Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
