import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listTeacherStudents,
  createClassToken,
  listClassTokens,
  deleteClassToken,
  listTeacherMaterialsClasses
} from "@/lib/api";
import { Users, Key, Plus, Trash2, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);

  // Form states for new class token
  const [targetClassRoom, setTargetClassRoom] = useState("");
  const [targetSemesterOrGrade, setTargetSemesterOrGrade] = useState("");
  const [major, setMajor] = useState("");
  const [submittingToken, setSubmittingToken] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadingTokens(true);
    try {
      const [sList, tList, cList] = await Promise.all([
        listTeacherStudents().catch(() => []),
        listClassTokens().catch(() => []),
        listTeacherMaterialsClasses().catch(() => [])
      ]);
      setStudents(sList);
      setTokens(tList);
      setAvailableClasses(cList);
    } catch (e) {
      toast.error("Gagal memuat data kelas");
    } finally {
      setLoading(false);
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateToken = async (e) => {
    e.preventDefault();
    if (!targetClassRoom.trim() || !targetSemesterOrGrade) {
      toast.error("Nama kelas dan kelas/semester wajib diisi");
      return;
    }

    setSubmittingToken(true);
    try {
      const payload = {
        target_class_room: targetClassRoom.trim(),
        target_semester_or_grade: parseInt(targetSemesterOrGrade),
        major: major.trim() || null
      };
      const newToken = await createClassToken(payload);
      toast.success("Token kelas berhasil dibuat!");
      setTokens([newToken, ...tokens]);
      setTargetClassRoom("");
      setTargetSemesterOrGrade("");
      setMajor("");
      // Refresh available classes
      listTeacherMaterialsClasses().then(setAvailableClasses).catch(() => []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal membuat token kelas");
    } finally {
      setSubmittingToken(false);
    }
  };

  const handleRevokeToken = async (tokenStr) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan token ${tokenStr}? Siswa baru tidak akan bisa mendaftar dengan kode ini.`)) {
      return;
    }
    try {
      await deleteClassToken(tokenStr);
      toast.success("Token kelas berhasil dibatalkan");
      setTokens(tokens.filter((t) => t.class_token !== tokenStr));
    } catch (err) {
      toast.error("Gagal menghapus token kelas");
    }
  };

  const getGradeOptions = () => {
    const level = user?.education_level?.toUpperCase();
    if (level === "SD") {
      return [
        { value: "1", label: "Kelas 1 (SD)" },
        { value: "2", label: "Kelas 2 (SD)" },
        { value: "3", label: "Kelas 3 (SD)" },
        { value: "4", label: "Kelas 4 (SD)" },
        { value: "5", label: "Kelas 5 (SD)" },
        { value: "6", label: "Kelas 6 (SD)" },
      ];
    }
    if (level === "SMP") {
      return [
        { value: "7", label: "Kelas 7 (SMP)" },
        { value: "8", label: "Kelas 8 (SMP)" },
        { value: "9", label: "Kelas 9 (SMP)" },
      ];
    }
    if (["SMA", "SMK", "MA"].includes(level)) {
      return [
        { value: "10", label: "Kelas 10 (SMA)" },
        { value: "11", label: "Kelas 11 (SMA)" },
        { value: "12", label: "Kelas 12 (SMA)" },
      ];
    }
    if (level === "UNIVERSITAS") {
      return [
        { value: "1", label: "Semester 1" },
        { value: "2", label: "Semester 2" },
        { value: "3", label: "Semester 3" },
        { value: "4", label: "Semester 4" },
        { value: "5", label: "Semester 5" },
        { value: "6", label: "Semester 6" },
        { value: "7", label: "Semester 7" },
        { value: "8", label: "Semester 8" },
      ];
    }
    return [
      { value: "1", label: "Kelas 1 (SD)" },
      { value: "2", label: "Kelas 2 (SD)" },
      { value: "3", label: "Kelas 3 (SD)" },
      { value: "4", label: "Kelas 4 (SD)" },
      { value: "5", label: "Kelas 5 (SD)" },
      { value: "6", label: "Kelas 6 (SD)" },
      { value: "7", label: "Kelas 7 (SMP)" },
      { value: "8", label: "Kelas 8 (SMP)" },
      { value: "9", label: "Kelas 9 (SMP)" },
      { value: "10", label: "Kelas 10 (SMA)" },
      { value: "11", label: "Kelas 11 (SMA)" },
      { value: "12", label: "Kelas 12 (SMA)" },
    ];
  };

  const filtered = students.filter(
    (s) =>
      !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const hasFullClassAccess = user?.permissions?.includes("ruang_kelas_full");

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Kelas</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Siswa & Akses Pendaftaran</h1>
        <p className="text-sm text-[#646675] mt-1.5">
          {user?.institution} · {students.length} siswa terdaftar
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: Students List */}
        <div className={hasFullClassAccess ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 shadow-sm">
            <h2 className="font-heading text-xl text-[#1A1B26] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1D2D50]" />
              Daftar Roster Siswa
            </h2>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Cari nama siswa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-md px-4 py-2 rounded-lg border border-[#E2E0D8] bg-white text-sm text-[#1A1B26] placeholder:text-[#A0A2B1] focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#1D2D50]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-[#646675] bg-[#F8F6F0]/50 border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
                {search ? "Tidak ada siswa yang cocok." : "Belum ada siswa yang mendaftar ke kelas Anda."}
              </div>
            ) : (
              <div className="border border-[#E2E0D8]/60 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E0D8] bg-[#F8F6F0]">
                      <th className="text-left py-2.5 px-4 text-[#A0A2B1] text-[11px] uppercase tracking-[0.15em] font-semibold">Nama</th>
                      <th className="text-left py-2.5 px-4 text-[#A0A2B1] text-[11px] uppercase tracking-[0.15em] font-semibold">Kelas</th>
                      <th className="text-left py-2.5 px-4 text-[#A0A2B1] text-[11px] uppercase tracking-[0.15em] font-semibold">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={s.user_id || i} className="border-b border-[#E2E0D8]/50 last:border-0 hover:bg-[#F8F6F0]/30 transition-colors">
                        <td className="py-3 px-4 text-[#1A1B26] font-medium">{s.name}</td>
                        <td className="py-3 px-4 text-[#646675]">{s.enrolled_class || "-"}</td>
                        <td className="py-3 px-4 text-[#646675]">{s.email || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Token Manager */}
        {hasFullClassAccess && (
          <div className="space-y-6">
            
            {/* Form: Generate Class Token */}
            <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 shadow-sm">
              <h2 className="font-heading text-xl text-[#1A1B26] mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#E5A93C]" />
                Buat Kode Pendaftaran
              </h2>
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#646675]">Target Nama Kelas</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={targetClassRoom}
                      onChange={(e) => setTargetClassRoom(e.target.value)}
                      placeholder="Contoh: X-MIPA-1, XI-IPS-2"
                      required
                      className="text-sm bg-[#F8F6F0] border-[#E2E0D8] h-10"
                    />
                    {availableClasses.length > 0 && (
                      <Select onValueChange={(val) => setTargetClassRoom(val)}>
                        <SelectTrigger className="w-[100px] border-[#E2E0D8] bg-white h-10 text-xs">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClasses.map((clsName) => (
                            <SelectItem key={clsName} value={clsName}>{clsName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#646675]">Kelas / Grade</Label>
                    <Select value={targetSemesterOrGrade} onValueChange={setTargetSemesterOrGrade} required>
                      <SelectTrigger className="mt-1 border-[#E2E0D8] bg-[#F8F6F0] h-10">
                        <SelectValue placeholder="Pilih Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {getGradeOptions().map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#646675]">Jurusan (Opsional)</Label>
                  <Input
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="MIPA, IPS, dll."
                    className="mt-1 text-sm bg-[#F8F6F0] border-[#E2E0D8] h-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submittingToken}
                className="w-full bg-[#1D2D50] hover:bg-[#15223E] text-white h-10 font-medium"
              >
                {submittingToken ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2 text-[#E5A93C]" />
                    Hasilkan Token
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Tokens List */}
          <div className="bg-white border border-[#E2E0D8] rounded-xl p-5 shadow-sm">
            <h2 className="font-heading text-lg text-[#1A1B26] mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#1D2D50]" />
              Token Aktif ({tokens.length})
            </h2>

            {loadingTokens ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#1D2D50]" />
              </div>
            ) : tokens.length === 0 ? (
              <p className="text-xs text-[#646675] text-center bg-[#F8F6F0]/50 border border-dashed border-[#E2E0D8] rounded-lg p-5">
                Belum ada token kelas aktif. Hasilkan token baru untuk membagikan kode pendaftaran ke pelajar.
              </p>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {tokens.map((t) => (
                  <div key={t.class_token} className="p-3 bg-[#F8F6F0] border border-[#E2E0D8] rounded-xl relative group">
                    <div className="text-xs font-semibold text-[#1D2D50] tracking-wider font-mono">
                      {t.class_token}
                    </div>
                    <div className="text-[11px] text-[#646675] mt-1.5 flex flex-wrap gap-x-2">
                      <span>Kelas: <strong>{t.target_class_room}</strong></span>
                      <span>•</span>
                      <span>Grade: <strong>{t.target_semester_or_grade}</strong></span>
                      {t.major && (
                        <>
                          <span>•</span>
                          <span>Jurusan: <strong>{t.major}</strong></span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handleRevokeToken(t.class_token)}
                      className="absolute top-2 right-2 text-[#A0A2B1] hover:text-[#B83A4B] transition-colors p-1"
                      title="Batalkan token"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        )}

      </div>
    </div>
  );
}
