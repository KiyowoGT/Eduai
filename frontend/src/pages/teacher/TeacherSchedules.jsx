import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { listTeacherSchedules } from "@/lib/api";
import { Calendar } from "lucide-react";

const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function TeacherSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeacherSchedules()
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = {};
  schedules.forEach((s) => {
    if (!grouped[s.day]) grouped[s.day] = [];
    grouped[s.day].push(s);
  });

  return (
    <div className="w-full">
      <div className="mb-8 fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1]">Manajemen Jadwal</div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-1">Jadwal & Topik</h1>
        <p className="text-sm text-[#646675] mt-1.5">{user?.institution}</p>
      </div>

      {loading ? (
        <div className="text-sm text-[#646675]">Memuat...</div>
      ) : schedules.length === 0 ? (
        <div className="text-sm text-[#646675] bg-white border border-dashed border-[#E2E0D8] rounded-xl p-8 text-center">
          Belum ada jadwal. Buat jadwal baru untuk mulai.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {days.map((day) => {
            const items = grouped[day];
            if (!items || items.length === 0) return null;
            return (
              <div key={day} className="bg-white border border-[#E2E0D8] rounded-xl p-5">
                <h2 className="font-heading text-lg text-[#1A1B26] mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1D2D50]" />
                  {day}
                </h2>
                <div className="space-y-2">
                  {items.map((s, i) => (
                    <div key={s.schedule_id || i} className="p-3 rounded-lg bg-[#F8F6F0] border border-[#E2E0D8]">
                      <div className="text-xs font-mono text-[#646675]">
                        {s.start_time} - {s.end_time}
                      </div>
                      <div className="text-sm text-[#1A1B26] font-medium mt-0.5">{s.subject_name}</div>
                      <div className="text-xs text-[#A0A2B1]">{s.class_name}</div>
                      {s.current_topic && (
                        <div className="text-xs text-[#2D6A4F] mt-1 italic">{s.current_topic}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
