import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

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

const ONBOARD_IMG = "https://static.prod-images.emergentagent.com/jobs/3d3d8cf4-e7fe-469a-b338-aababe70dd7b/images/4954b4f392af5f1525c918313b63b33770f6cf778e0fc74ab109a6ef1ccf10db.png";

export default function HobiOnboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user?.role === "pengajar" || user?.hobby) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const [hobby, setHobby] = useState(user?.hobby || "");
  const [musicGenre, setMusicGenre] = useState("pop, romantic");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      navigate("/dashboard", { replace: true });
    }
  }, [saved, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { hobby: hobby === "none" ? "" : hobby };
      if (hobby === "musik") {
        payload.music_genre = musicGenre;
      }
      const updated = await updateProfile(payload);
      setUser((prev) => ({ ...prev, ...updated }));
      toast.success("Hobi berhasil disimpan");
      setSaved(true);
    } catch (err) {
      toast.error("Gagal menyimpan hobi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain grid md:grid-cols-2" data-testid="hobi-onboarding-page">
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#1D2D50] text-white relative overflow-hidden">
        <div className="flex items-center gap-2.5 relative z-10">
          <Sparkles className="w-5 h-5 text-[#E5A93C]" />
          <span className="font-heading text-xl">EduScanner AI</span>
        </div>
        <div className="relative z-10">
          <h2 className="font-heading text-3xl lg:text-4xl leading-tight">Personalisasi pengalaman belajar kamu.</h2>
          <p className="mt-4 text-sm text-white/70 max-w-sm leading-relaxed">
            AI akan menyesuaikan ringkasan dan gaya belajar berdasarkan hobi & minat kamu.
          </p>
        </div>
        <img src={ONBOARD_IMG} alt="" className="absolute right-0 bottom-0 w-2/3 opacity-90 mix-blend-screen" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="hobi-onboarding-form">
          <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-3">Personalisasi</div>
          <h1 className="font-heading text-3xl text-[#1A1B26]">Apa hobi atau kegiatan yang paling kamu suka?</h1>
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

          <Button
            data-testid="hobi-onboarding-submit"
            type="submit"
            disabled={submitting}
            className="mt-8 w-full h-12 bg-[#1D2D50] hover:bg-[#15223E] text-white rounded-md"
          >
            {submitting ? "Menyimpan..." : "Simpan & Lanjut ke Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
