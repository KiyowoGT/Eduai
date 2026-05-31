import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfile, getPersonalityQuestions, submitPersonalityAssessment } from "@/lib/api";
import { EDUCATION_LEVELS, MAJORS, hasMajor, gradeOptions, institutionLabel, institutionPlaceholder } from "@/lib/education";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { GraduationCap, Sparkles } from "lucide-react";

const ONBOARD_IMG = "https://static.prod-images.emergentagent.com/jobs/3d3d8cf4-e7fe-469a-b338-aababe70dd7b/images/4954b4f392af5f1525c918313b63b33770f6cf778e0fc74ab109a6ef1ccf10db.png";

const HOBBIES = [
  { value: "none", label: "Tidak ada (Ringkasan Standar)" },
  { value: "musik", label: "Musik" },
  { value: "olahraga", label: "Olahraga" },
  { value: "membaca", label: "Membaca" },
  { value: "menulis", label: "Menulis / Jurnal" },
  { value: "seni", label: "Seni & Kreatif" },
  { value: "teknologi", label: "Teknologi & Coding" },
  { value: "traveling", label: "Traveling & Eksplorasi" },
  { value: "memasak", label: "Memasak" },
  { value: "fotografi", label: "Fotografi & Videografi" },
  { value: "gaming", label: "Gaming" },
  { value: "berkebun", label: "Berkebun" },
  { value: "hewan", label: "Hewan Peliharaan" },
  { value: "sosial", label: "Kegiatan Sosial" },
];

const GENRES = [
  { value: "pop, romantic", label: "Pop Romantic (Default)" },
  { value: "rock, energetic", label: "Rock Energetic" },
  { value: "classical, soothing", label: "Classical Soothing" },
  { value: "hip-hop, rhythmic", label: "Hip-Hop Rhythmic" },
  { value: "electronic, futuristic", label: "Electronic Futuristic" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user?.onboarded || user?.institution_code || user?.enrolled_class || user?.education_level || user?.role === "pengajar") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const [role, setRole] = useState("");
  const [instituteType, setInstituteType] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [level, setLevel] = useState("");
  const [major, setMajor] = useState("");
  const [institution, setInstitution] = useState("");
  const [grade, setGrade] = useState("");
  const [pelajarStep, setPelajarStep] = useState(1);
  const [hobby, setHobby] = useState("");
  const [musicGenre, setMusicGenre] = useState("pop, romantic");
  const [submitting, setSubmitting] = useState(false);

  // Personality assessment
  const [personalityQuestions, setPersonalityQuestions] = useState([]);
  const [personalityAnswers, setPersonalityAnswers] = useState({});
  const [takingAssessment, setTakingAssessment] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role) setRole(user.role);
      if (user.education_level) setLevel(user.education_level);
      if (user.major) setMajor(user.major);
      if (user.institution) setInstitution(user.institution);
      if (user.current_semester) setGrade(String(user.current_semester));
    }
  }, [user]);

  const showMajor = useMemo(() => hasMajor(level), [level]);
  const majors = MAJORS[level] || [];
  const grades = gradeOptions(level);

  const buildPayload = () => {
    if (role === "pengajar") {
      return {
        role: "pengajar",
        full_name: fullName.trim(),
        ...(instituteType === "institut"
          ? { institution: institution.trim(), identity_number: identityNumber.trim() }
          : { username: username.trim() }
        ),
      };
    }
    return {
      role: "pelajar",
      education_level: level,
      major: showMajor ? major : null,
      institution: institution.trim(),
      current_semester: parseInt(grade),
      hobby: hobby === "none" ? "" : hobby,
      ...(hobby === "musik" ? { music_genre: musicGenre } : {}),
    };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (role === "pengajar") {
      if (!fullName.trim()) { toast.error("Lengkapi nama lengkap"); return false; }
      if (instituteType === "institut") {
        if (!identityNumber.trim()) { toast.error("Lengkapi nomor identitas"); return false; }
        if (!institution.trim()) { toast.error("Lengkapi nama institut"); return false; }
      } else {
        if (!username.trim()) { toast.error("Lengkapi username"); return false; }
      }
    } else if (pelajarStep === 1) {
      if (!level || !institution.trim() || !grade) {
        toast.error("Lengkapi semua field"); return false;
      }
      if (showMajor && !major) {
        toast.error("Pilih jurusan"); return false;
      }
      setPelajarStep(2);
      return;
    }
    if (role === "pelajar" && pelajarStep === 2 && !hobby) {
      toast.error("Pilih hobi atau kegiatan"); return;
    }

    // If taking personality assessment, submit answers first
    if (role === "pelajar" && takingAssessment) {
      try {
        setSubmitting(true);
        const resp = await submitPersonalityAssessment(personalityAnswers);
        if (resp?.ok) {
          // merge profile into updated user payload from backend
          const updated = resp.profile || {};
          // Let backend save profile; update local user after updateProfile
        }
      } catch (e) {
        console.error(e);
        toast.error("Gagal menyimpan hasil asesmen kepribadian");
      } finally {
        setSubmitting(false);
      }
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const updated = await updateProfile(payload);
      setUser((prev) => ({
        ...prev,
        id: prev?.id || prev?.user_id,
        ...updated,
        role: role || prev?.role,
        onboarded: true,
      }));
      // If backend returned personality profile from assessment, merge
      try {
        const profileResp = await getPersonalityQuestions();
        // no-op: profile stored server-side; fetch on next session
      } catch (e) {}
      toast.success("Profil berhasil disimpan");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error("Gagal menyimpan profil");
    } finally { setSubmitting(false); }
  };

  const handleRoleSelect = (selected) => {
    setRole(selected);
  };

  const totals = (r) => (r === "pengajar" ? 2 : 2);
  const curStep = (r, it, ps) =>
    !r ? 1
      : r === "pengajar" ? (it ? 2 : 1)
      : ps;

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain grid md:grid-cols-2" data-testid="onboarding-page">
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#1D2D50] text-white relative overflow-hidden">
        <div className="flex items-center gap-2.5 relative z-10">
          {pelajarStep === 2 ? (
            <Sparkles className="w-5 h-5 text-[#E5A93C]" />
          ) : (
            <GraduationCap className="w-5 h-5 text-[#E5A93C]" />
          )}
          <span className="font-heading text-xl">EduScanner AI</span>
        </div>
        <div className="relative z-10">
          <h2 className="font-heading text-3xl lg:text-4xl leading-tight">
            {role === "pengajar"
              ? "Atur profil pengajar."
              : pelajarStep === 2
                ? "Personalisasi pengalaman belajar kamu."
                : "Atur profil akademik lu."}
          </h2>
          <p className="mt-4 text-sm text-white/70 max-w-sm leading-relaxed">
            {role === "pengajar"
              ? "Bantu kami mengenali identitas pengajar untuk pengalaman yang lebih personal."
              : pelajarStep === 2
                ? "Pilih hobi biar AI kasih pengalaman belajar yang lebih personal."
                : "Asisten AI akan menyesuaikan tingkat kesulitan, gaya bahasa, dan referensi sesuai jenjang & jurusan lu."}
          </p>
        </div>
        <img src={ONBOARD_IMG} alt="" className="absolute right-0 bottom-0 w-2/3 opacity-90 mix-blend-screen" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="onboarding-form">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-3">
            Langkah {curStep(role, instituteType, pelajarStep)} dari {totals(role)}
          </div>
          <h1 className="font-heading text-3xl text-[#1A1B26]">
            {pelajarStep === 2 ? "Apa hobi atau kegiatan yang paling kamu suka?" : "Halo, mari mulai."}
          </h1>

          {!role && (
            <>
              <p className="text-sm text-[#646675] mt-2">Kamu seorang?</p>
              <div className="mt-8 space-y-4">
                <Button
                  type="button"
                  onClick={() => handleRoleSelect("pelajar")}
                  className="w-full h-14 bg-white border-2 border-[#E2E0D8] hover:border-[#1D2D50] text-[#1A1B26] text-base rounded-md flex items-center justify-between px-6"
                >
                  <span className="font-medium">Pelajar</span>
                  <span className="text-xs text-[#A0A2B1]">Siswa / Mahasiswa</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => handleRoleSelect("pengajar")}
                  className="w-full h-14 bg-white border-2 border-[#E2E0D8] hover:border-[#1D2D50] text-[#1A1B26] text-base rounded-md flex items-center justify-between px-6"
                >
                  <span className="font-medium">Pengajar</span>
                  <span className="text-xs text-[#A0A2B1]">Guru / Dosen</span>
                </Button>
              </div>
            </>
          )}

          {role === "pelajar" && pelajarStep === 1 && (
            <>
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
            </>
          )}

          {role === "pelajar" && pelajarStep === 2 && (
            <>
              <p className="text-sm text-[#646675] mt-2">
                Pilih hobi favorit biar AI bisa kasih pengalaman belajar yang lebih personal.
              </p>
              <div className="mt-8 space-y-5">
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Hobi / Kegiatan</Label>
                  <Select value={hobby} onValueChange={setHobby}>
                    <SelectTrigger data-testid="select-hobby" className="mt-1.5 bg-white border-[#E2E0D8] h-11">
                      <SelectValue placeholder="Pilih hobi atau kegiatan" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {HOBBIES.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {hobby === "musik" && (
                  <div className="fade-up">
                    <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Genre / Style Musik</Label>
                    <Select value={musicGenre} onValueChange={setMusicGenre}>
                      <SelectTrigger className="mt-1.5 bg-white border-[#E2E0D8] h-11">
                        <SelectValue placeholder="Pilih genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-[#A0A2B1] mt-2">
                      Rangkuman materi ajar akan diolah kembali oleh AI menjadi lirik lagu berirama sesuai genre pilihan kamu!
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {role === "pengajar" && !instituteType && (
            <>
              <p className="text-sm text-[#646675] mt-2">Kamu mengajar dari?</p>
              <div className="mt-8 space-y-4">
                <Button
                  type="button"
                  onClick={() => setInstituteType("institut")}
                  className="w-full h-14 bg-white border-2 border-[#E2E0D8] hover:border-[#1D2D50] text-[#1A1B26] text-base rounded-md flex items-center justify-between px-6"
                >
                  <span className="font-medium">Institut</span>
                  <span className="text-xs text-[#A0A2B1]">Sekolah / Universitas</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setInstituteType("mandiri")}
                  className="w-full h-14 bg-white border-2 border-[#E2E0D8] hover:border-[#1D2D50] text-[#1A1B26] text-base rounded-md flex items-center justify-between px-6"
                >
                  <span className="font-medium">Mandiri</span>
                  <span className="text-xs text-[#A0A2B1]">Guru privat / Les</span>
                </Button>
              </div>
            </>
          )}

          {role === "pengajar" && instituteType && (
            <>
              <p className="text-sm text-[#646675] mt-2">Lengkapi data diri kamu.</p>
              <div className="mt-8 space-y-5">
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Nama Lengkap</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="mt-1.5 bg-white border-[#E2E0D8] h-11"
                  />
                </div>

                {instituteType === "institut" && (
                  <>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Nomor Identitas</Label>
                      <Input
                        value={identityNumber}
                        onChange={(e) => setIdentityNumber(e.target.value)}
                        placeholder="Masukkan nomor identitas"
                        className="mt-1.5 bg-white border-[#E2E0D8] h-11"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Nama Institut</Label>
                      <Input
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="Masukkan nama sekolah / universitas"
                        className="mt-1.5 bg-white border-[#E2E0D8] h-11"
                      />
                    </div>
                  </>
                )}

                {instituteType === "mandiri" && (
                  <div>
                    <Label className="text-xs uppercase tracking-[0.15em] text-[#646675]">Username</Label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username"
                      className="mt-1.5 bg-white border-[#E2E0D8] h-11"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {role && (
            <div className="flex gap-3 mt-8">
              {(role === "pengajar" && instituteType) || (role === "pelajar" && pelajarStep === 1) ? (
                <Button
                  type="button"
                  onClick={() => { setRole(""); setInstituteType(""); setPelajarStep(1); }}
                  variant="outline"
                  className="h-12 px-6 border-[#E2E0D8] text-[#646675]"
                >
                  Kembali
                </Button>
              ) : role === "pelajar" && pelajarStep === 2 ? (
                <Button
                  type="button"
                  onClick={() => setPelajarStep(1)}
                  variant="outline"
                  className="h-12 px-6 border-[#E2E0D8] text-[#646675]"
                >
                  Kembali
                </Button>
              ) : null}
              {(role === "pengajar" ? instituteType : true) && (
                <Button
                  data-testid="onboarding-submit"
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 bg-[#1D2D50] hover:bg-[#15223E] text-white rounded-md"
                >
                  {submitting
                    ? "Menyimpan…"
                    : role === "pelajar" && pelajarStep === 1
                      ? "Lanjut"
                      : "Lanjut ke Dashboard"}
                </Button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
