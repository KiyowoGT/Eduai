import { useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";

export default function HomeRedirect() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "pelajar") {
    return <Dashboard />;
  }

  if (user.role === "pengajar") {
    if (user.title === "kepala_sekolah") {
      return <AdminDashboard />;
    }
    return <TeacherDashboard />;
  }

  return <Dashboard />;
}
