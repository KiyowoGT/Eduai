import JURUSAN from "./jurusan";

export const EDUCATION_LEVELS = ["SD", "SMP", "SMA", "SMK", "MA", "MAK"];

export const MAJORS = Object.fromEntries(
  EDUCATION_LEVELS.map((level) => [
    level,
    (JURUSAN[level] || []).map((j) => j.label),
  ])
);

export function hasMajor(level) {
  return !!(MAJORS[level] && MAJORS[level].length > 0);
}

export function gradeOptions(level) {
  // returns [{value, label}]
  if (level === "SD") return [1,2,3,4,5,6].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (level === "SMP") return [7,8,9].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  if (["SMA","SMK","MA","MAK"].includes(level)) return [10,11,12].map(n => ({ value: String(n), label: `Kelas ${n}` }));
  return [];
}

export function gradeLabel(level, n) {
  if (!n) return "";
  return `Kelas ${n}`;
}

export function institutionLabel(level) {
  return "Nama Sekolah";
}

export function institutionPlaceholder(level) {
  if (level === "SMK" || level === "MAK") return "Misal: SMKN 1 Jakarta";
  if (level === "MA") return "Misal: MAN 1 Bandung";
  return "Misal: SMAN 3 Bandung / SMP Labschool";
}
